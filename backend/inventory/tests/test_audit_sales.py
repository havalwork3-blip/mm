"""
Audit: edge cases in sales, returns, discounts, customer debt and currency.

Tests that FAIL here document real calculation bugs (see the docstring of each).
"""

from __future__ import annotations

from decimal import Decimal

from django.utils import timezone

from inventory.models import Customer, Sale, SaleReturn

from .base import RATE, D, ShopTestCase


class AuditSalesTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(buy="10")
        self.buy([(self.p, 50, "10")], paid="500")

    def collect(self, customer=None, usd="0", iqd="0", expect=200):
        c = customer or self.customer
        return self.api(
            "post",
            f"/api/customers/{c.pk}/collect-payment/",
            {"amount_paid_usd": usd, "amount_paid_iqd": iqd},
            expect=expect,
        ).data

    # --- input validation ----------------------------------------------

    def _raw_sale(self, line=None, **head):
        body = {
            "occurred_at": timezone.now().isoformat(),
            "exchange_rate_usd_to_iqd": str(RATE),
            "invoice_discount_usd": "0",
            "amount_paid_usd": "0",
            "amount_paid_iqd": "0",
            "customer": self.customer.pk,
            "lines": [line or {"product": self.p.pk, "quantity": 1, "unit_price_usd": "10"}],
        }
        body.update(head)
        return self.client.post("/api/sales/", body, format="json")

    def test_api_rejects_negative_and_zero_inputs(self):
        bad = [
            self._raw_sale({"product": self.p.pk, "quantity": 0, "unit_price_usd": "10"}),
            self._raw_sale({"product": self.p.pk, "quantity": -2, "unit_price_usd": "10"}),
            self._raw_sale({"product": self.p.pk, "quantity": 1, "unit_price_usd": "-10"}),
            self._raw_sale(invoice_discount_usd="-5"),
            self._raw_sale(invoice_discount_usd="10.01"),
            self._raw_sale(amount_paid_usd="-1"),
            self._raw_sale(amount_paid_iqd="-1500"),
            self._raw_sale(exchange_rate_usd_to_iqd="0"),
        ]
        for i, res in enumerate(bad):
            self.assertEqual(res.status_code, 400, f"case {i}: {getattr(res, 'data', None)}")
        self.assert_stock(self.p, 50)

    def test_return_zero_or_negative_qty_rejected(self):
        sale = self.sell([(self.p, 2, "10")], paid_usd="20")
        self.return_sale(sale, {0: 0}, expect=400)
        self.return_sale(sale, {0: -1}, expect=400)
        # Same line twice in one request, summing above sold quantity.
        res = self.client.post(
            "/api/sales/return-products/",
            {
                "sale_id": sale["id"],
                "lines": [
                    {"sale_line_id": sale["lines"][0]["id"], "quantity": 2},
                    {"sale_line_id": sale["lines"][0]["id"], "quantity": 1},
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assert_stock(self.p, 48)

    # --- discount + return rounding --------------------------------------

    def test_discount_ratio_rounding_never_refunds_more_than_paid(self):
        """
        3000 units @ $1, invoice discount $1000, paid $2000 in full.
        Ratio = 2/3, per-unit refund is quantized to 0.6667, so returning all
        3000 units hands back 3000 * 0.6667 = $2000.10 for a $2000 sale.
        """
        self.buy([(self.p, 3000, "0.5")], paid="1500")
        sale = self.sell([(self.p, 3000, "1")], discount="1000", paid_usd="2000")
        out = self.return_sale(sale, {0: 3000})
        self.assertLessEqual(D(out["cash_refund_usd"]), D("2000"), out)

    def test_discount_ratio_split_returns_sum_to_paid(self):
        """3 x $1, discount $1, paid $2. Returning 1+1+1 refunds 3 x 0.6667 = 2.0001."""
        sale = self.sell([(self.p, 3, "1")], discount="1", paid_usd="2")
        total = Decimal("0")
        for _ in range(3):
            total += D(self.return_sale(sale, {0: 1})["cash_refund_usd"])
        self.assertLessEqual(total, D("2"))

    def test_discount_return_partial_payment_balance(self):
        sale = self.sell([(self.p, 2, "50")], discount="20", paid_usd="30")
        self.assertMoney(self.customer_balance(), "50")
        out = self.return_sale(sale, {0: 1})
        self.assertMoney(out["total_refund_usd"], "40")
        self.assertMoney(out["debt_reduced_usd"], "40")
        self.assertMoney(out["cash_refund_usd"], "0")
        self.assertMoney(self.customer_balance(), "10")
        out = self.return_sale(sale, {0: 1})
        # 30 paid, nothing left owed: the last unit's 40 = 10 debt + 30 cash.
        self.assertMoney(out["debt_reduced_usd"], "10")
        self.assertMoney(out["cash_refund_usd"], "30")
        self.assertMoney(self.customer_balance(), "0")

    def test_return_after_debt_payment_refunds_cash(self):
        sale = self.sell([(self.p, 2, "50")])
        self.collect(usd="100")
        out = self.return_sale(sale, {0: 1})
        self.assertMoney(out["cash_refund_usd"], "50")
        self.assertMoney(self.customer_balance(), "0")

    # --- write-off after a discounted return -----------------------------

    def test_writeoff_allowed_after_return_on_discounted_sale(self):
        """
        Sale 2 x $10 with $10 discount, paid $3. Return 1 unit (worth $5 after
        its discount share) -> $2 still owed. Writing off $2 is legitimate
        (effective discount would be 5 + 2 = 7 <= net lines 10), but
        apply_customer_debt_remainder_as_discount compares the RAW stored
        discount 10 + 2 = 12 against the post-return line subtotal 10.
        """
        sale = self.sell([(self.p, 2, "10")], discount="10", paid_usd="3")
        self.return_sale(sale, {0: 1})
        self.assertMoney(self.customer_balance(), "2")
        self.api("post", f"/api/customers/{self.customer.pk}/write-off-remainder-as-discount/", {})
        self.assertMoney(self.customer_balance(), "0")

    # --- debt payments and later sale edits -------------------------------

    def test_changing_sale_customer_does_not_let_old_payment_pay_new_customer(self):
        """
        Customer X buys $100 on credit and pays it via debt collection. The sale
        is then edited to belong to customer Y. X's payment allocation stays on
        the sale, so Y's balance shows 0 although Y never paid anything.
        """
        y = Customer.objects.create(shop=self.shop, name="Other", phone_1="07502222222")
        sale = self.sell([(self.p, 1, "100")])
        self.collect(usd="100")
        self.api(
            "patch",
            f"/api/sales/{sale['id']}/",
            {
                "customer": y.pk,
                "lines": [{"product": self.p.pk, "quantity": 1, "unit_price_usd": "100"}],
            },
        )
        self.assertMoney(self.customer_balance(y), "100")

    def test_freed_payment_is_credited_to_next_sale(self):
        """
        Customer pays $100 debt on a $100 sale. Sale is edited down to $60 so
        $40 of the payment is freed. Nothing else is owed at that moment, so
        rebalance drops the $40 (allocation rows deleted). The customer's next
        $40 credit sale is still fully owed although the drawer holds $100.
        """
        sale = self.sell([(self.p, 1, "100")])
        self.collect(usd="100")
        self.api(
            "patch",
            f"/api/sales/{sale['id']}/",
            {"lines": [{"product": self.p.pk, "quantity": 1, "unit_price_usd": "60"}]},
        )
        self.sell([(self.p, 1, "40")])
        self.assertMoney(self.customer_balance(), "0")

    # --- oversold stock then returned ------------------------------------

    def test_return_of_oversold_sale_keeps_fifo_in_sync(self):
        """
        Stock 0, sell 2 (oversold -> phantom 0-qty batch gets a deduction row).
        Returning both restores 2 units into that phantom batch while
        current_stock goes -2 -> 0: batches say 2 on hand, stock says 0.
        """
        q = self.make_product(name="Ghost", buy="5")
        sale = self.sell([(q, 2, "8")], paid_usd="16")
        self.assertEqual(self.stock_of(q), -2)
        self.return_sale(sale, {0: 2})
        self.assert_stock(q, 0)

    def test_partial_return_of_partly_oversold_sale(self):
        q = self.make_product(name="Half", buy="5")
        self.buy([(q, 3, "5")], paid="15")
        sale = self.sell([(q, 5, "8")], paid_usd="40")
        self.return_sale(sale, {0: 2})
        self.assert_stock(q, 0)

    # --- currency ------------------------------------------------------

    def test_mixed_currency_overpayment_trim(self):
        sale = self.sell([(self.p, 1, "10")], paid_usd="5", paid_iqd="10000")
        s = Sale.objects.get(pk=sale["id"])
        self.assertMoney(s.amount_paid_usd, "5")
        self.assertMoney(s.amount_paid_iqd, "7500")
        self.assertMoney(self.customer_balance(), "0")

    def test_iqd_debt_payment_odd_rate(self):
        self.sell([(self.p, 1, "7.33")], rate=D("1310.5"))
        Sale.objects.update()  # no-op
        # Collect uses latest shop rate (1500): 7.33 * 1500 = 10995 IQD.
        self.collect(iqd="10995")
        self.assertMoney(self.customer_balance(), "0")

    def test_receipt_returned_total_matches_refunds(self):
        sale = self.sell([(self.p, 3, "10")], discount="3", paid_usd="27")
        out1 = self.return_sale(sale, {0: 1})
        out2 = self.return_sale(sale, {0: 1})
        got = self.api("get", f"/api/sales/{sale['id']}/").data
        self.assertMoney(
            got["returned_total_usd"],
            D(out1["total_refund_usd"]) + D(out2["total_refund_usd"]),
        )
        self.assertMoney(got["unpaid_balance_usd"], "0")
        self.assertEqual(SaleReturn.objects.filter(sale_id=sale["id"]).count(), 2)

    def test_walk_in_credit_sale_is_rejected_or_tracked(self):
        """
        A sale with no customer and partial payment used to be accepted: its unpaid
        $60 landed in total receivables (dashboard) but in no customer's debt, so it
        could never be collected. It must now be rejected, and receivables stay in sync.
        """
        self.sell([(self.p, 1, "100")], paid_usd="40", customer=False, expect=400)
        # A fully paid walk-in sale is still fine.
        self.sell([(self.p, 1, "100")], paid_usd="100", customer=False)
        summary = self.api("get", "/api/customers/debt-summary/").data
        from inventory.dashboard_tools import total_receivables_usd

        self.assertMoney(total_receivables_usd(self.shop.pk), summary["total_outstanding_usd"])
