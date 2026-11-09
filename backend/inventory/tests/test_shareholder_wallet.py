"""Partner wallets: monthly profit credits, payouts, balance and history."""

from __future__ import annotations

from datetime import datetime, time
from zoneinfo import ZoneInfo

from django.utils import timezone

from inventory.models import Shareholder, ShareholderWalletCredit
from inventory.shareholder_wallet import month_start, next_month

from .base import D, ShopTestCase


def months_ago(n: int):
    m = month_start(timezone.localdate())
    for _ in range(n):
        m = (m.replace(day=1) - __import__("datetime").timedelta(days=1)).replace(day=1)
    return m


class ShareholderWalletTests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.p = self.make_product(buy="10")
        self.m2 = months_ago(2)
        self.m1 = months_ago(1)
        old = timezone.make_aware(datetime.combine(self.m2, time(9)), ZoneInfo("Asia/Baghdad"))
        self.buy([(self.p, 100, "10")], paid="1000", occurred_at=old)
        self.ali = self.api(
            "post",
            "/api/shareholders/",
            {"name": "Ali", "share_percentage": "30", "wallet_start_month": self.m2.isoformat()},
            expect=201,
        ).data
        self.sara = self.api(
            "post",
            "/api/shareholders/",
            {"name": "Sara", "share_percentage": "20", "wallet_start_month": self.m2.isoformat()},
            expect=201,
        ).data

    def at(self, month, day=10):
        return timezone.make_aware(datetime.combine(month.replace(day=day), time(12)), ZoneInfo("Asia/Baghdad"))

    def expense(self, month, amount):
        self.api(
            "post",
            "/api/expenses/",
            {"name": "Rent", "amount": str(amount), "currency": "USD", "occurred_on": month.replace(day=5).isoformat()},
            expect=201,
        )

    def wallets(self):
        rows = self.api("get", "/api/shareholders/wallets/").data["wallets"]
        return {r["name"]: r for r in rows}

    def test_finished_months_are_credited_by_share(self):
        # Month -2: 10 x (20 - 10) = 100 profit. Month -1: 20 profit - 70 rent = 50 loss.
        self.sell([(self.p, 10, "20")], paid_usd="200", occurred_at=self.at(self.m2))
        self.sell([(self.p, 2, "20")], paid_usd="40", occurred_at=self.at(self.m1))
        self.expense(self.m1, 70)
        w = self.wallets()
        self.assertMoney(w["Ali"]["total_earned_usd"], D("30") - D("15"))
        self.assertMoney(w["Sara"]["total_earned_usd"], D("20") - D("10"))
        self.assertMoney(w["Ali"]["balance_usd"], "15")
        self.assertEqual(ShareholderWalletCredit.objects.count(), 4)

    def test_current_month_is_an_estimate_not_in_balance(self):
        self.sell([(self.p, 10, "20")], paid_usd="200")
        w = self.wallets()
        self.assertMoney(w["Ali"]["current_month_estimate_usd"], "30")
        self.assertMoney(w["Ali"]["balance_usd"], "0")

    def test_opening_wallets_twice_does_not_double_credit(self):
        self.sell([(self.p, 10, "20")], paid_usd="200", occurred_at=self.at(self.m2))
        self.wallets()
        self.wallets()
        self.assertMoney(self.wallets()["Ali"]["balance_usd"], "30")

    def test_payout_comes_out_of_wallet_and_cash_box(self):
        self.sell([(self.p, 10, "20")], paid_usd="200", occurred_at=self.at(self.m2))
        self.api(
            "post",
            "/api/shareholder-payments/",
            {"shareholder": self.ali["id"], "amount_usd": "25", "paid_on": self.today()},
            expect=201,
        )
        w = self.wallets()["Ali"]
        self.assertMoney(w["total_paid_usd"], "25")
        self.assertMoney(w["balance_usd"], "5")
        self.assertMoney(self.cashier()["shareholder_payouts_usd"], "25")

    def test_cannot_pay_more_than_wallet_balance(self):
        self.sell([(self.p, 10, "20")], paid_usd="200", occurred_at=self.at(self.m2))
        res = self.client.post(
            "/api/shareholder-payments/",
            {"shareholder": self.ali["id"], "amount_usd": "31", "paid_on": self.today()},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("amount_usd", res.data)
        self.assertMoney(self.wallets()["Ali"]["balance_usd"], "30")

    def test_editing_a_payout_checks_balance_without_counting_itself(self):
        self.sell([(self.p, 10, "20")], paid_usd="200", occurred_at=self.at(self.m2))
        pay = self.api(
            "post",
            "/api/shareholder-payments/",
            {"shareholder": self.ali["id"], "amount_usd": "20", "paid_on": self.today()},
            expect=201,
        ).data
        self.api("patch", f"/api/shareholder-payments/{pay['id']}/", {"amount_usd": "30"})
        self.client.patch(f"/api/shareholder-payments/{pay['id']}/", {"amount_usd": "31"}, format="json")
        self.assertMoney(self.wallets()["Ali"]["balance_usd"], "0")

    def test_history_has_running_balance(self):
        self.sell([(self.p, 10, "20")], paid_usd="200", occurred_at=self.at(self.m2))
        self.api(
            "post",
            "/api/shareholder-payments/",
            {"shareholder": self.ali["id"], "amount_usd": "10", "paid_on": self.today(), "note": "cash"},
            expect=201,
        )
        hist = self.api("get", f"/api/shareholders/{self.ali['id']}/wallet/").data["history"]
        self.assertEqual(hist[0]["kind"], "payout")
        self.assertMoney(hist[0]["balance_after_usd"], "20")
        credit = next(h for h in hist if h["kind"] == "profit_share" and h["month"] == self.m2.isoformat())
        self.assertMoney(credit["amount_usd"], "30")
        self.assertMoney(credit["shop_net_profit_usd"], "100")

    def test_recalculate_month_after_correction(self):
        self.sell([(self.p, 10, "20")], paid_usd="200", occurred_at=self.at(self.m2))
        self.wallets()
        self.expense(self.m2, 50)  # forgotten bill entered later
        self.assertMoney(self.wallets()["Ali"]["balance_usd"], "30", "stored months do not move by themselves")
        self.api("post", "/api/shareholders/recalculate-month/", {"month": self.m2.strftime("%Y-%m")})
        self.assertMoney(self.wallets()["Ali"]["balance_usd"], "15")

    def test_cannot_recalculate_current_month(self):
        res = self.client.post(
            "/api/shareholders/recalculate-month/",
            {"month": timezone.localdate().strftime("%Y-%m")},
            format="json",
        )
        self.assertEqual(res.status_code, 400)

    def test_new_partner_starts_this_month(self):
        self.sell([(self.p, 10, "20")], paid_usd="200", occurred_at=self.at(self.m2))
        self.api("post", "/api/shareholders/", {"name": "New", "share_percentage": "10"}, expect=201)
        new = Shareholder.objects.get(name="New")
        self.assertEqual(new.wallet_start_month, month_start(timezone.localdate()))
        self.assertMoney(self.wallets()["New"]["balance_usd"], "0")

    def test_shares_cannot_exceed_100_percent(self):
        res = self.client.post("/api/shareholders/", {"name": "Too", "share_percentage": "60"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.api("patch", f"/api/shareholders/{self.ali['id']}/", {"share_percentage": "80"})

    def test_other_shop_cannot_see_wallets(self):
        self.as_user(self.owner2)
        self.api("get", f"/api/shareholders/{self.ali['id']}/wallet/", expect=404)
        self.assertEqual(self.api("get", "/api/shareholders/wallets/").data["wallets"], [])
        self.assertTrue(next_month(self.m2) == self.m1)
