from decimal import Decimal

from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from inventory.admin_views import IsSuperuser
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from inventory.permissions import (
    IsShopOwnerOrDjangoModelPermission,
    IsShopOwnerOrDjangoModelPermissionOrReceiptEditorCurrency,
)

from shops.scoping import get_shop_id_for_request, require_shop_id

from .models import Currency, QrLandingCustomLink, QrLandingSettings, ReceiptSettings, Shop, ShopSettings

QR_PRESET_META = (
    ("instagram", "Instagram"),
    ("facebook", "Facebook"),
    ("tiktok", "TikTok"),
    ("youtube", "YouTube"),
    ("whatsapp", "WhatsApp"),
    ("telegram", "Telegram"),
    ("snapchat", "Snapchat"),
    ("x", "X"),
    ("website", "Website"),
)
from .serializers import (
    CurrencySerializer,
    QrLandingAdminPatchSerializer,
    QrLandingCustomLinkSerializer,
    ReceiptSettingsSerializer,
    ShopSerializer,
    ShopSettingsSerializer,
)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok", "service": "multi-shop-api"})


def _primary_logo_url(request, obj: QrLandingSettings) -> str | None:
    if not obj.primary_logo:
        return None
    url = obj.primary_logo.url
    return request.build_absolute_uri(url) if request else url


@api_view(["GET"])
@permission_classes([AllowAny])
def public_qr_landing(request):
    """Public JSON for /qr-code — global landing (no shop query param)."""
    try:
        s = QrLandingSettings.load()
    except (OperationalError, ProgrammingError):
        return Response(
            {
                "detail": "Database not ready for QR landing. On the server run: python manage.py migrate",
            },
            status=503,
        )
    headline = (s.headline or "").strip() or "Connect"
    tagline = (s.tagline or "").strip()
    accent = (s.accent_color or "").strip() or "#c9a962"
    logo_url = _primary_logo_url(request, s)
    phone = (s.phone or "").strip()

    raw_presets = s.preset_links if isinstance(s.preset_links, list) else []
    saved_by_id = {}
    for item in raw_presets:
        if not isinstance(item, dict):
            continue
        lid = (item.get("id") or "").strip()
        if lid:
            saved_by_id[lid] = item

    preset_out = []
    for lid, label in QR_PRESET_META:
        row = saved_by_id.get(lid, {})
        url = (row.get("url") or "").strip()
        if row.get("enabled") is False:
            continue
        if not url:
            continue
        preset_out.append({"kind": "preset", "id": lid, "label": label, "url": url})

    custom_out = []
    for row in (
        QrLandingCustomLink.objects.filter(settings_id=1, enabled=True)
        .order_by("sort_order", "id")
        .iterator()
    ):
        url = (row.url or "").strip()
        if not url:
            continue
        lu = None
        if row.logo:
            u = row.logo.url
            lu = request.build_absolute_uri(u) if request else u
        bg = (row.bg_color or "").strip() or "#14110f"
        custom_out.append(
            {
                "kind": "custom",
                "id": row.pk,
                "label": row.label,
                "url": url,
                "bg_color": bg,
                "logo_url": lu,
            }
        )

    return Response(
        {
            "headline": headline,
            "tagline": tagline,
            "accent_color": accent,
            "logo_url": logo_url,
            "phone": phone,
            "preset_links": preset_out,
            "custom_links": custom_out,
        }
    )


class QrLandingAdminView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]
    http_method_names = ["get", "patch", "options", "head"]

    def get(self, request):
        try:
            s = QrLandingSettings.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {
                    "detail": "Database not ready for QR landing. Run: python manage.py migrate",
                },
                status=503,
            )
        ser = QrLandingCustomLinkSerializer(
            QrLandingCustomLink.objects.filter(settings_id=1).order_by("sort_order", "id"),
            many=True,
            context={"request": request},
        )
        return Response(
            {
                "headline": s.headline,
                "tagline": s.tagline,
                "accent_color": s.accent_color,
                "phone": s.phone,
                "primary_logo_url": _primary_logo_url(request, s),
                "preset_links": s.preset_links if isinstance(s.preset_links, list) else [],
                "custom_links": ser.data,
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
        )

    def patch(self, request):
        try:
            s = QrLandingSettings.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {
                    "detail": "Database not ready for QR landing. Run: python manage.py migrate",
                },
                status=503,
            )
        ser = QrLandingAdminPatchSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if "headline" in data:
            s.headline = data["headline"]
        if "tagline" in data:
            s.tagline = data["tagline"]
        if "accent_color" in data:
            s.accent_color = data["accent_color"] or "#c9a962"
        if "phone" in data:
            s.phone = data["phone"]
        if "preset_links" in data:
            s.preset_links = data["preset_links"]
        s.save()
        return self.get(request)


class QrLandingPrimaryLogoView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]
    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ["post", "delete", "options", "head"]

    def post(self, request):
        try:
            s = QrLandingSettings.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {"detail": "Database not ready for QR landing. Run: python manage.py migrate"},
                status=503,
            )
        f = request.FILES.get("logo")
        if not f:
            return Response({"detail": "Missing file field `logo`."}, status=400)
        s.primary_logo = f
        s.save()
        return Response({"primary_logo_url": _primary_logo_url(request, s)})

    def delete(self, request):
        try:
            s = QrLandingSettings.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {"detail": "Database not ready for QR landing. Run: python manage.py migrate"},
                status=503,
            )
        if s.primary_logo:
            s.primary_logo.delete(save=False)
        s.primary_logo = None
        s.save()
        return Response({"primary_logo_url": None})


