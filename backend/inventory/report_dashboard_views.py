from decimal import Decimal

from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from shops.scoping import require_shop_id

from .dashboard_tools import (
    cashier_ledger_entries,
    cashier_snapshot,
    customer_debt_payments_usd_in_range,
    net_profit_in_range,
    period_dashboard_petty_cash_usd_in_range,
    petty_cash_trend_points,
    total_customer_discounts_usd_in_range,
    total_debtor_customers_count,
    top_selling_products_in_range,
    total_expenses_usd_in_range,
    total_inventory_loss_usd_in_range,
    total_payables_usd,
    total_returned_products_qty_in_range,
    total_returned_products_usd_in_range,
    total_sales_gross_usd_in_range,
    total_sales_usd_in_range,
    total_receivables_usd,
    total_receivables_usd_in_range,
    total_stock_value_usd,
)
from .models import ShopDayOpeningCash
from .permissions import IsShopOwnerOrPermission
from .serializers import ShopDayOpeningCashSerializer


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {"GET": ("view_sale", "view_report", "view_expense")}

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
            return Response({"detail": "Invalid date range."}, status=400)
        if d_to < d_from:
            d_from, d_to = d_to, d_from

        shop_id = require_shop_id(request)
        np = net_profit_in_range(shop_id, d_from, d_to)
        exp = total_expenses_usd_in_range(shop_id, d_from, d_to)
        inventory_loss = total_inventory_loss_usd_in_range(shop_id, d_from, d_to)
        sales_gross = total_sales_gross_usd_in_range(shop_id, d_from, d_to)
        sales_total = total_sales_usd_in_range(shop_id, d_from, d_to)
        discounts_total = total_customer_discounts_usd_in_range(shop_id, d_from, d_to)
        debtor_customers_count = total_debtor_customers_count(shop_id)
        returned_products_qty = total_returned_products_qty_in_range(shop_id, d_from, d_to)
        returned_products_usd = total_returned_products_usd_in_range(shop_id, d_from, d_to)
        period_recv = total_receivables_usd_in_range(shop_id, d_from, d_to)
        cash_snapshot = cashier_snapshot(shop_id, d_from, d_to)
        period_debt_collected_usd = customer_debt_payments_usd_in_range(
            shop_id,
            d_from,
            d_to,
        )
        from .dashboard_tools import money_usd_2dp

        exp_2dp = money_usd_2dp(exp)
        discounts_2dp = money_usd_2dp(discounts_total)
        returned_2dp = money_usd_2dp(returned_products_usd)
        period_cash_drawer_usd = period_dashboard_petty_cash_usd_in_range(
            shop_id,
            d_from,
            d_to,
        )
        period_cash_in_usd = money_usd_2dp(
            sales_total + period_debt_collected_usd - returned_2dp,
        )
        period_cash_out_usd = exp_2dp
        recv = total_receivables_usd(shop_id)
        pay = total_payables_usd(shop_id)
        stock = total_stock_value_usd(shop_id)
        top_products = top_selling_products_in_range(shop_id, d_from, d_to)

        return Response(
            {
                "date_from": d_from.isoformat(),
                "date_to": d_to.isoformat(),
                "net_profit_usd": format(np, "f"),
                "total_expenses_usd": format(exp_2dp, "f"),
                "total_inventory_loss_usd": format(inventory_loss, "f"),
                "total_sales_gross_usd": format(sales_gross, "f"),
                "total_sales_usd": format(sales_total, "f"),
                "total_discounts_usd": format(discounts_2dp, "f"),
                "debtor_customers_count": debtor_customers_count,
                "total_returned_products_qty": returned_products_qty,
                "total_returned_products_usd": format(returned_2dp, "f"),
                "period_receivables_usd": format(period_recv, "f"),
                "period_cash_drawer_usd": format(period_cash_drawer_usd, "f"),
                "period_customer_debt_collected_usd": format(period_debt_collected_usd, "f"),
                "period_cash_in_usd": format(period_cash_in_usd, "f"),
                "period_cash_out_usd": format(period_cash_out_usd, "f"),
                "current_cash_usd": cash_snapshot["current_cash_usd"],
                "total_receivables_usd": format(recv, "f"),
                "total_payables_usd": format(pay, "f"),
                "total_stock_value_usd": format(stock, "f"),
                "chart": {
                    "profit_usd": format(np, "f"),
                    "expenses_usd": format(exp, "f"),
                },
                "top_selling_products": top_products,
            },
        )


