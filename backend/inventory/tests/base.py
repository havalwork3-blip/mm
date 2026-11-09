"""
Shared fixtures for end-to-end API tests.

Every test talks to the real HTTP endpoints (APIClient), so serializers, views,
permissions and shop scoping are all exercised together.
"""

from __future__ import annotations

from decimal import Decimal

from django.core.cache import cache
from django.db.models import Sum
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User, UserRole
from shops.models import Currency, Shop

from inventory.models import Category, Company, Customer, Product, ProductBatch

RATE = Decimal("1500")


def D(value) -> Decimal:
    return Decimal(str(value))


class ShopTestCase(APITestCase):
    """Two shops, an owner per shop, an employee, a superuser and a USD→IQD rate."""

    def setUp(self):
        cache.clear()  # login lockout counters must not leak between tests
        self.shop = Shop.objects.create(name="Shop A", online_storefront_enabled=True)
        self.shop2 = Shop.objects.create(name="Shop B")
        self.owner = User.objects.create_user(
            "owner@a.test",
            "pw-owner-123",
            shop=self.shop,
            role=UserRole.OWNER,
        )
        self.employee = User.objects.create_user(
            "emp@a.test",
            "pw-emp-123",
            shop=self.shop,
            role=UserRole.EMPLOYEE,
        )
        self.owner2 = User.objects.create_user(
            "owner@b.test",
            "pw-owner2-123",
            shop=self.shop2,
            role=UserRole.OWNER,
        )
        self.admin = User.objects.create_superuser("admin@x.test", "pw-admin-123")
        for shop in (self.shop, self.shop2):
            Currency.objects.create(shop=shop, date=timezone.localdate(), usd_to_iqd=RATE)
        self.category = Category.objects.create(shop=self.shop, name="Cases")
        self.company = Company.objects.create(shop=self.shop, name="Supplier")
        self.customer = Customer.objects.create(shop=self.shop, name="Karwan", phone_1="07501111111")
        self.as_user(self.owner)

    # --- client helpers -------------------------------------------------

    def as_user(self, user):
        self.client.force_authenticate(user=user)
        self.current_user = user

    def api(self, method: str, path: str, data=None, expect: int | None = 200, **kw):
        res = getattr(self.client, method)(path, data, format="json", **kw)
        if expect is not None and res.status_code != expect:
            body = getattr(res, "data", None)
            self.fail(f"{method.upper()} {path} -> {res.status_code} (expected {expect}): {body}")
        return res

    # --- domain helpers -------------------------------------------------

    def make_product(self, name="Case", buy="10", stock=0, shop=None, category=None) -> Product:
        res = self.api(
            "post",
            "/api/products/",
            {
                "name": name,
                "category": (category or self.category).pk,
                "buy_price": str(buy),
                "sale_price_retail": str(buy),
                "sale_price_wholesale": str(buy),
                "current_stock_quantity": stock,
            },
            expect=201,
        )
        return Product.objects.get(pk=res.data["id"])

    def buy(self, lines, paid="0", company=True, discount="0", occurred_at=None, expect=201):
        """lines: [(product, qty, unit_cost[, damaged])]"""
        body = {
            "occurred_at": (occurred_at or timezone.now()).isoformat(),
            "exchange_rate_usd_to_iqd": str(RATE),
            "amount_paid_usd": str(paid),
            "discount_received_usd": str(discount),
            "payment_type": "debt" if D(paid) == 0 and company else "cash",
            "lines": [
                {
                    "product": ln[0].pk,
                    "quantity": ln[1],
                    "unit_cost_usd": str(ln[2]),
                    "damaged_quantity": ln[3] if len(ln) > 3 else 0,
                }
                for ln in lines
            ],
        }
        if company:
            body["company"] = self.company.pk
        return self.api("post", "/api/purchases/", body, expect=expect).data

    def sell(
        self,
        lines,
        paid_usd="0",
        paid_iqd="0",
        discount="0",
        customer=True,
        occurred_at=None,
        rate=RATE,
        expect=201,
    ):
        """lines: [(product, qty, unit_price)]"""
        body = {
            "occurred_at": (occurred_at or timezone.now()).isoformat(),
            "exchange_rate_usd_to_iqd": str(rate),
            "invoice_discount_usd": str(discount),
            "amount_paid_usd": str(paid_usd),
            "amount_paid_iqd": str(paid_iqd),
            "lines": [
                {"product": ln[0].pk, "quantity": ln[1], "unit_price_usd": str(ln[2])}
                for ln in lines
            ],
        }
        if customer:
            body["customer"] = (customer if not isinstance(customer, bool) else self.customer).pk
        return self.api("post", "/api/sales/", body, expect=expect).data

    def return_sale(self, sale, qty_by_line_index, expect=201, refund_method="cash"):
        lines = [
            {"sale_line_id": sale["lines"][i]["id"], "quantity": q}
            for i, q in qty_by_line_index.items()
        ]
        return self.api(
            "post",
            "/api/sales/return-products/",
            {"sale_id": sale["id"], "refund_method": refund_method, "lines": lines},
            expect=expect,
        ).data

    def return_purchase(self, purchase, qty_by_line_index, expect=201):
        lines = [
            {"purchase_line_id": purchase["lines"][i]["id"], "quantity": q}
            for i, q in qty_by_line_index.items()
        ]
        return self.api(
            "post",
            "/api/purchases/return-products/",
            {"purchase_id": purchase["id"], "lines": lines},
            expect=expect,
        ).data

    def today(self) -> str:
        return timezone.localdate().isoformat()

    def cashier(self, d_from=None, d_to=None) -> dict:
        d_from = d_from or self.today()
        d_to = d_to or d_from
        return self.api("get", f"/api/cashier/summary/?from={d_from}&to={d_to}").data

    def profit(self, d_from=None, d_to=None) -> dict:
        d_from = d_from or self.today()
        d_to = d_to or d_from
        return self.api("get", f"/api/reports/profit/?from={d_from}&to={d_to}").data["totals"]

    def customer_balance(self, customer=None) -> Decimal:
        c = customer or self.customer
        return D(self.api("get", f"/api/customers/{c.pk}/balance/").data["outstanding_balance_usd"])

    # --- invariants -----------------------------------------------------

    def stock_of(self, product) -> int:
        product.refresh_from_db()
        return int(product.current_stock_quantity)

    def batches_of(self, product) -> int:
        total = ProductBatch.objects.filter(
            product=product,
            remaining_quantity__gt=0,
        ).aggregate(s=Sum("remaining_quantity"))["s"]
        return int(total or 0)

    def assert_stock(self, product, expected: int):
        """Stock count is right AND the FIFO layers agree with it."""
        self.assertEqual(self.stock_of(product), expected, f"stock of {product.name}")
        self.assertEqual(
            self.batches_of(product),
            max(expected, 0),
            f"FIFO batches of {product.name} drifted from stock",
        )

    def assertMoney(self, actual, expected, msg=None):
        self.assertEqual(
            D(actual).quantize(Decimal("0.01")),
            D(expected).quantize(Decimal("0.01")),
            msg,
        )
