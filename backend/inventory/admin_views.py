"""Superuser-only global administration API."""

from __future__ import annotations

from decimal import Decimal

from django.utils.dateparse import parse_date
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from shops.models import Shop

from .dashboard_tools import total_stock_value_usd
from .reports import profit_report_for_shop


class IsSuperuser(BasePermission):
    def has_permission(self, request, view) -> bool:
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "is_superuser", False))


class GlobalAdminStatsView(APIView):
    """
    GET /api/admin/stats/?from=YYYY-MM-DD&to=YYYY-MM-DD

    Aggregates across all shops (superuser only).
    """

    permission_classes = [IsSuperuser]

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
        if d_from is None or d_to is None or d_to < d_from:
            return Response({"detail": "Invalid date range."}, status=400)

        global_profit = Decimal("0")
        global_stock = Decimal("0")
        global_discounts = Decimal("0")
        global_sales = Decimal("0")
        global_expenses = Decimal("0")
        shop_rows: list[dict] = []
        # Iterate over all shops collecting per-shop breakdown for top-shops chart.
        for shop in Shop.objects.all().only("id", "name", "is_active"):
            totals = profit_report_for_shop(shop.pk, d_from, d_to)["totals"]
            net_profit = Decimal(totals["net_profit_usd"])
            sales_usd = Decimal(totals["sum_sale_line_prices_usd"])
            discounts_usd = Decimal(totals["total_customer_discounts_usd"])
            expenses_usd = Decimal(totals["total_expenses_usd"])
            stock_usd = total_stock_value_usd(shop.pk)

            global_profit += net_profit
            global_discounts += discounts_usd
            global_stock += stock_usd
            global_sales += sales_usd
            global_expenses += expenses_usd

            shop_rows.append(
                {
                    "shop_id": shop.pk,
                    "shop_name": shop.name,
                    "is_active": shop.is_active,
                    "sales_usd": format(sales_usd.quantize(Decimal("0.0001")), "f"),
                    "profit_usd": format(net_profit.quantize(Decimal("0.0001")), "f"),
                    "expenses_usd": format(expenses_usd.quantize(Decimal("0.0001")), "f"),
                    "discounts_usd": format(discounts_usd.quantize(Decimal("0.0001")), "f"),
                    "stock_value_usd": format(stock_usd.quantize(Decimal("0.0001")), "f"),
                }
            )

        # Top shops ranked by sales (desc). Frontend may slice further as needed.
        top_shops = sorted(
            shop_rows,
            key=lambda r: Decimal(r["sales_usd"]),
            reverse=True,
        )

        return Response(
            {
                "date_from": d_from.isoformat(),
                "date_to": d_to.isoformat(),
                "total_shops": Shop.objects.count(),
                "total_active_shops": Shop.objects.filter(is_active=True).count(),
                "total_active_users": User.objects.filter(is_active=True).count(),
                "global_profit_usd": format(global_profit.quantize(Decimal("0.0001")), "f"),
                "global_discounts_usd": format(global_discounts.quantize(Decimal("0.0001")), "f"),
                "global_stock_value_usd": format(global_stock.quantize(Decimal("0.0001")), "f"),
                "global_sales_usd": format(global_sales.quantize(Decimal("0.0001")), "f"),
                "global_expenses_usd": format(global_expenses.quantize(Decimal("0.0001")), "f"),
                "top_shops": top_shops,
            },
        )
