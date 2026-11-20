"""Owner rule: selling without stock is allowed; a later purchase fills the negative first."""

from __future__ import annotations

from inventory.models import ProductBatch, SaleLine

from .base import D, ShopTestCase


class NegativeStockRefillTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(name="Cover", buy="1", stock=0)

    def sell(self, qty, price="3"):
        from django.utils import timezone

        from .base import RATE

        return self.api("post", "/api/sales/", {
            "occurred_at": timezone.now().isoformat(),
            "exchange_rate_usd_to_iqd": str(RATE),
            "invoice_discount_usd": "0",
            "amount_paid_usd": str(D(price) * qty),
            "amount_paid_iqd": "0",
            "customer": self.customer.pk,
            "lines": [{"product": self.p.pk, "quantity": qty, "unit_price_usd": price}],
        }, expect=201).data

    def test_oversell_then_partial_purchase_leaves_remaining_negative(self):
        self.sell(1000)
        self.assert_stock(self.p, -1000)
        self.buy([(self.p, 400, "2")], paid="800")
        self.assert_stock(self.p, -600)
        self.buy([(self.p, 700, "2")], paid="1400")
        self.assert_stock(self.p, 100)
        # FIFO layers on hand agree with the stock count.
        remaining = sum(b.remaining_quantity for b in ProductBatch.objects.filter(product=self.p))
        self.assertEqual(remaining, 100)

    def test_oversold_units_take_the_real_purchase_cost(self):
        sale = self.sell(10)
        self.buy([(self.p, 10, "2")], paid="20")
        line = SaleLine.objects.get(sale_id=sale["id"])
        self.assertEqual(D(line.unit_buy_price_usd), D("2"))
