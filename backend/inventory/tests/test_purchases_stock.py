"""Purchases, stock (jard) counts, FIFO cost layers and supplier debt."""

from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from inventory.models import Product, ProductBatch, SupplierPayment

from .base import D, ShopTestCase


class ProductStockTests(ShopTestCase):
    def test_new_product_with_initial_stock_gets_a_cost_layer(self):
        p = self.make_product(buy="4", stock=10)
        self.assert_stock(p, 10)
        batch = ProductBatch.objects.get(product=p)
        self.assertEqual(batch.cost_price, D("4"))

    def test_manual_stock_increase_is_a_purchase_without_supplier_debt(self):
        p = self.make_product(buy="5", stock=0)
        self.api("patch", f"/api/products/{p.pk}/", {"current_stock_quantity": 7})
        self.assert_stock(p, 7)
        out = self.api("get", "/api/dashboard/stats/?from=%s&to=%s" % (self.today(), self.today()))
        self.assertEqual(out.status_code, 200)
        # Nobody can be paid for this, so it must not count as money owed.
        snap = self.cashier()
        self.assertMoney(snap["supplier_debt_usd"], "0")

    def test_manual_stock_decrease_is_loss_expense_but_not_cash(self):
        p = self.make_product(buy="5", stock=10)
        self.api("patch", f"/api/products/{p.pk}/", {"current_stock_quantity": 6})
        self.assert_stock(p, 6)
        snap = self.cashier()
        self.assertMoney(snap["expenses_usd"], "0", "write-off must not take cash from the drawer")
        totals = self.profit()
        self.assertMoney(totals["total_expenses_usd"], "20", "4 units x $5 is a loss in profit")

    def test_editing_name_does_not_touch_stock_sold_meanwhile(self):
        p = self.make_product(buy="5", stock=10)
        self.sell([(p, 3, "8")], paid_usd="24")
        # Edit form without a stock field (frontend now only sends changed stock).
        self.api("patch", f"/api/products/{p.pk}/", {"name": "Renamed"})
        self.assert_stock(p, 7)

    def test_discontinue_then_restore_resets_stock_and_layers(self):
        p = self.make_product(buy="5", stock=4)
        self.api("patch", f"/api/products/{p.pk}/", {"is_discontinued": True})
        self.assert_stock(p, 0)
        self.api("patch", f"/api/products/{p.pk}/", {"is_discontinued": False})
        self.assert_stock(p, 0)


class PurchaseTests(ShopTestCase):
    def test_purchase_adds_stock_and_layer_and_updates_buy_price(self):
        p = self.make_product(buy="5")
        self.buy([(p, 10, "6")], paid="60")
        self.assert_stock(p, 10)
        p.refresh_from_db()
        self.assertEqual(p.buy_price, D("6"))

    def test_damaged_units_never_enter_stock(self):
        p = self.make_product(buy="5")
        self.buy([(p, 10, "5", 3)], paid="50")
        self.assert_stock(p, 7)

    def test_purchase_on_credit_is_supplier_debt(self):
        p = self.make_product()
        self.buy([(p, 10, "10")], paid="0")
        out = self.api("get", f"/api/purchases/company-outstanding/?company_id={self.company.pk}").data
        self.assertMoney(out["outstanding_usd"], "100")

    def test_supplier_discount_reduces_debt(self):
        p = self.make_product()
        self.buy([(p, 10, "10")], paid="0", discount="15")
        out = self.api("get", f"/api/purchases/company-outstanding/?company_id={self.company.pk}").data
        self.assertMoney(out["outstanding_usd"], "85")

    def test_edit_purchase_quantity_moves_stock(self):
        p = self.make_product()
        pur = self.buy([(p, 10, "10")], paid="100")
        body = {
            "lines": [{"product": p.pk, "quantity": 12, "unit_cost_usd": "10", "damaged_quantity": 0}],
        }
        self.api("patch", f"/api/purchases/{pur['id']}/", body)
        self.assert_stock(p, 12)

    def test_edit_purchase_blocked_after_its_stock_was_sold(self):
        p = self.make_product()
        pur = self.buy([(p, 10, "10")], paid="100")
        self.sell([(p, 2, "15")], paid_usd="30")
        body = {
            "lines": [{"product": p.pk, "quantity": 12, "unit_cost_usd": "10", "damaged_quantity": 0}],
        }
        self.api("patch", f"/api/purchases/{pur['id']}/", body, expect=400)
        self.assert_stock(p, 8)

    def test_selling_more_than_stock_then_buying_keeps_layers_in_sync(self):
        p = self.make_product(buy="10")
        self.sell([(p, 5, "15")], paid_usd="75")
        self.assertEqual(self.stock_of(p), -5)
        self.buy([(p, 10, "10")], paid="100")
        self.assert_stock(p, 5)