class DashboardPettyCashTrendView(APIView):
    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {"GET": ("view_sale", "view_report", "view_expense")}

    def get(self, request):
        from django.utils.dateparse import parse_date

        shop_id = require_shop_id(request)
        from_str = request.query_params.get("from")
        to_str = request.query_params.get("to")
        if from_str and to_str:
            d_from = parse_date(from_str.strip())
            d_to = parse_date(to_str.strip())
            if d_from is None or d_to is None:
                return Response({"detail": "Invalid date range."}, status=400)
            return Response(
                petty_cash_trend_points(shop_id, d_from=d_from, d_to=d_to),
            )
        try:
            days = int(request.query_params.get("days", "30"))
        except (TypeError, ValueError):
            days = 30
        return Response(petty_cash_trend_points(shop_id, days=days))


class CashierSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {"GET": ("view_cashier", "view_openingcash", "view_shopdayopeningcash")}

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

        shop_id = require_shop_id(request)
        opening_raw = request.query_params.get("opening_cash_usd")
        opening = Decimal(str(opening_raw)) if opening_raw not in (None, "") else None

        data = cashier_snapshot(shop_id, d_from, d_to, opening_cash_usd=opening)
        data["date_from"] = d_from.isoformat()
        data["date_to"] = d_to.isoformat()
        return Response(data)


class CashierLedgerView(APIView):
    """Vault archive: opening, expenses, employee debts, sale/purchase payments in range."""

    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    # Cashier screen uses view_cashier only. Customer/supplier debt UIs also read this endpoint
    # for payment history (they filter client-side); allow those without view_cashier.
    permission_codenames_by_method = {
        "GET": ("view_cashier", "view_openingcash", "view_shopdayopeningcash", "view_customer", "view_purchase"),
    }

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
            return Response({"detail": "Invalid date range."}, status=400)
        if d_to < d_from:
            d_from, d_to = d_to, d_from

        shop_id = require_shop_id(request)
        entries = cashier_ledger_entries(shop_id, d_from, d_to)
        return Response(
            {
                "date_from": d_from.isoformat(),
                "date_to": d_to.isoformat(),
                "entries": entries,
            },
        )


class ShopOpeningCashView(APIView):
    """List opening cash by day, or create/replace a row (Qasa / manage UI)."""

    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {
        "GET": ("view_openingcash", "view_shopdayopeningcash"),
        "POST": ("add_openingcash", "change_openingcash", "add_shopdayopeningcash", "change_shopdayopeningcash"),
    }

    def get(self, request):
        shop_id = require_shop_id(request)
        qs = ShopDayOpeningCash.objects.filter(shop_id=shop_id).order_by("-for_date", "-id")[:1000]
        return Response(ShopDayOpeningCashSerializer(qs, many=True).data)

    def post(self, request):
        shop_id = require_shop_id(request)
        ser = ShopDayOpeningCashSerializer(
            data=request.data,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        obj, _ = ShopDayOpeningCash.objects.update_or_create(
            shop_id=shop_id,
            for_date=ser.validated_data["for_date"],
            defaults={"opening_cash_usd": ser.validated_data["opening_cash_usd"]},
        )
        return Response(ShopDayOpeningCashSerializer(obj).data)


class ShopOpeningCashDetailView(APIView):
    """Delete one opening-cash row (manage UI)."""

    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {"DELETE": ("change_openingcash", "delete_openingcash", "change_shopdayopeningcash", "delete_shopdayopeningcash")}

    def delete(self, request, pk: int):
        shop_id = require_shop_id(request)
        obj = get_object_or_404(ShopDayOpeningCash, pk=pk, shop_id=shop_id)
        obj.delete()
        return Response(status=204)
