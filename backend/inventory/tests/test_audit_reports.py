"""Audit: reports, dashboard totals, cash box, partner wallets, shop isolation, TZ boundaries.

Each test computes the expected numbers by hand and compares them to the API output.
"""

from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from inventory.models import ShareholderWalletCredit
from inventory.shareholder_wallet import month_start

from .base import D, ShopTestCase

BAGHDAD = ZoneInfo("Asia/Baghdad")


def local_dt(day, hh, mm=0):
    return timezone.make_aware(datetime.combine(day, time(hh, mm)), BAGHDAD)


def prev_month(m):
    return (m - timedelta(days=1)).replace(day=1)


class AuditTimezoneBoundaryTests(ShopTestCase):
    def test_sale_at_2330_local_lands_on_that_local_day(self):
        p = self.make_product(buy="10")
        self.buy([(p, 10, "10")], paid="100")
        today = timezone.localdate()
        yesterday = today - timedelta(days=1)
        # 23:30 Baghdad = 20:30 UTC on the same day; 00:30 Baghdad = 21:30 UTC previous day.
        self.sell([(p, 1, "30")], paid_usd="30", occurred_at=local_dt(yesterday, 23, 30))
        self.sell([(p, 1, "50")], paid_usd="50", occurred_at=local_dt(today, 0, 30))

        self.assertMoney(self.profit(yesterday.isoformat())["sum_sale_line_prices_usd"], "30")
        self.assertMoney(self.profit(today.isoformat())["sum_sale_line_prices_usd"], "50")
        self.assertMoney(self.cashier(yesterday.isoformat())["pos_sale_payments_usd"], "30")
        self.assertMoney(self.cashier(today.isoformat())["pos_sale_payments_usd"], "50")
        stats = self.api("get", f"/api/dashboard/stats/?from={yesterday}&to={yesterday}").data
        self.assertMoney(stats["total_sales_usd"], "30")


class AuditProfitTotalsTests(ShopTestCase):
    def test_discount_and_return_are_netted_and_totals_add_up(self):
        p = self.make_product(buy="40")
        self.buy([(p, 10, "40")], paid="400")
        sale = self.sell([(p, 2, "100")], discount="20", paid_usd="180")
        self.return_sale(sale, {0: 1})  # refund 100 * (1 - 20/200) = 90
        t = self.profit()
        # 1 unit left sold: 100 sale, 40 cost, discount 20 * 100/200 = 10 -> 50 net
        self.assertMoney(t["sum_sale_line_prices_usd"], "100")
        self.assertMoney(t["sum_sale_line_buy_prices_usd"], "40")
        self.assertMoney(t["total_customer_discounts_usd"], "10")
        self.assertMoney(t["net_profit_usd"], "50")
        self.assertMoney(t["lines_gross_total_usd"], t["gross_margin_usd"])
        c = self.cashier()
        self.assertMoney(c["pos_sale_payments_usd"], "180")
        self.assertMoney(c["sale_returns_usd"], "90")
        self.assertMoney(c["current_cash_usd"], D(180) - D(90) - D(400))

    def test_partial_paid_sale_return_splits_debt_and_cash(self):
        p = self.make_product(buy="10")
        self.buy([(p, 10, "10")], paid="100")
        sale = self.sell([(p, 2, "50")], paid_usd="60")  # unpaid 40
        self.return_sale(sale, {0: 1})  # 50 back: 40 debt, 10 cash
        stats = self.api("get", f"/api/dashboard/stats/?from={self.today()}&to={self.today()}").data
        self.assertMoney(stats["total_returned_products_usd"], "10")
        self.assertMoney(stats["period_customer_debt_reduced_by_returns_usd"], "40")
        self.assertMoney(self.customer_balance(), "0")

    def test_debt_overpayment_only_books_what_was_owed(self):
        p = self.make_product(buy="10")
        self.buy([(p, 10, "10")], paid="100")
        self.sell([(p, 1, "60")], paid_usd="0")
        self.api("post", f"/api/customers/{self.customer.pk}/collect-payment/", {"amount_paid_usd": "100"})
        c = self.cashier()
        self.assertMoney(c["customer_debt_receipts_usd"], "60")

    def test_opening_cash_carries_forward(self):
        p = self.make_product(buy="10")
        yesterday = timezone.localdate() - timedelta(days=1)
        self.api("post", "/api/cashier/opening/", {"for_date": yesterday.isoformat(), "opening_cash_usd": "100"})
        self.buy([(p, 10, "10")], paid="0", occurred_at=local_dt(yesterday, 9))
        self.sell([(p, 1, "50")], paid_usd="50", occurred_at=local_dt(yesterday, 10))
        self.assertMoney(self.cashier()["opening_cash_usd"], "150")


