"""A replayed write (same Idempotency-Key) must be applied only once."""

from __future__ import annotations

from inventory.models import CustomerDebtPayment, Sale

from .base import ShopTestCase


class IdempotencyTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.product = self.make_product(stock=10)

    def _sale_body(self):
        from django.utils import timezone

        from .base import RATE

        return {
            "occurred_at": timezone.now().isoformat(),
            "exchange_rate_usd_to_iqd": str(RATE),
            "invoice_discount_usd": "0",
            "amount_paid_usd": "0",
            "amount_paid_iqd": "0",
            "customer": self.customer.pk,
            "lines": [{"product": self.product.pk, "quantity": 1, "unit_price_usd": "15"}],
        }

    def test_same_key_creates_one_sale_and_replays_response(self):
        body = self._sale_body()
        first = self.api("post", "/api/sales/", body, expect=201, HTTP_IDEMPOTENCY_KEY="sale-key-1")
        second = self.client.post("/api/sales/", body, format="json", HTTP_IDEMPOTENCY_KEY="sale-key-1")
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second["Idempotency-Replayed"], "true")
        self.assertEqual(second.json()["id"], first.data["id"])
        self.assertEqual(Sale.objects.filter(shop=self.shop).count(), 1)
        self.product.refresh_from_db()
        self.assertEqual(self.product.current_stock_quantity, 9)

    def test_different_keys_create_two_sales(self):
        self.api("post", "/api/sales/", self._sale_body(), expect=201, HTTP_IDEMPOTENCY_KEY="k-a")
        self.api("post", "/api/sales/", self._sale_body(), expect=201, HTTP_IDEMPOTENCY_KEY="k-b")
        self.assertEqual(Sale.objects.filter(shop=self.shop).count(), 2)

    def test_no_key_behaves_as_before(self):
        self.api("post", "/api/sales/", self._sale_body(), expect=201)
        self.api("post", "/api/sales/", self._sale_body(), expect=201)
        self.assertEqual(Sale.objects.filter(shop=self.shop).count(), 2)

    def test_rejected_request_is_not_retried_into_success_twice(self):
        bad = self._sale_body()
        bad["lines"] = [{"product": 999999, "quantity": 1, "unit_price_usd": "15"}]
        r1 = self.client.post("/api/sales/", bad, format="json", HTTP_IDEMPOTENCY_KEY="bad-1")
        r2 = self.client.post("/api/sales/", bad, format="json", HTTP_IDEMPOTENCY_KEY="bad-1")
        self.assertEqual(r1.status_code, 400)
        self.assertEqual(r2.status_code, 400)
        self.assertEqual(Sale.objects.count(), 0)

    def test_debt_payment_replay_is_recorded_once(self):
        self.api("post", "/api/sales/", self._sale_body(), expect=201)
        path = f"/api/customers/{self.customer.pk}/collect-payment/"
        self.api("post", path, {"amount_paid_usd": "5"}, HTTP_IDEMPOTENCY_KEY="pay-1")
        self.api("post", path, {"amount_paid_usd": "5"}, HTTP_IDEMPOTENCY_KEY="pay-1")
        self.assertEqual(CustomerDebtPayment.objects.filter(customer=self.customer).count(), 1)