class QrLandingCustomLinkViewSet(viewsets.ModelViewSet):
    serializer_class = QrLandingCustomLinkSerializer
    permission_classes = [IsAuthenticated, IsSuperuser]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        QrLandingSettings.load()
        return QrLandingCustomLink.objects.filter(settings_id=1).order_by("sort_order", "id")

    def perform_create(self, serializer):
        serializer.save(settings=QrLandingSettings.load())


class ShopViewSet(viewsets.ModelViewSet):
    queryset = Shop.objects.all()
    serializer_class = ShopSerializer
    lookup_field = "slug"
    permission_classes = [IsAuthenticated, IsShopOwnerOrDjangoModelPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.is_authenticated and self.request.user.is_superuser:
            # Admin shops page must always show all shops for superusers.
            return qs.all()
        sid = get_shop_id_for_request(self.request)
        if sid is not None:
            return qs.filter(pk=sid)
        return qs.none()

class CurrencyViewSet(viewsets.ModelViewSet):
    serializer_class = CurrencySerializer
    permission_classes = [IsAuthenticated, IsShopOwnerOrDjangoModelPermissionOrReceiptEditorCurrency]
    http_method_names = ["get", "post", "head", "options", "put", "patch", "delete"]

    @action(detail=False, methods=["post"], url_path="set-today")
    def set_today(self, request):
        """Create or update today's USD→IQD rate for the active shop."""
        shop_id = require_shop_id(request)
        raw = request.data.get("usd_to_iqd")
        if raw is None:
            return Response({"detail": "usd_to_iqd is required."}, status=400)
        rate = Decimal(str(raw))
        today = timezone.localdate()
        obj, _ = Currency.objects.update_or_create(
            shop_id=shop_id,
            date=today,
            defaults={"usd_to_iqd": rate},
        )
        ser = CurrencySerializer(obj, context={"request": request})
        return Response(ser.data)

    def get_queryset(self):
        qs = Currency.objects.select_related("shop").order_by("-date", "-id")
        shop_id = get_shop_id_for_request(self.request)
        if shop_id is not None:
            return qs.filter(shop_id=shop_id)
        # Force explicit shop scope for superusers on tenant-owned data.
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(shop_id=require_shop_id(self.request))

    def perform_update(self, serializer):
        serializer.save(shop_id=require_shop_id(self.request))

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        if hasattr(serializer, "fields") and "shop" in serializer.fields:
            try:
                sid = require_shop_id(self.request)
            except PermissionDenied:
                sid = None
            if sid is not None:
                serializer.fields["shop"].queryset = Shop.objects.filter(pk=sid)
            else:
                serializer.fields["shop"].queryset = Shop.objects.none()
        return serializer

    def update(self, request, *args, **kwargs):
        """Restrict updates to rows belonging to the active shop."""
        instance = self.get_object()
        if instance.shop_id != require_shop_id(request):
            from rest_framework.exceptions import NotFound

            raise NotFound()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.shop_id != require_shop_id(request):
            from rest_framework.exceptions import NotFound

            raise NotFound()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.shop_id != require_shop_id(request):
            from rest_framework.exceptions import NotFound

            raise NotFound()
        return super().destroy(request, *args, **kwargs)


class ReceiptSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "put", "patch", "options", "head"]

    def _get_or_create(self, request) -> ReceiptSettings:
        shop_id = require_shop_id(request)
        defaults = {}
        if getattr(request.user, "shop_id", None) == shop_id:
            defaults["shop_name_en"] = getattr(request.user.shop, "name", "")
        obj, _ = ReceiptSettings.objects.get_or_create(shop_id=shop_id, defaults=defaults)
        return obj

    def get(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.view_receiptsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        return Response(ReceiptSettingsSerializer(obj, context={"request": request}).data)

    def put(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.change_receiptsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        ser = ReceiptSettingsSerializer(
            obj,
            data=request.data,
            partial=False,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save(shop_id=obj.shop_id)
        return Response(ser.data)

    def patch(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.change_receiptsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        ser = ReceiptSettingsSerializer(
            obj,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save(shop_id=obj.shop_id)
        return Response(ser.data)


class ShopSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "put", "patch", "options", "head"]

    def _get_or_create(self, request) -> ShopSettings:
        shop_id = require_shop_id(request)
        obj, _ = ShopSettings.objects.get_or_create(shop_id=shop_id)
        return obj

    def get(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.view_shopsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        return Response(ShopSettingsSerializer(obj, context={"request": request}).data)

    def put(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.change_shopsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        ser = ShopSettingsSerializer(
            obj,
            data=request.data,
            partial=False,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save(shop_id=obj.shop_id)
        return Response(ser.data)

    def patch(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.change_shopsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        ser = ShopSettingsSerializer(
            obj,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save(shop_id=obj.shop_id)
        return Response(ser.data)
