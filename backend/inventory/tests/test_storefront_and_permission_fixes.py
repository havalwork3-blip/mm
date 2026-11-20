"""Online-store abuse limits and permission tightening found in the full system audit."""

from __future__ import annotations

from datetime import timedelta

from django.contrib.auth.models import Permission
from django.test import override_settings
from django.utils import timezone

from inventory.models import Purchase, StorefrontOrder, StorefrontOrderStatus

from .base import ShopTestCase as _Base


class ShopTestCase(_Base):
    def code(self, method, path, data=None, **kw) -> int:
        return getattr(self.client, method)(path, data, format="json", **kw).status_code


class StorefrontLimitsTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(name="Charger", buy="10", stock=100)

    def order(self, qty=1, phone="07500000001", product=None, expect=201):
        self.client.force_authenticate(user=None)
        res = self.api(
            "post",
            "/api/public/storefront/submit_order/",
            {
                "shop": self.shop.pk,
                "customer_name": "Buyer",
                "customer_phone": phone,
                "customer_address": "Erbil",
                "items": [{"product": (product or self.p).pk, "quantity": qty}],
            },
            expect=expect,
        )
        self.as_user(self.owner)
        return res.data

    def test_product_without_price_cannot_be_ordered_for_free(self):
        free = self.make_product(name="No price", buy="0", stock=5)
        self.order(product=free, expect=400)
        self.assertEqual(StorefrontOrder.objects.count(), 0)

    @override_settings(STOREFRONT_MAX_QTY_PER_LINE=10)
    def test_quantity_per_line_is_capped(self):
        self.order(qty=11, expect=400)
        self.order(qty=10)
        self.assert_stock(self.p, 90)

    @override_settings(STOREFRONT_MAX_OPEN_ORDERS_PER_PHONE=2)
    def test_open_orders_per_phone_are_limited(self):
        self.order(phone="0750")
        self.order(phone="0750")
        self.order(phone="0750", expect=400)
        self.order(phone="0751")  # another customer is fine

    @override_settings(STOREFRONT_PENDING_ORDER_HOURS=48)
    def test_stale_pending_orders_release_their_stock(self):
        o = self.order(qty=30)
        self.assert_stock(self.p, 70)
        StorefrontOrder.objects.filter(pk=o["id"]).update(created_at=timezone.now() - timedelta(hours=49))
        self.api("get", "/api/merchant/storefront-orders/pending-count/")
        self.assertEqual(StorefrontOrder.objects.get(pk=o["id"]).status, StorefrontOrderStatus.CANCELLED)
        self.assert_stock(self.p, 100)

    @override_settings(STOREFRONT_PENDING_ORDER_HOURS=48)
    def test_processing_orders_never_expire(self):
        o = self.order(qty=5)
        self.api("patch", f"/api/merchant/storefront-orders/{o['id']}/", {"status": "PROCESSING"})
        StorefrontOrder.objects.filter(pk=o["id"]).update(created_at=timezone.now() - timedelta(days=10))
        self.api("get", "/api/merchant/storefront-orders/pending-count/")
        self.assertEqual(StorefrontOrder.objects.get(pk=o["id"]).status, StorefrontOrderStatus.PROCESSING)
        self.assert_stock(self.p, 95)


class PermissionTighteningTests(ShopTestCase):
    def grant(self, user, *codenames):
        for c in codenames:
            user.user_permissions.add(Permission.objects.get(codename=c))
        return type(user).objects.get(pk=user.pk)

    def test_employee_without_permission_cannot_change_online_prices(self):
        p = self.make_product(name="Cable", buy="5", stock=3)
        self.as_user(self.employee)
        self.assertEqual(
            self.code("patch", "/api/merchant/online-product-pricing/", {
                "items": [{"id": p.pk, "online_sale_price": "1"}],
            }),
            403,
        )
        self.as_user(self.grant(self.employee, "change_product"))
        self.api("patch", "/api/merchant/online-product-pricing/", {
            "items": [{"id": p.pk, "online_sale_price": "6"}],
        })

    def test_change_product_alone_cannot_edit_supplier_invoice(self):
        p = self.make_product(name="Glass", buy="2", stock=0)
        purchase = self.buy([(p, 10, "2")], paid="0")
        clerk = self.grant(self.employee, "change_product", "view_purchase")
        self.as_user(clerk)
        self.assertEqual(
            self.code("patch", f"/api/purchases/{purchase['id']}/", {"amount_paid_usd": "20"}),
            403,
        )
        self.assertEqual(str(Purchase.objects.get(pk=purchase["id"]).amount_paid_usd), "0.0000")

    def test_view_profit_report_alone_cannot_pay_partners(self):
        viewer = self.grant(self.employee, "view_profitreport")
        self.as_user(viewer)
        self.assertEqual(self.code("post", "/api/shareholder-payments/", {}), 403)
