"""Superuser-only global administration API."""

from __future__ import annotations

from decimal import Decimal

from django.utils.dateparse import parse_date
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from shops.models import Shop

from .dashboard_tools import (
    cashier_snapshot,
    net_profit_in_range,
    total_customer_discounts_usd_in_range,
    total_expenses_usd_in_range,
    total_returned_products_usd_in_range,
    total_receivables_usd_in_range,
    total_sales_usd_in_range,
    total_stock_value_usd,
)


def _money(value: Decimal) -> str:
    return format(value.quantize(Decimal("0.0001")), "f")


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
        for shop in Shop.objects.all().only("id", "name", "is_active"):
            sales_usd = total_sales_usd_in_range(shop.pk, d_from, d_to)
            net_profit = net_profit_in_range(shop.pk, d_from, d_to)
            expenses_usd = total_expenses_usd_in_range(shop.pk, d_from, d_to)
            discounts_usd = total_customer_discounts_usd_in_range(shop.pk, d_from, d_to)
            returned_usd = total_returned_products_usd_in_range(shop.pk, d_from, d_to)
            receivables_usd = total_receivables_usd_in_range(shop.pk, d_from, d_to)
            stock_usd = total_stock_value_usd(shop.pk)
            cash_snapshot = cashier_snapshot(shop.pk, d_from, d_to)
            drawer_usd = (
                Decimal(cash_snapshot["sales_cash_in_usd"])
                - Decimal(cash_snapshot["expenses_usd"])
                - Decimal(cash_snapshot["employee_debt_cash_effect_usd"])
            ).quantize(Decimal("0.0001"))

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
                    "sales_usd": _money(sales_usd),
                    "total_sold_usd": _money(sales_usd),
                    "profit_usd": _money(net_profit),
                    "expenses_usd": _money(expenses_usd),
                    "discounts_usd": _money(discounts_usd),
                    "returned_products_usd": _money(returned_usd),
                    "period_receivables_usd": _money(receivables_usd),
                    "period_cash_drawer_usd": _money(drawer_usd),
                    "stock_value_usd": _money(stock_usd),
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
