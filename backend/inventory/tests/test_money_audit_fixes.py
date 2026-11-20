"""Regression tests for the money-audit fixes (overpayment, debt payment edits, discounts)."""

from __future__ import annotations

from inventory.models import CustomerDebtPayment, Sale

from .base import RATE, D, ShopTestCase


class CheckoutOverpaymentTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(buy="10")
        self.buy([(self.p, 20, "10")], paid="200")

    def test_usd_overpayment_is_change_not_drawer_cash(self):
        sale = self.sell([(self.p, 1, "30")], paid_usd="50")
        self.assertMoney(sale["amount_paid_usd"], "30")
        self.assertMoney(self.cashier()["pos_sale_payments_usd"], "30")
        self.assertMoney(self.customer_balance(), "0")

    def test_iqd_overpayment_is_trimmed_to_whole_dinars(self):
        # $20 at 1500 = 30,000 IQD; customer handed 50,000.
        sale = self.sell([(self.p, 1, "20")], paid_iqd="50000")
        self.assertMoney(sale["amount_paid_iqd"], "30000")
        self.assertFalse(sale["is_credit_sale"])
        self.assertMoney(self.cashier()["pos_sale_payments_usd"], "20")

    def test_odd_rate_iqd_overpayment_still_reads_fully_paid(self):
        # $10.33 at 1310 = 13,532.3 IQD; 20,000 handed over.
        sale = self.sell([(self.p, 1, "10.33")], paid_iqd="20000", rate="1310")
        self.assertMoney(sale["amount_paid_iqd"], "13533")
        self.assertFalse(sale["is_credit_sale"])

    def test_exact_and_partial_payments_untouched(self):
        exact = self.sell([(self.p, 1, "30")], paid_usd="30")
        partial = self.sell([(self.p, 1, "30")], paid_usd="10")
        self.assertMoney(exact["amount_paid_usd"], "30")
        self.assertMoney(partial["amount_paid_usd"], "10")

    def test_editing_paid_amount_above_total_is_trimmed(self):
        sale = self.sell([(self.p, 1, "30")], paid_usd="10")
        self.api("patch", f"/api/sales/{sale['id']}/", {"amount_paid_usd": "45"})
        self.assertEqual(Sale.objects.get(pk=sale["id"]).amount_paid_usd, D("30"))

    def test_line_edit_without_discount_keeps_stored_discount_in_check(self):
        sale = self.sell([(self.p, 2, "25")], paid_usd="30", discount="20")
        body = {"lines": [{"product": self.p.pk, "quantity": 1, "unit_price_usd": "10"}]}
        # Stored $20 discount would exceed the new $10 subtotal.
        self.api("patch", f"/api/sales/{sale['id']}/", body, expect=400)


class DebtPaymentEditTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(buy="10")
        self.buy([(self.p, 20, "10")], paid="200")

    def test_editing_payment_above_debt_keeps_only_applied_part(self):
        self.sell([(self.p, 1, "50")])
        res = self.api(
            "post",
            f"/api/customers/{self.customer.pk}/collect-payment/",
            {"amount_paid_usd": "50", "amount_paid_iqd": "0"},
        ).data
        pid = res.get("payment_id") or CustomerDebtPayment.objects.get().pk
        self.api("patch", f"/api/customer-debt-payments/{pid}/", {"amount_paid_usd": "80"})
        payment = CustomerDebtPayment.objects.get(pk=pid)
        self.assertEqual(payment.amount_paid_usd, D("50"))
        self.assertMoney(self.cashier()["customer_debt_receipts_usd"], "50")
        self.assertMoney(self.customer_balance(), "0")

    def test_editing_iqd_payment_above_debt_trims_iqd(self):
        self.sell([(self.p, 1, "20")])
        self.api(
            "post",
            f"/api/customers/{self.customer.pk}/collect-payment/",
            {"amount_paid_usd": "0", "amount_paid_iqd": str(10 * RATE)},
        )
        pid = CustomerDebtPayment.objects.get().pk
        self.api("patch", f"/api/customer-debt-payments/{pid}/", {"amount_paid_iqd": str(40 * RATE)})
        payment = CustomerDebtPayment.objects.get(pk=pid)
        self.assertEqual(payment.amount_paid_iqd, D(20 * RATE))
        self.assertMoney(self.customer_balance(), "0")
