"""Edge cases that tend to crash (500) or corrupt data."""

from __future__ import annotations

from django.utils import timezone

from inventory.models import Customer

from .base import RATE, D, ShopTestCase


class DeleteInUseTests(ShopTestCase):
    def test_deleting_product_with_sales_is_refused_not_a_crash(self):
        p = self.make_product(stock=5)
        self.sell([(p, 1, "10")], paid_usd="10")
        res = self.client.delete(f"/api/products/{p.pk}/")
        self.assertIn(res.status_code, (400, 403, 405, 409), res.content[:300])
        self.assert_stock(p, 4)

    def test_deleting_category_with_products_is_refused_not_a_crash(self):
        self.make_product(stock=1)
        res = self.client.delete(f"/api/categories/{self.category.pk}/")
        self.assertLess(res.status_code, 500, res.content[:300])

    def test_deleting_customer_with_sales_keeps_sales_and_does_not_crash(self):
        p = self.make_product(stock=5)
        sale = self.sell([(p, 1, "10")], paid_usd="0")
        res = self.client.delete(f"/api/customers/{self.customer.pk}/")
        self.assertLess(res.status_code, 500, res.content[:300])
        self.api("get", f"/api/sales/{sale['id']}/")

    def test_deleting_supplier_with_purchases_does_not_crash(self):
        p = self.make_product()
        self.buy([(p, 1, "10")], paid="0")
        res = self.client.delete(f"/api/companies/{self.company.pk}/")
        self.assertLess(res.status_code, 500, res.content[:300])


class MiscFlowTests(ShopTestCase):
    def test_manual_line_without_product(self):
        body = {
            "occurred_at": timezone.now().isoformat(),
            "exchange_rate_usd_to_iqd": str(RATE),
            "amount_paid_usd": "7",
            "lines": [{"manual_name": "Repair", "quantity": 1, "unit_price_usd": "7"}],
        }
        sale = self.api("post", "/api/sales/", body, expect=201).data
        self.assertFalse(sale["is_credit_sale"])
        self.assertMoney(self.cashier()["pos_sale_payments_usd"], "7")

    def test_return_of_manual_line(self):
        body = {
            "occurred_at": timezone.now().isoformat(),
            "exchange_rate_usd_to_iqd": str(RATE),
            "amount_paid_usd": "7",
            "lines": [{"manual_name": "Repair", "quantity": 1, "unit_price_usd": "7"}],
        }
        sale = self.api("post", "/api/sales/", body, expect=201).data
        res = self.return_sale(sale, {0: 1})
        self.assertMoney(res["cash_refund_usd"], "7")

    def test_sale_without_customer_must_be_paid_or_is_still_tracked(self):
        p = self.make_product(stock=5)
        res = self.client.post(
            "/api/sales/",
            {
                "occurred_at": timezone.now().isoformat(),
                "exchange_rate_usd_to_iqd": str(RATE),
                "amount_paid_usd": "0",
                "lines": [{"product": p.pk, "quantity": 1, "unit_price_usd": "10"}],
            },
            format="json",
        )
        self.assertLess(res.status_code, 500, getattr(res, "data", None))

    def test_change_customer_on_sale_moves_debt(self):
        p = self.make_product(stock=5)
        other = Customer.objects.create(shop=self.shop, name="Other", phone_1="07502222222")
        sale = self.sell([(p, 1, "40")], paid_usd="0")
        self.api(
            "patch",
            f"/api/sales/{sale['id']}/",
            {
                "customer": other.pk,
                "lines": [{"product": p.pk, "quantity": 1, "unit_price_usd": "40"}],
            },
        )
        self.assertMoney(self.customer_balance(), "0")
        self.assertMoney(self.customer_balance(other), "40")
        self.assert_stock(p, 4)

    def test_expense_in_iqd_is_converted(self):
        res = self.api(
            "post",
            "/api/expenses/",
            {"name": "Tea", "amount": "15000", "currency": "IQD", "occurred_on": self.today()},
            expect=201,
        ).data
        self.assertMoney(res["amount_usd"], "10")
        self.api(
            "post",
            "/api/expenses/",
            {"name": "Bad", "amount": "-5", "currency": "USD", "occurred_on": self.today()},
            expect=400,
        )

    def test_employee_debt_taken_then_returned(self):
        for kind in ("taken", "returned"):
            self.api(
                "post",
                "/api/employee-debts/",
                {"employee": self.employee.pk, "amount": "25", "debt_type": kind, "occurred_on": self.today()},
                expect=201,
            )
        self.assertMoney(self.cashier()["employee_debt_cash_effect_usd"], "0")

    def test_purchase_paid_in_iqd_currency(self):
        p = self.make_product()
        body = {
            "company": self.company.pk,
            "occurred_at": timezone.now().isoformat(),
            "exchange_rate_usd_to_iqd": str(RATE),
            "amount_paid_usd": "100",
            "currency": "IQD",
            "payment_type": "cash",
            "lines": [{"product": p.pk, "quantity": 10, "unit_cost_usd": "10"}],
        }
        self.api("post", "/api/purchases/", body, expect=201)
        self.assert_stock(p, 10)
        out = self.api("get", f"/api/purchases/company-outstanding/?company_id={self.company.pk}").data
        self.assertMoney(out["outstanding_usd"], "0")

    def test_quantity_zero_or_negative_rejected(self):
        p = self.make_product(stock=5)
        self.sell([(p, 0, "10")], paid_usd="0", expect=400)
        self.sell([(p, -2, "10")], paid_usd="0", expect=400)
        self.buy([(p, 0, "10")], paid="0", expect=400)
        self.assert_stock(p, 5)

    def test_debt_summary_matches_customer_balance(self):
        p = self.make_product(stock=5)
        self.sell([(p, 2, "30")], paid_usd="10")
        data = self.api("get", "/api/customers/debt-summary/").data
        rows = data.get("customers") or data.get("results") or []
        row = next(r for r in rows if r.get("customer_id", r.get("id")) == self.customer.pk)
        bal_key = next(k for k in row if "usd" in k and ("balance" in k or "outstanding" in k))
        self.assertMoney(row[bal_key], D("50"))
