"""A sale that leaves debt must be linked to a customer (otherwise the debt is uncollectable)."""

from __future__ import annotations

from inventory.models import Sale

from .base import ShopTestCase


class SaleDebtNeedsCustomerTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(buy="10")
        self.buy([(self.p, 50, "10")], paid="500")

    def _lines(self, price="100"):
        return [{"product": self.p.pk, "quantity": 1, "unit_price_usd": price}]

    def test_debt_sale_without_customer_is_rejected(self):
        res = self.sell([(self.p, 1, "100")], paid_usd="40", customer=False, expect=400)
        self.assertIn("customer", res)
        self.assertEqual(Sale.objects.count(), 0)

    def test_debt_sale_with_customer_is_accepted(self):
        sale = self.sell([(self.p, 1, "100")], paid_usd="40")
        self.assertEqual(sale["customer"], self.customer.pk)

    def test_fully_paid_walk_in_sale_is_accepted(self):
        sale = self.sell([(self.p, 1, "100")], paid_usd="100", customer=False)
        self.assertIsNone(sale["customer"])

    def test_paid_walk_in_sale_cannot_be_edited_into_debt(self):
        sale = self.sell([(self.p, 1, "100")], paid_usd="100", customer=False)
        self.api("patch", f"/api/sales/{sale['id']}/", {"amount_paid_usd": "30"}, expect=400)
        self.api(
            "put",
            f"/api/sales/{sale['id']}/",
            {
                "occurred_at": sale["occurred_at"],
                "exchange_rate_usd_to_iqd": sale["exchange_rate_usd_to_iqd"],
                "amount_paid_usd": "100",
                "amount_paid_iqd": "0",
                "lines": self._lines("150"),
            },
            expect=400,
        )

    def test_legacy_walk_in_debt_sale_stays_editable(self):
        """Old walk-in debt (made before this rule) can still be edited, just not grown."""
        sale = self.sell([(self.p, 1, "100")], paid_usd="100", customer=False)
        Sale.objects.filter(pk=sale["id"]).update(amount_paid_usd="40")  # simulate legacy data
        self.api("patch", f"/api/sales/{sale['id']}/", {"note": "fixed later"}, expect=200)
        self.api("patch", f"/api/sales/{sale['id']}/", {"amount_paid_usd": "60"}, expect=200)
        self.api("patch", f"/api/sales/{sale['id']}/", {"amount_paid_usd": "10"}, expect=400)

    def test_legacy_walk_in_debt_can_be_assigned_to_customer(self):
        sale = self.sell([(self.p, 1, "100")], paid_usd="100", customer=False)
        Sale.objects.filter(pk=sale["id"]).update(amount_paid_usd="40")
        self.api(
            "put",
            f"/api/sales/{sale['id']}/",
            {
                "customer": self.customer.pk,
                "occurred_at": sale["occurred_at"],
                "exchange_rate_usd_to_iqd": sale["exchange_rate_usd_to_iqd"],
                "amount_paid_usd": "40",
                "amount_paid_iqd": "0",
                "lines": self._lines(),
            },
            expect=200,
        )
        self.assertEqual(Sale.objects.get(pk=sale["id"]).customer_id, self.customer.pk)
