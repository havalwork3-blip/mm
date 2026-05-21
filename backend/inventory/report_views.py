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
        from inventory.jard_data import jard_rows_for_shop

        raw = jard_rows_for_shop(
            shop_id,
            d_from=d_from,
            d_to=d_to,
            show_financials=show_financials,
        )
        data: list[dict] = []
        for row in raw:
            out = {
                "product_id": row["product_id"],
                "product_name": row["product_name"],
                "product_image_url": None,
                "category_id": row["category_id"],
                "category_name": row["category_name"],
                "remaining_qty": row["remaining_qty"],
            }
            if show_financials:
                out["sold_qty"] = row.get("sold_qty", 0)
                out["unit_buy_price_usd"] = format(row.get("unit_buy_price_usd", Decimal("0")), "f")
                out["remaining_value_usd"] = format(row.get("remaining_value_usd", Decimal("0")), "f")
                out["sold_value_usd"] = format(row.get("sold_value_usd", Decimal("0")), "f")
            data.append(out)
        return Response({"results": data, "show_financials": show_financials})
