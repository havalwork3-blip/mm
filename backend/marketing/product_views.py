from __future__ import annotations

import json

from django.db.utils import OperationalError, ProgrammingError
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import MarketingTokenAuthentication
from .models import MarketingProductCard, MarketingProductCategory
from .permissions import IsMarketingEditor
from .product_defaults import default_product_cards
from .serializers import (
    MarketingProductCardSerializer,
    MarketingProductCategorySerializer,
)


def _abs_url(request, file_field) -> str | None:
    if not file_field:
        return None
    url = file_field.url
    if url.startswith("http"):
        return url
    return request.build_absolute_uri(url)


def _serialize_product(request, p: MarketingProductCard) -> dict:
    tag = p.tag if isinstance(p.tag, dict) else {}
    title = p.title if isinstance(p.title, dict) else {}
    return {
        "id": p.id,
        "page": p.page,
        "category_id": p.category_id,
        "title": title,
        "tag": tag,
        "image_url": _abs_url(request, p.image),
        "link_url": p.link_url or "",
        "tone": p.tone,
        "sort_order": p.sort_order,
        "is_published": p.is_published,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _serialize_category(request, c: MarketingProductCategory) -> dict:
    title = c.title if isinstance(c.title, dict) else {}
    return {
        "id": c.id,
        "page": c.page,
        "title": title,
        "sort_order": c.sort_order,
        "is_published": c.is_published,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def ensure_default_products() -> None:
    if MarketingProductCard.objects.exists():
        return
    for row in default_product_cards():
        MarketingProductCard.objects.create(**row)


def _parse_product_payload(data) -> dict:
    out = {}
    for key, val in data.items():
        if key in {"title", "tag"} and isinstance(val, str):
            try:
                out[key] = json.loads(val)
            except json.JSONDecodeError:
                out[key] = val
        elif key == "category":
            if val in (None, "", "null"):
                out[key] = None
            else:
                out[key] = int(val)
        elif key == "is_published":
            out[key] = str(val).lower() in {"1", "true", "yes", "on"}
        elif key == "sort_order":
            out[key] = int(val)
        elif key == "clear_image":
            continue
        else:
            out[key] = val
    return out


class PublicMarketingProductsView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        page = (request.query_params.get("page") or "").strip().lower()
        if page not in {"luxury", "tech", "shop", "services"}:
            return Response({"detail": "Missing or invalid `page`."}, status=400)
        try:
            ensure_default_products()
            categories = MarketingProductCategory.objects.filter(
                page=page, is_published=True
            ).order_by("sort_order", "id")
            products = MarketingProductCard.objects.filter(
                page=page, is_published=True
            ).select_related("category").order_by("sort_order", "id")
        except (OperationalError, ProgrammingError):
            return Response(
                {"detail": "Database not ready. Run: python manage.py migrate"},
                status=503,
            )
        return Response(
            {
                "page": page,
                "categories": [_serialize_category(request, c) for c in categories],
                "products": [_serialize_product(request, p) for p in products],
            }
        )


class MarketingProductSeedView(APIView):
    authentication_classes = [MarketingTokenAuthentication]
    permission_classes = [IsMarketingEditor]

    def post(self, request):
        if MarketingProductCard.objects.exists():
            return Response({"detail": "Products already exist.", "seeded": False})
        ensure_default_products()
        return Response({"detail": "Default products seeded.", "seeded": True})


class MarketingProductCategoryListView(APIView):
    authentication_classes = [MarketingTokenAuthentication]
    permission_classes = [IsMarketingEditor]

    def get(self, request):
        page = (request.query_params.get("page") or "").strip()
        qs = MarketingProductCategory.objects.all().order_by("page", "sort_order", "id")
        if page:
            qs = qs.filter(page=page)
        return Response([_serialize_category(request, c) for c in qs])

    def post(self, request):
        ser = MarketingProductCategorySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(_serialize_category(request, obj), status=201)


class MarketingProductCategoryDetailView(APIView):
    authentication_classes = [MarketingTokenAuthentication]
    permission_classes = [IsMarketingEditor]

    def patch(self, request, pk: int):
        try:
            obj = MarketingProductCategory.objects.get(pk=pk)
        except MarketingProductCategory.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        ser = MarketingProductCategorySerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        return Response(_serialize_category(request, obj))

    def delete(self, request, pk: int):
        obj = MarketingProductCategory.objects.filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found."}, status=404)
        MarketingProductCard.objects.filter(category=obj).update(category=None)
        obj.delete()
        return Response(status=204)


class MarketingProductListView(APIView):
    authentication_classes = [MarketingTokenAuthentication]
    permission_classes = [IsMarketingEditor]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def get(self, request):
        ensure_default_products()
        page = (request.query_params.get("page") or "").strip()
        qs = MarketingProductCard.objects.select_related("category").order_by(
            "page", "sort_order", "id"
        )
        if page:
            qs = qs.filter(page=page)
        return Response([_serialize_product(request, p) for p in qs])

    def post(self, request):
        payload = _parse_product_payload(request.data)
        ser = MarketingProductCardSerializer(data=payload)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        image = request.FILES.get("image")
        if image:
            obj.image = image
            obj.save(update_fields=["image", "updated_at"])
        return Response(_serialize_product(request, obj), status=201)


class MarketingProductDetailView(APIView):
    authentication_classes = [MarketingTokenAuthentication]
    permission_classes = [IsMarketingEditor]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def patch(self, request, pk: int):
        try:
            obj = MarketingProductCard.objects.get(pk=pk)
        except MarketingProductCard.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        ser = MarketingProductCardSerializer(obj, data=_parse_product_payload(request.data), partial=True)
        ser.is_valid(raise_exception=True)
        obj = ser.save()
        image = request.FILES.get("image")
        if image:
            obj.image = image
            obj.save(update_fields=["image", "updated_at"])
        if request.data.get("clear_image") in (True, "true", "1", 1):
            if obj.image:
                obj.image.delete(save=False)
            obj.image = None
            obj.save(update_fields=["image", "updated_at"])
        return Response(_serialize_product(request, obj))

    def delete(self, request, pk: int):
        obj = MarketingProductCard.objects.filter(pk=pk).first()
        if not obj:
            return Response({"detail": "Not found."}, status=404)
        if obj.image:
            obj.image.delete(save=False)
        obj.delete()
        return Response(status=204)