class PurchaseReturnTests(ShopTestCase):
    def test_return_to_supplier_reduces_stock_and_debt(self):
        p = self.make_product()
        pur = self.buy([(p, 100, "10")], paid="0")
        self.return_purchase(pur, {0: 30})
        self.assert_stock(p, 70)
        out = self.api("get", f"/api/purchases/company-outstanding/?company_id={self.company.pk}").data
        self.assertMoney(out["outstanding_usd"], "700")

    def test_return_on_paid_invoice_credits_suppliers_other_debt(self):
        p = self.make_product()
        paid_invoice = self.buy([(p, 10, "10")], paid="100")
        self.buy([(p, 10, "10")], paid="0")
        self.return_purchase(paid_invoice, {0: 3})          # $30 credit on a fully paid invoice
        url = f"/api/purchases/company-outstanding/?company_id={self.company.pk}"
        self.assertMoney(self.api("get", url).data["outstanding_usd"], "70")
        self.assertMoney(self.cashier()["supplier_debt_usd"], "70")
        # Paying the netted amount clears the supplier completely.
        res = self.api("post", "/api/purchases/pay-supplier/", {"company_id": self.company.pk, "amount_paid_usd": "70"}).data
        self.assertMoney(res["applied_usd_eq"], "70")
        self.assertMoney(res["outstanding_usd_after"], "0")

    def test_supplier_credit_never_offsets_another_supplier(self):
        p = self.make_product()
        paid_invoice = self.buy([(p, 10, "10")], paid="100")
        self.return_purchase(paid_invoice, {0: 5})          # $50 credit with supplier A
        other = self.company.__class__.objects.create(shop=self.shop, name="Supplier B")
        self.company = other
        self.buy([(p, 10, "10")], paid="0")                 # $100 owed to supplier B
        url = f"/api/purchases/company-outstanding/?company_id={other.pk}"
        self.assertMoney(self.api("get", url).data["outstanding_usd"], "100")
        self.assertMoney(self.cashier()["supplier_debt_usd"], "100", "A's credit must not reduce B's debt")

    def test_damaged_units_are_returned_first_without_touching_stock(self):
        p = self.make_product()
        pur = self.buy([(p, 10, "5", 3)], paid="50")
        self.assert_stock(p, 7)
        self.return_purchase(pur, {0: 3})
        self.assert_stock(p, 7)
        self.return_purchase(pur, {0: 7})
        self.assert_stock(p, 0)

    def test_cannot_return_more_than_bought(self):
        p = self.make_product()
        pur = self.buy([(p, 5, "5")], paid="25")
        self.return_purchase(pur, {0: 4})
        self.return_purchase(pur, {0: 2}, expect=400)
        self.assert_stock(p, 1)


class SupplierPaymentTests(ShopTestCase):
    def test_paying_old_supplier_debt_counts_today_not_on_purchase_date(self):
        p = self.make_product()
        old = timezone.now() - timedelta(days=40)
        self.buy([(p, 10, "10")], paid="0", occurred_at=old)
        before_old_day = self.cashier(old.date().isoformat())["company_payments_usd"]
        res = self.api(
            "post",
            "/api/purchases/pay-supplier/",
            {"company_id": self.company.pk, "amount_paid_usd": "40"},
        ).data
        self.assertMoney(res["applied_usd_eq"], "40")
        self.assertMoney(self.cashier()["company_payments_usd"], "40")
        self.assertMoney(self.cashier(old.date().isoformat())["company_payments_usd"], before_old_day)
        self.assertEqual(SupplierPayment.objects.count(), 1)
        out = self.api("get", f"/api/purchases/company-outstanding/?company_id={self.company.pk}").data
        self.assertMoney(out["outstanding_usd"], "60")

    def test_supplier_overpayment_only_applies_what_is_owed(self):
        p = self.make_product()
        self.buy([(p, 2, "10")], paid="0")
        res = self.api(
            "post",
            "/api/purchases/pay-supplier/",
            {"company_id": self.company.pk, "amount_paid_usd": "50"},
        ).data
        self.assertMoney(res["applied_usd_eq"], "20")
        self.assertMoney(res["overpaid_usd_eq"], "30")
        self.assertMoney(self.cashier()["company_payments_usd"], "20")

    def test_supplier_payment_in_iqd_converts_at_rate(self):
        p = self.make_product()
        self.buy([(p, 10, "10")], paid="0")
        res = self.api(
            "post",
            "/api/purchases/pay-supplier/",
            {"company_id": self.company.pk, "amount_paid_iqd": "30000"},
        ).data
        self.assertMoney(res["applied_usd_eq"], "20")


class FifoCostTests(ShopTestCase):
    def test_sale_cost_uses_oldest_layer_first(self):
        p = self.make_product(buy="1")
        self.buy([(p, 1, "1")], paid="1")
        self.buy([(p, 1, "3")], paid="3")
        self.sell([(p, 1, "10")], paid_usd="10")
        totals = self.profit()
        self.assertMoney(totals["sum_sale_line_buy_prices_usd"], "1", "first unit costs $1 (FIFO)")
        self.assertEqual(Product.objects.get(pk=p.pk).current_stock_quantity, 1)

    def test_stock_value_is_fifo_cost_not_latest_price(self):
        p = self.make_product(buy="1")
        self.buy([(p, 5, "1")], paid="5")
        self.buy([(p, 5, "3")], paid="15")
        snap = self.cashier()
        self.assertMoney(snap["total_stock_value_usd"], "20")
