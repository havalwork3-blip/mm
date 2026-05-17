from decimal import Decimal

from django.db.models import (
    DecimalField,
    ExpressionWrapper,
    F,
    Q,
    Sum,
    Value,
)
from django.db.models.functions import Coalesce
from django.utils.dateparse import parse_date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from shops.scoping import get_shop_id_for_request, require_shop_id

from .models import Product
from accounts.models import UserRole

from .permissions import IsShopOwnerOrPermission, _has_any_perm
from .reports import profit_report_for_shop, profit_report_global


class ProfitReportView(APIView):
    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {"GET": ("view_profitreport",)}

    def get(self, request):
        from_str = request.query_params.get("from")
        to_str = request.query_params.get("to")
        if not from_str or not to_str:
            return Response(
                {"detail": "Query params `from` and `to` (YYYY-MM-DD) are required."},
                status=400,
            )
        d_from = parse_date(from_str)
        d_to = parse_date(to_str)
        if d_from is None or d_to is None:
            return Response({"detail": "Invalid date format."}, status=400)
        if d_to < d_from:
            return Response({"detail": "`to` must be on or after `from`."}, status=400)

        shop_id = get_shop_id_for_request(request)
        if shop_id is None:
            if request.user.is_superuser:
                data = profit_report_global(d_from, d_to)
                return Response(data)
            require_shop_id(request)  # raises PermissionDenied
        data = profit_report_for_shop(shop_id, d_from, d_to)
        return Response(data)


def _user_can_view_jard_financials(user) -> bool:
    if getattr(user, "is_superuser", False):
        return True
    if getattr(user, "role", None) == UserRole.OWNER:
        return True
    return _has_any_perm(user, ("view_jard_financials",))


class JardReportView(APIView):
    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {"GET": ("view_product", "view_sale")}

    def get(self, request):
        from_str = request.query_params.get("from")
        to_str = request.query_params.get("to")
        d_from = parse_date(from_str) if from_str else None
        d_to = parse_date(to_str) if to_str else None
        if from_str and d_from is None:
            return Response({"detail": "Invalid `from` date format."}, status=400)
        if to_str and d_to is None:
            return Response({"detail": "Invalid `to` date format."}, status=400)
        if d_from and d_to and d_to < d_from:
            return Response({"detail": "`to` must be on or after `from`."}, status=400)

        shop_id = require_shop_id(request)
        show_financials = _user_can_view_jard_financials(request.user)
        sold_filter = Q()
        if d_from:
            sold_filter &= Q(sale_lines__sale__occurred_at__date__gte=d_from)
        if d_to:
            sold_filter &= Q(sale_lines__sale__occurred_at__date__lte=d_to)
        rows = (
            Product.objects.filter(shop_id=shop_id, is_discontinued=False)
            .select_related("category")
            .annotate(
                sold_qty=Coalesce(
                    Sum("sale_lines__quantity", filter=sold_filter),
                    Value(0),
                ),
                sold_revenue_usd=Coalesce(
                    Sum(
                        ExpressionWrapper(
                            F("sale_lines__quantity")
                            * F("sale_lines__unit_price_usd"),
                            output_field=DecimalField(max_digits=24, decimal_places=4),
                        ),
                        filter=sold_filter,
                    ),
                    Value(Decimal("0")),
                ),
            )
            .order_by("category__name", "name")
        )
        data: list[dict] = []
        for p in rows:
            row = {
                "product_id": p.id,
                "product_name": p.name,
                "product_image_url": request.build_absolute_uri(p.image.url) if p.image else None,
                "category_id": p.category_id,
                "category_name": p.category.name if p.category_id else "",
                "remaining_qty": int(p.current_stock_quantity or 0),
            }
            if show_financials:
                row["sold_qty"] = int(p.sold_qty or 0)
                row["unit_buy_price_usd"] = format(Decimal(p.buy_price or 0), "f")
                row["remaining_value_usd"] = format(
                    (Decimal(p.current_stock_quantity or 0) * Decimal(p.buy_price or 0)),
                    "f",
                )
                row["sold_value_usd"] = format(
                    Decimal(p.sold_revenue_usd or 0),
                    "f",
                )
            data.append(row)
        return Response({"results": data, "show_financials": show_financials})