class AuditShopIsolationTests(ShopTestCase):
    def test_other_shop_numbers_do_not_leak(self):
        p = self.make_product(buy="10")
        self.buy([(p, 10, "10")], paid="100")
        self.sell([(p, 1, "30")], paid_usd="30")
        self.api("post", "/api/expenses/", {"name": "Rent", "amount": "5", "currency": "USD",
                                              "occurred_on": self.today()}, expect=201)
        self.as_user(self.owner2)
        t = self.profit()
        for k in ("sum_sale_line_prices_usd", "total_expenses_usd", "net_profit_usd"):
            self.assertMoney(t[k], "0", k)
        c = self.cashier()
        self.assertMoney(c["current_cash_usd"], "0")
        stats = self.api("get", f"/api/dashboard/stats/?from={self.today()}&to={self.today()}").data
        self.assertMoney(stats["total_sales_usd"], "0")
        self.assertEqual(stats["top_selling_products"], [])
        # superuser scoped to shop A sees A only
        self.as_user(self.admin)
        res = self.api("get", f"/api/reports/profit/?from={self.today()}&to={self.today()}&shop_id={self.shop.pk}")
        self.assertMoney(res.data["totals"]["net_profit_usd"], "15")


class AuditReportBugTests(ShopTestCase):
    def test_jard_sold_value_mixes_gross_sales_with_discounted_returns(self):
        """Sell 2 @100 with 20 discount, return 1 (refund 90). Net sold: 1 unit.
        Gross basis -> 100, net basis -> 90. Jard subtracts the discounted return
        from the gross sale and reports 110."""
        p = self.make_product(buy="40")
        self.buy([(p, 10, "40")], paid="400")
        sale = self.sell([(p, 2, "100")], discount="20", paid_usd="180")
        self.return_sale(sale, {0: 1})
        rows = self.api("get", f"/api/reports/jard/?from={self.today()}&to={self.today()}").data["results"]
        row = next(r for r in rows if r["product_id"] == p.pk)
        self.assertEqual(row["sold_qty"], 1)
        self.assertIn(D(row["sold_value_usd"]).quantize(D("0.01")), (D("100.00"), D("90.00")))

    def test_top_selling_products_ignores_returns(self):
        p = self.make_product(buy="10")
        self.buy([(p, 10, "10")], paid="100")
        sale = self.sell([(p, 2, "50")], paid_usd="100")
        self.return_sale(sale, {0: 2})  # fully returned
        stats = self.api("get", f"/api/dashboard/stats/?from={self.today()}&to={self.today()}").data
        qty = sum(r["total_qty"] for r in stats["top_selling_products"])
        self.assertEqual(qty, 0, stats["top_selling_products"])

    def test_purchase_return_keeps_full_supplier_discount_in_payables(self):
        """Buy 10 @10 with 10 discount, pay 90, return all 10. Supplier owes us 90.
        A second invoice of 100 on credit -> we owe 10. Code keeps the 10 discount on a
        fully returned invoice (credit 100), so it says we owe 0."""
        p = self.make_product(buy="10")
        pur = self.buy([(p, 10, "10")], paid="90", discount="10")
        self.return_purchase(pur, {0: 10})
        self.buy([(p, 5, "20")], paid="0")
        res = self.api("get", f"/api/purchases/company-outstanding/?company_id={self.company.pk}").data
        self.assertMoney(res["outstanding_usd"], "10")

    def test_profit_counts_supplier_discount_of_fully_returned_purchase(self):
        """No sale, purchase fully returned: profit must be 0 and net purchases 0."""
        p = self.make_product(buy="10")
        pur = self.buy([(p, 10, "10")], paid="90", discount="10")
        self.return_purchase(pur, {0: 10})
        t = self.profit()
        self.assertEqual(
            (D(t["total_purchases_goods_usd"]), D(t["net_profit_usd"])),
            (D("0"), D("0")),
            "(total_purchases_goods_usd, net_profit_usd)",
        )


class AuditWalletTests(ShopTestCase):
    def test_recalculate_month_keeps_the_percentage_of_that_month(self):
        """Partner had 30% in month -1; later lowered to 10%. Recalculating month -1
        (profit unchanged) must still give 30% of that month's profit."""
        p = self.make_product(buy="10")
        m1 = prev_month(month_start(timezone.localdate()))
        self.buy([(p, 10, "10")], paid="100", occurred_at=local_dt(m1.replace(day=2), 9))
        self.sell([(p, 10, "20")], paid_usd="200", occurred_at=local_dt(m1.replace(day=5), 12))
        sh = self.api("post", "/api/shareholders/",
                      {"name": "Ali", "share_percentage": "30", "wallet_start_month": m1.isoformat()},
                      expect=201).data
        self.api("get", "/api/shareholders/wallets/")
        credit = ShareholderWalletCredit.objects.get(shareholder_id=sh["id"], month=m1)
        self.assertMoney(credit.amount_usd, "30")  # 30% of 100
        self.api("patch", f"/api/shareholders/{sh['id']}/", {"share_percentage": "10"})
        self.api("post", "/api/shareholders/recalculate-month/", {"month": m1.strftime("%Y-%m")})
        credit.refresh_from_db()
        self.assertMoney(credit.amount_usd, "30")
