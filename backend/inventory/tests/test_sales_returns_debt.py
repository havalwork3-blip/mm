"""Sales, returns, customer debt, write-offs and the cash box (qasa)."""

from __future__ import annotations

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

from inventory.models import SaleLine, ShareholderWalletCredit, ShopDayOpeningCash

from .base import RATE, D, ShopTestCase


class SaleTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(buy="10")
        self.buy([(self.p, 20, "10")], paid="200")

    def test_cash_sale_reduces_stock_and_counts_in_cash_and_profit(self):
        self.sell([(self.p, 2, "25")], paid_usd="50")
        self.assert_stock(self.p, 18)
        snap = self.cashier()
        self.assertMoney(snap["pos_sale_payments_usd"], "50")
        totals = self.profit()
        self.assertMoney(totals["sum_sale_line_prices_usd"], "50")
        self.assertMoney(totals["sum_sale_line_buy_prices_usd"], "20")

    def test_credit_sale_becomes_customer_debt(self):
        sale = self.sell([(self.p, 4, "25")], paid_usd="30")
        self.assertTrue(sale["is_credit_sale"])
        self.assertMoney(sale["unpaid_balance_usd"], "70")
        self.assertMoney(self.customer_balance(), "70")

    def test_iqd_payment_converted_with_sale_rate(self):
        sale = self.sell([(self.p, 1, "25")], paid_iqd=str(25 * RATE))
        self.assertFalse(sale["is_credit_sale"])
        self.assertMoney(self.customer_balance(), "0")

    def test_whole_iqd_rounding_does_not_create_debt(self):
        # $10.33 at 1310 = 13,532.3 IQD; the POS sends whole dinars.
        sale = self.sell([(self.p, 1, "10.33")], paid_iqd="13532", rate="1310")
        self.assertFalse(sale["is_credit_sale"])
        self.assertMoney(self.customer_balance(), "0")

    def test_mixed_usd_and_iqd_payment(self):
        sale = self.sell([(self.p, 2, "25")], paid_usd="20", paid_iqd=str(30 * RATE))
        self.assertFalse(sale["is_credit_sale"])

    def test_invoice_discount_reduces_amount_owed_and_profit(self):
        sale = self.sell([(self.p, 2, "25")], paid_usd="40", discount="10")
        self.assertFalse(sale["is_credit_sale"])
        totals = self.profit()
        self.assertMoney(totals["total_customer_discounts_usd"], "10")

    def test_negative_amounts_are_rejected(self):
        self.sell([(self.p, 1, "25")], paid_usd="-5", expect=400)
        self.sell([(self.p, 1, "25")], discount="-5", expect=400)
        self.sell([(self.p, 1, "25")], rate="0", expect=400)
        self.assert_stock(self.p, 20)

    def test_edit_sale_quantity_restores_and_deducts_stock(self):
        sale = self.sell([(self.p, 5, "25")], paid_usd="125")
        body = {"lines": [{"product": self.p.pk, "quantity": 2, "unit_price_usd": "25"}]}
        self.api("patch", f"/api/sales/{sale['id']}/", body)
        self.assert_stock(self.p, 18)

    def test_cannot_sell_another_shops_product(self):
        other_cat = self.category.__class__.objects.create(shop=self.shop2, name="X")
        other = self.p.__class__.objects.create(
            shop=self.shop2,
            name="Other",
            category=other_cat,
            buy_price=1,
            sale_price_retail=1,
            sale_price_wholesale=1,
        )
        self.sell([(other, 1, "5")], paid_usd="5", expect=400)

    def test_sale_after_midnight_local_time_lands_on_local_day(self):
        baghdad = ZoneInfo("Asia/Baghdad")
        day = timezone.localdate() - timedelta(days=3)
        at = timezone.make_aware(datetime.combine(day, time(1, 30)), baghdad)
        self.sell([(self.p, 1, "25")], paid_usd="25", occurred_at=at)
        self.assertMoney(self.cashier(day.isoformat())["pos_sale_payments_usd"], "25")
        prev = (day - timedelta(days=1)).isoformat()
        self.assertMoney(self.cashier(prev)["pos_sale_payments_usd"], "0")
        self.assertMoney(self.profit(day.isoformat())["sum_sale_line_prices_usd"], "25")


class SaleReturnTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(buy="10")
        self.buy([(self.p, 20, "10")], paid="200")

    def test_cash_return_on_paid_sale(self):
        sale = self.sell([(self.p, 2, "50")], paid_usd="100")
        res = self.return_sale(sale, {0: 1})
        self.assertMoney(res["cash_refund_usd"], "50")
        self.assertMoney(res["debt_reduced_usd"], "0")
        self.assert_stock(self.p, 19)
        snap = self.cashier()
        self.assertMoney(snap["current_cash_usd"], D("100") - D("50") - D("200"))

    def test_return_on_unpaid_sale_only_reduces_debt(self):
        sale = self.sell([(self.p, 2, "50")], paid_usd="0")
        res = self.return_sale(sale, {0: 1}, refund_method="cash")
        self.assertMoney(res["cash_refund_usd"], "0", "no cash back for goods never paid")
        self.assertMoney(self.customer_balance(), "50")
        self.assertMoney(self.cashier()["sale_returns_usd"], "0")

    def test_return_on_partly_paid_sale_splits_cash_and_debt(self):
        sale = self.sell([(self.p, 2, "50")], paid_usd="80")
        res = self.return_sale(sale, {0: 1}, refund_method="debt_reduction")
        self.assertMoney(res["debt_reduced_usd"], "20")
        self.assertMoney(res["cash_refund_usd"], "30")
        self.assertMoney(self.customer_balance(), "0")
        self.assertMoney(self.cashier()["sale_returns_usd"], "30")

    def test_return_takes_its_share_of_invoice_discount(self):
        sale = self.sell([(self.p, 2, "50")], paid_usd="90", discount="10")
        res = self.return_sale(sale, {0: 2})
        self.assertMoney(res["total_refund_usd"], "90", "refund what was paid, not list price")
        totals = self.profit()
        self.assertMoney(totals["sum_sale_line_prices_usd"], "0")
        self.assertMoney(totals["total_customer_discounts_usd"], "0")

    def test_cannot_return_more_than_sold(self):
        sale = self.sell([(self.p, 2, "50")], paid_usd="100")
        self.return_sale(sale, {0: 2})
        self.return_sale(sale, {0: 1}, expect=400)
        self.assert_stock(self.p, 20)

    def test_sale_with_returns_cannot_be_edited(self):
        sale = self.sell([(self.p, 2, "50")], paid_usd="100")
        self.return_sale(sale, {0: 1})
        body = {"lines": [{"product": self.p.pk, "quantity": 1, "unit_price_usd": "50"}]}
        self.api("patch", f"/api/sales/{sale['id']}/", body, expect=400)

    def test_partial_return_keeps_cost_of_units_still_sold(self):
        p = self.make_product(name="Layered", buy="1")
        self.buy([(p, 1, "1")], paid="1")
        self.buy([(p, 1, "3")], paid="3")
        sale = self.sell([(p, 2, "10")], paid_usd="20")
        self.return_sale(sale, {0: 1})
        line = SaleLine.objects.get(pk=sale["lines"][0]["id"])
        # The $3 layer went back on the shelf, so the unit still sold cost $1.
        self.assertEqual(line.unit_buy_price_usd, D("1"))
        self.assert_stock(p, 1)


class CustomerDebtTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(buy="10")
        self.buy([(self.p, 50, "10")], paid="500")

    def collect(self, usd="0", iqd="0", expect=200):
        return self.api(
            "post",
            f"/api/customers/{self.customer.pk}/collect-payment/",
            {"amount_paid_usd": usd, "amount_paid_iqd": iqd},
            expect=expect,
        ).data

    def test_debt_payment_pays_oldest_sale_first_and_counts_today(self):
        old = timezone.now() - timedelta(days=10)
        s1 = self.sell([(self.p, 1, "100")], occurred_at=old)
        s2 = self.sell([(self.p, 1, "30")])
        res = self.collect(usd="100")
        self.assertMoney(res["applied_usd_eq"], "100")
        self.assertMoney(self.customer_balance(), "30")
        s1_now = self.api("get", f"/api/sales/{s1['id']}/").data
        s2_now = self.api("get", f"/api/sales/{s2['id']}/").data
        self.assertMoney(s1_now["unpaid_balance_usd"], "0")
        self.assertMoney(s2_now["unpaid_balance_usd"], "30")
        self.assertMoney(self.cashier()["customer_debt_receipts_usd"], "100")

    def test_overpayment_counts_only_what_was_owed(self):
        self.sell([(self.p, 1, "30")])
        res = self.collect(usd="50")
        self.assertMoney(res["applied_usd_eq"], "30")
        self.assertMoney(res["overpaid_usd_eq"], "20")
        self.assertMoney(self.cashier()["customer_debt_receipts_usd"], "30")

    def test_payment_in_iqd(self):
        self.sell([(self.p, 1, "30")])
        self.collect(iqd=str(30 * RATE))
        self.assertMoney(self.customer_balance(), "0")

    def test_editing_a_paid_sale_moves_payment_to_other_debt(self):
        old = timezone.now() - timedelta(days=10)
        s1 = self.sell([(self.p, 1, "100")], occurred_at=old)
        self.sell([(self.p, 1, "30")])
        self.collect(usd="100")
        body = {
            "occurred_at": old.isoformat(),
            "lines": [{"product": self.p.pk, "quantity": 1, "unit_price_usd": "50"}],
        }
        self.api("patch", f"/api/sales/{s1['id']}/", body)
        # Paid $100 for $80 of goods: nothing owed (the $20 extra is credit).
        self.assertMoney(self.customer_balance(), "0")

    def test_small_debt_write_off(self):
        self.sell([(self.p, 1, "25")], paid_usd="20")
        self.api("post", f"/api/customers/{self.customer.pk}/write-off-remainder-as-discount/", {})
        self.assertMoney(self.customer_balance(), "0")
        self.assertMoney(self.profit()["total_customer_discounts_usd"], "5")

    def test_write_off_after_return_clears_debt_fully(self):
        sale = self.sell([(self.p, 10, "10")], paid_usd="45")
        self.return_sale(sale, {0: 5})
        self.assertMoney(self.customer_balance(), "5")
        self.api("post", f"/api/customers/{self.customer.pk}/write-off-remainder-as-discount/", {})
        self.assertMoney(self.customer_balance(), "0")

    def test_large_debt_cannot_be_written_off(self):
        self.sell([(self.p, 1, "100")])
        res = self.client.post(
            f"/api/customers/{self.customer.pk}/write-off-remainder-as-discount/",
            {},
            format="json",
        )
        self.assertGreaterEqual(res.status_code, 400)
        self.assertMoney(self.customer_balance(), "100")

    def test_write_off_counts_on_its_own_month_only(self):
        old = timezone.now() - timedelta(days=70)
        self.sell([(self.p, 1, "25")], paid_usd="20", occurred_at=old)
        old_day = old.date().isoformat()
        before = self.profit(old_day)["total_customer_discounts_usd"]
        self.api("post", f"/api/customers/{self.customer.pk}/write-off-remainder-as-discount/", {})
        self.assertMoney(self.profit(old_day)["total_customer_discounts_usd"], before)
        self.assertMoney(self.profit()["total_customer_discounts_usd"], "5")


class CashBoxTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(buy="10")

    def test_all_movements_add_up_to_current_cash(self):
        today = timezone.localdate()
        self.api("post", "/api/cashier/opening/", {"for_date": self.today(), "opening_cash_usd": "1000"})
        self.buy([(self.p, 10, "10")], paid="100")                              # -100
        self.sell([(self.p, 2, "50")], paid_usd="100")                          # +100
        self.sell([(self.p, 1, "50")], paid_usd="0")                            # credit
        self.api(
            "post",
            f"/api/customers/{self.customer.pk}/collect-payment/",
            {"amount_paid_usd": "20"},
        )                                                                       # +20
        self.api(
            "post",
            "/api/expenses/",
            {"name": "Rent", "amount": str(15 * RATE), "currency": "IQD", "occurred_on": self.today()},
            expect=201,
        )                                                                       # -15
        sh = self.api("post", "/api/shareholders/", {"name": "Partner", "share_percentage": "50"}, expect=201)
        # Partner earned $40 last month (credited to the wallet), paid out today.
        ShareholderWalletCredit.objects.create(
            shop=self.shop,
            shareholder_id=sh.data["id"],
            month=(today.replace(day=1) - timedelta(days=1)).replace(day=1),
            shop_net_profit_usd=D("80"),
            share_percentage=D("50"),
            amount_usd=D("40"),
        )
        self.api(
            "post",
            "/api/shareholder-payments/",
            {
                "shareholder": sh.data["id"],
                "amount_usd": "40",
                "paid_on": self.today(),
                "period_from": self.today(),
                "period_to": self.today(),
            },
            expect=201,
        )                                                                       # -40
        self.api(
            "post",
            "/api/employee-debts/",
            {"employee": self.employee.pk, "amount": "5", "debt_type": "taken", "occurred_on": self.today()},
            expect=201,
        )                                                                       # -5
        snap = self.cashier()
        self.assertMoney(snap["current_cash_usd"], "960")
        ledger = self.api("get", f"/api/cashier/ledger/?from={today}&to={today}").data
        rows = ledger["entries"] if isinstance(ledger, dict) else ledger
        kinds = {r["kind"] for r in rows}
        for kind in ("opening_cash", "sale_payment", "customer_debt_payment", "expense",
                     "purchase_payment", "shareholder_payment", "employee_debt"):
            self.assertIn(kind, kinds)

    def test_opening_cash_carries_forward_with_movements(self):
        d0 = timezone.localdate() - timedelta(days=5)
        ShopDayOpeningCash.objects.create(shop=self.shop, for_date=d0, opening_cash_usd=D("1000"))
        self.buy([(self.p, 10, "10")], paid="0")
        at = timezone.make_aware(datetime.combine(d0, time(12, 0)), ZoneInfo("Asia/Baghdad"))
        self.sell([(self.p, 1, "50")], paid_usd="50", occurred_at=at)
        d2 = (d0 + timedelta(days=2)).isoformat()
        self.assertMoney(self.cashier(d2)["opening_cash_usd"], "1050")
