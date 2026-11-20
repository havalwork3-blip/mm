"""
Audit: FIFO costing, purchases, returns, stock adjustments, supplier debt.

Tests whose name starts with ``test_bug_`` reproduce a confirmed calculation
bug and are EXPECTED TO FAIL until the production code is fixed. The other
tests document behaviour that was checked and found correct.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from inventory.dashboard_tools import company_outstanding_usd, total_stock_value_usd
from inventory.models import Product, ProductBatch, SaleLine

from .base import D, ShopTestCase


def _ago(minutes: int):
    return timezone.now() - timedelta(minutes=minutes)


class FifoCorrectBehaviourTests(ShopTestCase):
    def test_sale_across_three_batches_weighted_cost(self):
        p = self.make_product(buy="1")
        self.buy([(p, 2, "1")], paid="2", occurred_at=_ago(30))
        self.buy([(p, 3, "2")], paid="6", occurred_at=_ago(20))
        self.buy([(p, 5, "4")], paid="20", occurred_at=_ago(10))
        sale = self.sell([(p, 7, "10")], paid_usd="70")
        line = SaleLine.objects.get(pk=sale["lines"][0]["id"])
        # 2*1 + 3*2 + 2*4 = 16 -> 16/7 = 2.2857
        self.assertEqual(line.unit_buy_price_usd, D("2.2857"))
        self.assert_stock(p, 3)
        self.assertMoney(total_stock_value_usd(self.shop.pk), "12")
        totals = self.profit()
        self.assertMoney(totals["sum_sale_line_buy_prices_usd"], "16")

    def test_partial_return_restores_newest_layer_and_reprices_line(self):
        p = self.make_product(buy="1")
        self.buy([(p, 1, "10")], paid="10", occurred_at=_ago(20))
        self.buy([(p, 2, "20")], paid="40", occurred_at=_ago(10))
        sale = self.sell([(p, 3, "30")], paid_usd="90")
        self.return_sale(sale, {0: 1})
        self.assert_stock(p, 1)
        # Returned unit goes back on the $20 layer; remaining sold units cost 10+20
        self.assertMoney(total_stock_value_usd(self.shop.pk), "20")
        totals = self.profit()
        self.assertMoney(totals["sum_sale_line_buy_prices_usd"], "30")

    def test_return_then_resell_uses_restored_layer_cost(self):
        p = self.make_product(buy="1")
        self.buy([(p, 1, "10")], paid="10", occurred_at=_ago(20))
        self.buy([(p, 1, "20")], paid="20", occurred_at=_ago(10))
        sale = self.sell([(p, 1, "30")], paid_usd="30")
        self.return_sale(sale, {0: 1})
        self.sell([(p, 2, "30")], paid_usd="60")
        self.assert_stock(p, 0)
        totals = self.profit()
        self.assertMoney(totals["sum_sale_line_buy_prices_usd"], "30")

    def test_edit_purchase_price_before_any_sale_reprices_layer(self):
        p = self.make_product(buy="1")
        pur = self.buy([(p, 10, "5")], paid="0")
        self.api(
            "patch",
            f"/api/purchases/{pur['id']}/",
            {"lines": [{"product": p.pk, "quantity": 10, "unit_cost_usd": "7", "damaged_quantity": 0}]},
        )
        self.assert_stock(p, 10)
        self.assertEqual(ProductBatch.objects.get(product=p, remaining_quantity__gt=0).cost_price, D("7"))
        self.assertMoney(company_outstanding_usd(self.shop.pk, self.company.pk), "70")

    def test_edit_purchase_after_partial_sale_is_refused(self):
        p = self.make_product(buy="1")
        pur = self.buy([(p, 10, "5")], paid="0")
        self.sell([(p, 4, "9")], paid_usd="36")
        self.api(
            "patch",
            f"/api/purchases/{pur['id']}/",
            {"lines": [{"product": p.pk, "quantity": 10, "unit_cost_usd": "7", "damaged_quantity": 0}]},
            expect=400,
        )
        self.assert_stock(p, 6)

    def test_sale_edit_reducing_quantity_restores_original_layers(self):
        p = self.make_product(buy="1")
        self.buy([(p, 2, "10")], paid="20", occurred_at=_ago(20))
        self.buy([(p, 2, "20")], paid="40", occurred_at=_ago(10))
        sale = self.sell([(p, 3, "30")], paid_usd="90")
        self.api(
            "patch",
            f"/api/sales/{sale['id']}/",
            {"lines": [{"product": p.pk, "quantity": 1, "unit_price_usd": "30"}]},
        )
        self.assert_stock(p, 3)
        self.assertMoney(total_stock_value_usd(self.shop.pk), "50")
        self.assertEqual(SaleLine.objects.get(sale_id=sale["id"]).unit_buy_price_usd, D("10"))

    def test_manual_stock_decrease_loss_at_fifo_cost(self):
        p = self.make_product(buy="1")
        self.buy([(p, 2, "10")], paid="20", occurred_at=_ago(20))
        self.buy([(p, 2, "20")], paid="40", occurred_at=_ago(10))
        self.api("patch", f"/api/products/{p.pk}/", {"current_stock_quantity": 1})
        self.assert_stock(p, 1)
        totals = self.profit()
        self.assertMoney(totals["total_inventory_loss_usd"], "40")  # 2*10 + 1*20
        self.assertMoney(total_stock_value_usd(self.shop.pk), "20")

    def test_purchase_return_takes_from_own_batch_not_oldest(self):
        p = self.make_product(buy="1")
        self.buy([(p, 5, "4")], paid="20", occurred_at=_ago(20))
        pur2 = self.buy([(p, 5, "8")], paid="0", occurred_at=_ago(10))
        self.return_purchase(pur2, {0: 2})
        self.assert_stock(p, 8)
        self.assertMoney(total_stock_value_usd(self.shop.pk), str(5 * 4 + 3 * 8))
        self.assertMoney(company_outstanding_usd(self.shop.pk, self.company.pk), "24")

    def test_oversell_then_purchase_keeps_count_in_sync(self):
        p = self.make_product(buy="10", stock=2)
        self.sell([(p, 5, "15")], paid_usd="75")
        self.assertEqual(self.stock_of(p), -3)
        self.buy([(p, 10, "20")], paid="200")
        self.assert_stock(p, 7)


class FifoBugTests(ShopTestCase):
    def test_bug_manual_stock_increase_from_negative_leaves_extra_batches(self):
        """ProductSerializer.update: delta>0 path never calls reconcile_product_batches."""
        p = self.make_product(buy="10", stock=0)
        self.sell([(p, 3, "15")], paid_usd="45")
        self.assertEqual(self.stock_of(p), -3)
        # Count shows 5 on the shelf: user types 5.
        self.api("patch", f"/api/products/{p.pk}/", {"current_stock_quantity": 5})
        # Stock is 5, but a batch of 8 (delta) was created -> stock value counts 8 units.
        self.assertMoney(total_stock_value_usd(self.shop.pk), "50")
        self.assert_stock(p, 5)

    def test_bug_full_return_of_discounted_purchase_leaves_negative_supplier_balance(self):
        """purchase_balance_usd subtracts the whole discount even when all goods went back."""
        p = self.make_product(buy="10")
        other = self.make_product(name="Other", buy="10")
        pur = self.buy([(p, 10, "10")], paid="0", discount="20")
        self.buy([(other, 5, "10")], paid="0")  # $50 owed on a second invoice
        self.return_purchase(pur, {0: 10})
        # Everything from invoice 1 went back: supplier is owed only the $50 of invoice 2.
        self.assertMoney(company_outstanding_usd(self.shop.pk, self.company.pk), "50")

    def test_bug_oversold_units_cost_vanishes_when_stock_arrives(self):
        """Oversold units are costed at catalog buy_price; the real layer that later
        covers them is silently consumed by reconcile_product_batches (no COGS)."""
        p = self.make_product(buy="10", stock=2)  # 2 @ $10
        self.sell([(p, 5, "30")], paid_usd="150")  # 3 units oversold, costed at $10
        self.buy([(p, 10, "20")], paid="200")  # 3 of these 10 cover the oversold units
        totals = self.profit()
        cogs = D(totals["sum_sale_line_buy_prices_usd"])
        stock_val = total_stock_value_usd(self.shop.pk)
        # Money spent on goods: 20 + 200 = 220 = COGS + remaining inventory.
        self.assertMoney(cogs + stock_val, "220", f"cogs={cogs} stock={stock_val}")

    def test_bug_oversold_sale_edit_after_purchase_undervalues_stock(self):
        p = self.make_product(buy="10", stock=2)
        sale = self.sell([(p, 5, "30")], paid_usd="150")
        self.buy([(p, 10, "20")], paid="200")
        self.assert_stock(p, 7)
        # Customer actually took only 2: edit the sale.
        self.api(
            "patch",
            f"/api/sales/{sale['id']}/",
            {"lines": [{"product": p.pk, "quantity": 2, "unit_price_usd": "30"}]},
        )
        self.assert_stock(p, 10)
        # All 10 units on hand physically come from the $20 purchase.
        self.assertMoney(total_stock_value_usd(self.shop.pk), "200")

    def test_bug_zero_cost_layer_reported_at_catalog_price(self):
        """reports._effective_line_buy_price_usd treats a real $0 FIFO cost as 'missing'."""
        p = self.make_product(buy="10")
        self.buy([(p, 5, "0")], paid="0")  # free samples from supplier
        p.refresh_from_db()
        self.assertEqual(p.buy_price, D("10"))  # catalog price untouched (unit_cost 0)
        sale = self.sell([(p, 5, "3")], paid_usd="15")
        self.assertEqual(SaleLine.objects.get(pk=sale["lines"][0]["id"]).unit_buy_price_usd, D("0"))
        totals = self.profit()
        self.assertMoney(totals["sum_sale_line_buy_prices_usd"], "0")

    def test_bug_purchase_return_after_own_batch_sold_loses_cost_difference(self):
        """deduct_from_purchase_line_batch falls back to FIFO on another (dearer) layer,
        while the supplier credits only this line's cost; the gap is in no report."""
        p = self.make_product(buy="1")
        pur1 = self.buy([(p, 10, "5")], paid="50", occurred_at=_ago(20))
        self.buy([(p, 10, "8")], paid="80", occurred_at=_ago(10))
        self.sell([(p, 10, "10")], paid_usd="100")  # consumes all of pur1's layer
        self.return_purchase(pur1, {0: 5})  # supplier credits 5 * $5 = $25
        totals = self.profit()
        cogs = D(totals["sum_sale_line_buy_prices_usd"])
        stock_val = total_stock_value_usd(self.shop.pk)
        credit = D("25")
        # Spent 130, got 25 credit back -> 105 must be COGS + stock + recorded losses.
        self.assertMoney(
            cogs + stock_val + D(totals["total_inventory_loss_usd"]),
            D("130") - credit,
            f"cogs={cogs} stock={stock_val}",
        )
