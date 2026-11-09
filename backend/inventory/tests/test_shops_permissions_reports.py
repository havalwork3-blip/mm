"""Shop separation, permissions, online orders, reports and public endpoints."""

from __future__ import annotations

from django.utils import timezone

from inventory.models import Customer, Sale, StorefrontOrder
from shops.models import Shop

from .base import D, ShopTestCase


class ShopIsolationTests(ShopTestCase):
    def test_other_shop_cannot_see_or_change_products(self):
        p = self.make_product()
        self.as_user(self.owner2)
        listed = self.api("get", "/api/products/").data
        rows = listed["results"] if isinstance(listed, dict) else listed
        self.assertNotIn(p.pk, [r["id"] for r in rows])
        self.api("get", f"/api/products/{p.pk}/", expect=404)
        self.api("patch", f"/api/products/{p.pk}/", {"name": "hacked"}, expect=404)

    def test_shop_id_param_is_ignored_for_normal_users(self):
        p = self.make_product()
        self.as_user(self.owner2)
        listed = self.api("get", f"/api/products/?shop_id={self.shop.pk}").data
        rows = listed["results"] if isinstance(listed, dict) else listed
        self.assertNotIn(p.pk, [r["id"] for r in rows])

    def test_other_shop_cannot_read_sales_or_customers(self):
        p = self.make_product(stock=5)
        sale = self.sell([(p, 1, "10")], paid_usd="10")
        self.as_user(self.owner2)
        self.api("get", f"/api/sales/{sale['id']}/", expect=404)
        self.api("get", f"/api/customers/{self.customer.pk}/", expect=404)

    def test_customer_with_same_name_in_other_shop_is_not_overwritten(self):
        other = Customer.objects.create(shop=self.shop2, name="Ali", phone_1="07709999999", note="keep")
        self.api("post", "/api/customers/", {"name": "Ali", "phone_1": "07500000000"}, expect=201)
        other.refresh_from_db()
        self.assertEqual(other.phone_1, "07709999999")
        self.assertEqual(other.note, "keep")

    def test_superuser_sees_all_shops_combined(self):
        p = self.make_product(stock=10)
        self.sell([(p, 1, "10")], paid_usd="10")
        self.sell([(p, 2, "10")], paid_usd="0")
        self.as_user(self.admin)
        stats = self.api("get", f"/api/admin/stats/?from={self.today()}&to={self.today()}").data
        self.assertMoney(stats["global_sales_usd"], "10")
        self.assertMoney(stats["global_customer_debt_usd"], "20")
        self.assertEqual(stats["total_shops"], 2)

    def test_shop_owner_cannot_see_global_stats(self):
        self.api("get", f"/api/admin/stats/?from={self.today()}&to={self.today()}", expect=403)


class PermissionTests(ShopTestCase):
    def test_employee_cannot_change_shop_or_receipt_settings(self):
        self.as_user(self.employee)
        self.api("patch", "/api/shop-settings/", {"low_stock_threshold": 1}, expect=403)
        self.api("patch", "/api/receipt-settings/", {"address": "x"}, expect=403)

    def test_owner_can_change_settings(self):
        self.api("patch", "/api/shop-settings/", {"low_stock_threshold": 3})
        self.api("patch", "/api/receipt-settings/", {"address": "Erbil"})

    def test_employee_cannot_change_online_store_tokens(self):
        self.as_user(self.employee)
        self.api(
            "patch",
            "/api/merchant/storefront-settings/",
            {"telegram_bot_token": "stolen"},
            expect=403,
        )

    def test_only_superuser_creates_or_deletes_shops(self):
        self.api("post", "/api/shops/", {"name": "New"}, expect=403)
        self.api("delete", f"/api/shops/{self.shop.pk}/", expect=403)
        self.assertTrue(Shop.objects.filter(pk=self.shop.pk).exists())
        self.as_user(self.admin)
        res = self.client.post("/api/shops/", {"name": "New", "slug": "new-shop"}, format="json")
        self.assertEqual(res.status_code, 201, res.data)

    def test_employee_without_permissions_cannot_sell(self):
        p = self.make_product(stock=5)
        self.as_user(self.employee)
        self.sell([(p, 1, "10")], paid_usd="10", expect=403)
        self.assert_stock(p, 5)

    def test_exchange_rate_must_be_positive(self):
        self.api("post", "/api/currencies/set-today/", {"usd_to_iqd": "0"}, expect=400)
        self.api("post", "/api/currencies/set-today/", {"usd_to_iqd": "-1500"}, expect=400)
        self.api("post", "/api/currencies/set-today/", {"usd_to_iqd": "1480"})


class OnlineOrderTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(buy="10", stock=10)

    def place_order(self, qty=3):
        self.client.force_authenticate(user=None)
        res = self.api(
            "post",
            "/api/public/storefront/submit_order/",
            {
                "shop": self.shop.pk,
                "customer_name": "Online",
                "customer_phone": "07500000001",
                "customer_address": "Erbil",
                "items": [{"product": self.p.pk, "quantity": qty}],
            },
            expect=201,
        )
        self.as_user(self.owner)
        return res.data

    def test_order_takes_stock_and_cancel_returns_it_once(self):
        order = self.place_order(3)
        self.assert_stock(self.p, 7)
        url = f"/api/merchant/storefront-orders/{order['id']}/"
        self.api("patch", url, {"status": "CANCELLED"})
        self.assert_stock(self.p, 10)
        self.api("patch", url, {"status": "CANCELLED"})
        self.assert_stock(self.p, 10)

    def test_double_cancel_from_stale_screen_restores_once(self):
        from inventory.serializers import MerchantStorefrontOrderSerializer

        order = self.place_order(3)
        stale_a = StorefrontOrder.objects.get(pk=order["id"])
        stale_b = StorefrontOrder.objects.get(pk=order["id"])
        for stale in (stale_a, stale_b):
            ser = MerchantStorefrontOrderSerializer(stale, data={"status": "CANCELLED"}, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()
        self.assert_stock(self.p, 10)

    def test_completed_order_becomes_paid_sale_without_taking_stock_twice(self):
        order = self.place_order(3)
        self.assert_stock(self.p, 7)
        url = f"/api/merchant/storefront-orders/{order['id']}/"
        self.api("patch", url, {"status": "COMPLETED"})
        self.assert_stock(self.p, 7)
        sale = Sale.objects.get(storefront_order_id=order["id"])
        self.assertEqual(sale.lines.first().quantity, 3)
        self.assertEqual(sale.lines.first().unit_buy_price_usd, D("10"))
        total = D(StorefrontOrder.objects.get(pk=order["id"]).total_amount)
        self.assertMoney(self.cashier()["pos_sale_payments_usd"], total)
        self.assertMoney(self.profit()["sum_sale_line_buy_prices_usd"], "30")
        # Completing again does not create a second sale.
        self.api("patch", url, {"status": "COMPLETED"})
        self.assertEqual(Sale.objects.filter(storefront_order_id=order["id"]).count(), 1)

    def test_reopening_or_cancelling_completed_order_removes_its_sale(self):
        order = self.place_order(3)
        url = f"/api/merchant/storefront-orders/{order['id']}/"
        self.api("patch", url, {"status": "COMPLETED"})
        self.api("patch", url, {"status": "CANCELLED"})
        self.assertFalse(Sale.objects.filter(storefront_order_id=order["id"]).exists())
        self.assert_stock(self.p, 10)
        self.assertMoney(self.cashier()["pos_sale_payments_usd"], "0")

    def test_online_sale_can_be_returned_but_not_edited_in_pos(self):
        order = self.place_order(3)
        url = f"/api/merchant/storefront-orders/{order['id']}/"
        self.api("patch", url, {"status": "COMPLETED"})
        sale = self.api("get", f"/api/sales/{Sale.objects.get(storefront_order_id=order['id']).pk}/").data
        self.return_sale(sale, {0: 1})
        self.assert_stock(self.p, 8)
        body = {"lines": [{"product": self.p.pk, "quantity": 1, "unit_price_usd": "1"}]}
        self.api("patch", f"/api/sales/{sale['id']}/", body, expect=400)
        # After a return the order can no longer be reopened.
        self.api("patch", url, {"status": "PENDING"}, expect=400)

    def test_cannot_order_more_than_stock(self):
        self.client.force_authenticate(user=None)
        res = self.client.post(
            "/api/public/storefront/submit_order/",
            {
                "shop": self.shop.pk,
                "customer_name": "Online",
                "customer_phone": "07500000001",
                "customer_address": "Erbil",
                "items": [{"product": self.p.pk, "quantity": 50}],
            },
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assert_stock(self.p, 10)


class ReportTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(buy="10")
        self.buy([(self.p, 10, "10")], paid="100")

    def test_jard_report_counts_returns(self):
        sale = self.sell([(self.p, 5, "20")], paid_usd="100")
        self.return_sale(sale, {0: 2})
        data = self.api("get", f"/api/reports/jard/?from={self.today()}&to={self.today()}").data
        rows = data["results"]
        row = next(r for r in rows if r["product_id"] == self.p.pk)
        self.assertEqual(int(row["remaining_qty"]), 7)
        self.assertEqual(int(row["sold_qty"]), 3)
        self.assertMoney(row["sold_value_usd"], "60")
        self.assertMoney(row["remaining_value_usd"], "70")

    def test_profit_report_net_profit(self):
        self.sell([(self.p, 3, "20")], paid_usd="60", discount="5")
        self.api(
            "post",
            "/api/expenses/",
            {"name": "Power", "amount": "10", "currency": "USD", "occurred_on": self.today()},
            expect=201,
        )
        totals = self.profit()
        # 60 sales - 30 cost - 5 discount - 10 expense
        self.assertMoney(totals["net_profit_usd"], "15")

    def test_report_endpoints_respond(self):
        q = f"?from={self.today()}&to={self.today()}"
        for path in (
            "/api/dashboard/stats/",
            "/api/cashier/summary/",
            "/api/cashier/ledger/",
            "/api/reports/profit/",
            "/api/reports/jard/",
            "/api/customers/debt-summary/",
            "/api/purchases/supplier-archive/",
        ):
            self.api("get", path + q)


class PublicEndpointTests(ShopTestCase):
    def test_marketing_pages_do_not_crash(self):
        self.client.force_authenticate(user=None)
        for path in ("/api/public/marketing-site/", "/api/public/marketing-products/"):
            res = self.client.get(path)
            self.assertLess(res.status_code, 500, path)

    def test_forged_telegram_update_is_rejected(self):
        self.client.force_authenticate(user=None)
        res = self.client.post(
            "/api/public/telegram/webhook/",
            {"message": {"text": "/start ABCD1234", "chat": {"id": 1}}},
            format="json",
        )
        self.assertEqual(res.status_code, 403)

    def test_public_catalog_hides_cost_price(self):
        self.make_product(stock=3)
        self.client.force_authenticate(user=None)
        res = self.client.get(f"/api/public/storefront/catalog/?shop={self.shop.pk}")
        self.assertLess(res.status_code, 500)
        self.assertNotIn("buy_price", str(getattr(res, "data", "")))


class LoginTests(ShopTestCase):
    def login(self, email, password, ip="203.0.113.5"):
        self.client.force_authenticate(user=None)
        return self.client.post(
            "/api/auth/login/",
            {"email": email, "password": password},
            format="json",
            REMOTE_ADDR="127.0.0.1",
            HTTP_X_REAL_IP=ip,
        )

    def test_login_gives_token_that_works_and_logout_ends_it(self):
        res = self.login("OWNER@a.test", "pw-owner-123")
        self.assertEqual(res.status_code, 200, res.data)
        token = res.data["token"]
        self.assertNotIn("pw-owner-123", str(res.data))
        auth = {"HTTP_AUTHORIZATION": f"Token {token}"}
        self.assertEqual(self.client.get("/api/users/me/", **auth).status_code, 200)
        self.client.post("/api/auth/logout/", **auth)
        self.assertEqual(self.client.get("/api/users/me/", **auth).status_code, 401)

    def test_server_stores_only_a_hash_of_the_token(self):
        from accounts.models import ApiToken

        token = self.login("owner@a.test", "pw-owner-123").data["token"]
        self.assertFalse(ApiToken.objects.filter(key_hash=token).exists())
        self.assertEqual(ApiToken.objects.count(), 1)

    def test_old_token_expires_after_two_idle_weeks(self):
        from datetime import timedelta

        from django.utils import timezone

        from accounts.models import ApiToken

        token = self.login("owner@a.test", "pw-owner-123").data["token"]
        ApiToken.objects.update(last_used_at=timezone.now() - timedelta(days=15))
        res = self.client.get("/api/users/me/", HTTP_AUTHORIZATION=f"Token {token}")
        self.assertEqual(res.status_code, 401)

    def test_wrong_password_locks_only_the_attackers_ip(self):
        for _ in range(10):
            self.assertEqual(self.login("owner@a.test", "nope", ip="198.51.100.9").status_code, 401)
        # Attacker's address is locked, even with the right password...
        self.assertEqual(self.login("owner@a.test", "pw-owner-123", ip="198.51.100.9").status_code, 429)
        # ...but the real owner at the shop can still sign in.
        self.assertEqual(self.login("owner@a.test", "pw-owner-123", ip="203.0.113.5").status_code, 200)

    def test_one_ip_guessing_many_accounts_is_locked(self):
        for i in range(30):
            self.login(f"user{i}@x.test", "nope", ip="198.51.100.20")
        self.assertEqual(self.login("owner@a.test", "pw-owner-123", ip="198.51.100.20").status_code, 429)

    def test_x_real_ip_is_ignored_when_not_behind_local_proxy(self):
        self.client.force_authenticate(user=None)
        for i in range(10):
            self.client.post(
                "/api/auth/login/",
                {"email": "owner@a.test", "password": "nope"},
                format="json",
                REMOTE_ADDR="198.51.100.30",
                HTTP_X_REAL_IP=f"10.0.0.{i}",
            )
        res = self.client.post(
            "/api/auth/login/",
            {"email": "owner@a.test", "password": "pw-owner-123"},
            format="json",
            REMOTE_ADDR="198.51.100.30",
            HTTP_X_REAL_IP="10.0.0.99",
        )
        self.assertEqual(res.status_code, 429, "a forged X-Real-IP must not dodge the lock")
