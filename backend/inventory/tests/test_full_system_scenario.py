"""
Full-system scenario: one business day in a shop, driven only through the HTTP API.

Admin adds staff with roles/permissions -> staff log in with tokens -> owner sets the
rate and opening cash -> manager adds products and buys stock (cash + debt, damaged
units, two FIFO cost layers) -> supplier payment and purchase return -> cashier sells
(USD, IQD, mixed, discount, credit), edits a sale -> sale returns (cash and debt) ->
debt collection and write-off -> expenses (USD + IQD) -> employee advances -> stock
corrections up and down -> shareholders -> online order -> every report.

At the end the cash drawer, stock counts, FIFO layers, debts and reports must all agree.
"""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.models import Permission

from accounts.models import User, UserRole
from inventory.models import Category, Company, Customer, Product, ProductBatch

from .base import RATE, D, ShopTestCase


def perm_ids(*codenames: str) -> list[int]:
    return list(Permission.objects.filter(codename__in=codenames).values_list("pk", flat=True))


class FullSystemScenarioTests(ShopTestCase):
    # ------------------------------------------------------------------ helpers

    def login(self, email: str, password: str) -> str:
        self.client.force_authenticate(user=None)
        res = self.client.post("/api/auth/login/", {"email": email, "password": password}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        return res.data["token"]

    def as_token(self, token: str, user: User):
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        self.current_user = user

    def as_owner(self):
        self.client.credentials()
        self.as_user(self.owner)

    def status(self, method: str, path: str, data=None) -> int:
        return getattr(self.client, method)(path, data, format="json").status_code

    def customer_balance(self, customer=None):
        from inventory.dashboard_tools import customer_outstanding_balance_usd
        return customer_outstanding_balance_usd(self.shop.pk, (customer or self.customer).pk)

    def soft(self, actual, expected, what: str):
        """Record a mismatch and keep going, so one bug does not hide the rest."""
        a, e = D(actual).quantize(Decimal("0.01")), D(expected).quantize(Decimal("0.01"))
        if a != e:
            self.findings.append(f"{what}: got {a}, expected {e}")

    def assert_all_stock_matches_fifo(self):
        for p in Product.objects.filter(shop=self.shop, is_unregistered_placeholder=False):
            self.assertGreaterEqual(p.current_stock_quantity, 0, f"negative stock: {p.name}")
            self.assertEqual(
                p.current_stock_quantity,
                self.batches_of(p),
                f"FIFO layers drifted from stock for {p.name}",
            )

    # ------------------------------------------------------------------ the day

    def test_full_business_day(self):
        self.findings: list[str] = []
        cash = D("0")  # what the drawer should hold, tracked by hand

        # 1) Admin creates staff with roles and permissions --------------------
        self.as_user(self.admin)
        staff = {
            "manager": (
                "manager@a.test",
                UserRole.MANAGER,
                perm_ids("view_product", "add_product", "change_product",
                         "view_purchase", "add_purchase", "view_category", "add_category"),
            ),
            "cashier": ("cashier@a.test", UserRole.EMPLOYEE, perm_ids("add_sale", "view_sale", "change_storefrontorder")),
            "editor": ("editor@a.test", UserRole.RECEIPT_EDITOR, []),
            "nobody": ("nobody@a.test", UserRole.EMPLOYEE, []),
        }
        users: dict[str, User] = {}
        tokens: dict[str, str] = {}
        for key, (email, role, perms) in staff.items():
            res = self.api(
                "post",
                "/api/users/",
                {"email": email, "password": "Strong-pass-123", "shop": self.shop.pk,
                 "role": role, "is_active": True, "user_permission_ids": perms},
                expect=201,
            )
            users[key] = User.objects.get(email=email)
            self.assertEqual(users[key].role, role)
            self.assertEqual(users[key].shop_id, self.shop.pk)
        # Duplicate email and short password are rejected.
        self.api("post", "/api/users/", {"email": "cashier@a.test", "password": "Strong-pass-123",
                                         "shop": self.shop.pk, "role": "employee"}, expect=400)
        self.api("post", "/api/users/", {"email": "x@a.test", "password": "short",
                                         "shop": self.shop.pk, "role": "employee"}, expect=400)
        # Change a role, then reset a password.
        self.api("patch", f"/api/users/{users['nobody'].pk}/", {"role": "employee"})
        self.api("post", f"/api/users/{users['nobody'].pk}/reset-password/", {"password": "New-pass-4567"})
        # Owners cannot create users (superuser only).
        self.as_owner()
        self.api("post", "/api/users/", {"email": "y@a.test", "password": "Strong-pass-123",
                                         "shop": self.shop.pk, "role": "owner"}, expect=403)

        # 2) Everyone logs in with a real token -------------------------------
        for key in ("manager", "cashier", "editor"):
            tokens[key] = self.login(staff[key][0], "Strong-pass-123")
        tokens["nobody"] = self.login("nobody@a.test", "New-pass-4567")
        self.client.force_authenticate(user=None)
        self.assertEqual(
            self.client.post("/api/auth/login/", {"email": "nobody@a.test", "password": "Strong-pass-123"},
                             format="json").status_code,
            401,
            "old password must stop working after reset",
        )
        for key in tokens:
            self.as_token(tokens[key], users[key])
            me = self.api("get", "/api/users/me/").data
            self.assertEqual(me["email"], users[key].email)

        # 3) Owner opens the day ---------------------------------------------
        self.as_owner()
        self.api("post", "/api/currencies/set-today/", {"usd_to_iqd": str(RATE)})
        self.api("post", "/api/cashier/opening/", {"for_date": self.today(), "opening_cash_usd": "5000"})
        cash += D("5000")
        self.assertMoney(self.cashier()["current_cash_usd"], cash)
        phones = Category.objects.get(pk=self.api("post", "/api/categories/", {"name": "Phones", "name_ku": "مۆبایل"}, expect=201).data["id"])
        supplier = Company.objects.get(pk=self.api("post", "/api/companies/", {"name": "Samsung Supplier"}, expect=201).data["id"])
        self.company = supplier
        debtor = Customer.objects.get(pk=self.api(
            "post", "/api/customers/", {"name": "Debtor Dara", "phone_1": "07502222222"}, expect=201,
        ).data["id"])

        # 4) Manager adds products and buys stock ------------------------------
        self.as_token(tokens["manager"], users["manager"])
        phone = self.make_product(name="Galaxy A55", buy="200", category=phones)
        charger = self.make_product(name="Charger 25W", buy="5")
        cable = self.make_product(name="USB-C Cable", buy="2")
        self.api("patch", f"/api/products/{phone.pk}/", {"sale_price_retail": "300"})

        p1 = self.buy([(phone, 10, "200")], paid="2000")                          # cash purchase
        cash -= D("2000")
        p2 = self.buy([(charger, 50, "5"), (cable, 100, "2", 3)], paid="0")      # on debt, 3 cables damaged
        self.buy([(phone, 5, "220")], paid="0")                                   # 2nd FIFO layer, on debt
        self.assert_stock(phone, 15)
        self.assert_stock(charger, 50)
        self.assert_stock(cable, 97)
        owed = D(self.api("get", f"/api/purchases/company-outstanding/?company_id={supplier.pk}").data["outstanding_usd"])
        self.assertGreater(owed, D("0"))
        # Manager may not see expenses or the profit report.
        self.assertEqual(self.status("get", "/api/expenses/"), 403)
        self.assertEqual(self.status("get", f"/api/reports/profit/?from={self.today()}&to={self.today()}"), 403)

        # 5) Owner pays the supplier and returns goods to them -----------------
        self.as_owner()
        res = self.api("post", "/api/purchases/pay-supplier/", {"company_id": supplier.pk, "amount_paid_usd": "500"}).data
        self.assertMoney(res["applied_usd_eq"], "500")
        self.assertMoney(res["outstanding_usd_after"], owed - D("500"))
        cash -= D("500")
        self.return_purchase(p2, {0: 5})                                          # 5 chargers back
        self.assert_stock(charger, 45)
        owed_after_return = D(self.api(
            "get", f"/api/purchases/company-outstanding/?company_id={supplier.pk}").data["outstanding_usd"])
        self.soft(owed_after_return, owed - D("500") - D("25"),
                  "supplier debt after paying $500 then returning $25 of already-paid goods")
        self.return_purchase(p1, {0: 999}, expect=400)                            # cannot return more than bought

        # 6) Cashier sells -----------------------------------------------------
        self.as_token(tokens["cashier"], users["cashier"])
        sale_a = self.sell([(phone, 2, "300"), (charger, 3, "15")], paid_usd="645")      # cash, USD
        cash += D("645")
        sale_b = self.sell([(phone, 9, "300")], paid_usd="1500", paid_iqd="1500000",     # mixed, 200 on debt
                           customer=debtor)
        cash += D("2500")
        sale_c = self.sell([(cable, 10, "6")], paid_iqd="75000", discount="10", customer=False)  # IQD, discount
        cash += D("50")
        self.sell([(phone, 1, "300")], paid_usd="300", rate="0", expect=400)              # bad rate blocked
        self.assert_stock(phone, 4)
        self.assert_stock(charger, 42)
        self.assert_stock(cable, 87)
        self.assertMoney(self.customer_balance(debtor), "200")

        # FIFO: sale B took 8 phones at $200 (layer 1) and 1 at $220 (layer 2).
        self.as_owner()
        totals = self.profit()
        self.assertMoney(totals["sum_sale_line_buy_prices_usd"],
                         D("2") * 200 + 3 * 5 + 8 * 200 + 1 * 220 + 10 * 2)

        # Cashier edits sale A (3 -> 4 chargers, pays the extra $15).
        self.as_token(tokens["cashier"], users["cashier"])
        self.api("patch", f"/api/sales/{sale_a['id']}/", {
            "amount_paid_usd": "660",
            "lines": [{"product": phone.pk, "quantity": 2, "unit_price_usd": "300"},
                      {"product": charger.pk, "quantity": 4, "unit_price_usd": "15"}],
        })
        cash += D("15")
        self.assert_stock(charger, 41)
        sale_a = self.api("get", f"/api/sales/{sale_a['id']}/").data

        # Cashier is blocked from back-office screens.
        for path in ("/api/expenses/", "/api/purchases/", "/api/shareholders/", "/api/employee-debts/"):
            self.assertEqual(self.status("get", path), 403, path)
        self.assertEqual(self.status("post", "/api/products/", {"name": "x"}), 403)

        # 7) Returns -----------------------------------------------------------
        self.as_owner()
        res = self.return_sale(sale_a, {0: 1})                    # 1 phone, fully paid sale -> $300 cash back
        self.assertMoney(res["cash_refund_usd"], "300")
        cash -= D("300")
        res = self.return_sale(sale_b, {0: 1})                    # 1 phone, sale owes 200 -> debt first
        self.assertMoney(res["debt_reduced_usd"], "200")
        self.assertMoney(res["cash_refund_usd"], "100")
        cash -= D("100")
        self.assertMoney(self.customer_balance(debtor), "0")
        self.return_sale(sale_c, {0: 99}, expect=400)             # more than sold
        self.assert_stock(phone, 6)
        hist = self.api("get", "/api/sales/returns-history/").data["results"]
        self.assertEqual(len(hist), 2)
        # A sale that has returns can no longer be edited.
        self.api("patch", f"/api/sales/{sale_a['id']}/", {
            "lines": [{"product": phone.pk, "quantity": 1, "unit_price_usd": "300"}]}, expect=400)

        # 8) Credit sale, debt collection, small write-off ---------------------
        self.as_token(tokens["cashier"], users["cashier"])
        self.sell([(charger, 2, "15")], paid_usd="0", customer=debtor)
        self.assertMoney(self.customer_balance(debtor), "30")
        res = self.api("post", f"/api/customers/{debtor.pk}/collect-payment/", {"amount_paid_usd": "25"}).data
        self.assertMoney(res["outstanding_balance_usd_after"], "5")
        cash += D("25")
        self.as_owner()
        summary = self.api("get", "/api/customers/debt-summary/").data
        self.assertIn(debtor.pk, [r["id"] for r in summary["results"]])
        self.api("post", f"/api/customers/{debtor.pk}/write-off-remainder-as-discount/", {})
        self.assertMoney(self.customer_balance(debtor), "0")
        self.assert_stock(charger, 39)

        # 9) Expenses and employee advances -----------------------------------
        self.api("post", "/api/expenses/", {"name": "Rent", "amount": "300", "currency": "USD",
                                            "occurred_on": self.today()}, expect=201)
        elec = self.api("post", "/api/expenses/", {"name": "Electricity", "amount": "150000",
                                                   "currency": "IQD", "occurred_on": self.today()}, expect=201).data
        self.assertMoney(elec["amount_usd"], "100")
        cash -= D("400")
        self.api("post", "/api/expenses/", {"name": "Bad", "amount": "0", "currency": "USD",
                                            "occurred_on": self.today()}, expect=400)
        tmp = self.api("post", "/api/expenses/", {"name": "Typo", "amount": "1", "currency": "USD",
                                                  "occurred_on": self.today()}, expect=201).data
        self.api("delete", f"/api/expenses/{tmp['id']}/", expect=204)
        for kind, amount in (("taken", "50"), ("returned", "20")):
            self.api("post", "/api/employee-debts/", {"employee": users["cashier"].pk, "amount": amount,
                                                      "debt_type": kind, "occurred_on": self.today()}, expect=201)
        cash -= D("30")
        emp_rows = self.api("get", "/api/employee-debts/summary/").data["employees"]
        self.assertTrue(emp_rows, "employee debt summary should list the cashier")
        # Another shop's employee cannot be given a debt here.
        self.api("post", "/api/employee-debts/", {"employee": self.owner2.pk, "amount": "5",
                                                  "debt_type": "taken", "occurred_on": self.today()}, expect=400)

        # 10) Stock corrections (count down after damage, then up) ------------
        self.as_token(tokens["manager"], users["manager"])
        self.api("patch", f"/api/products/{cable.pk}/", {"current_stock_quantity": 70})
        self.assert_stock(cable, 70)
        self.api("patch", f"/api/products/{cable.pk}/", {"current_stock_quantity": 75})
        self.assert_stock(cable, 75)
        self.api("patch", f"/api/products/{cable.pk}/", {"is_discontinued": True})
        listed = self.api("get", "/api/products/?for_sale=1&page_size=100").data["results"]
        self.assertNotIn(cable.pk, [p["id"] for p in listed])
        self.assert_stock(cable, 0)                                       # stopping writes stock off (business rule)
        self.api("patch", f"/api/products/{cable.pk}/", {"is_discontinued": False})
        self.assert_stock(cable, 0)                                       # restored products restart at zero

        # 11) The drawer must match every movement above ----------------------
        self.as_owner()
        snap = self.cashier()
        self.assertMoney(snap["current_cash_usd"], cash, "cash drawer")
        self.assertMoney(snap["expenses_usd"], "400")
        self.assertMoney(abs(D(snap["employee_debt_cash_effect_usd"])), "30")
        ledger = self.api("get", f"/api/cashier/ledger/?from={self.today()}&to={self.today()}").data
        rows = ledger["entries"] if isinstance(ledger, dict) else ledger
        kinds = {r["kind"] for r in rows}
        for kind in ("opening_cash", "sale_payment", "customer_debt_payment", "expense",
                     "purchase_payment", "employee_debt"):
            self.assertIn(kind, kinds)

        # 12) Shareholders -----------------------------------------------------
        a = self.api("post", "/api/shareholders/", {"name": "Partner A", "share_percentage": "60"}, expect=201).data
        self.api("post", "/api/shareholders/", {"name": "Partner B", "share_percentage": "40"}, expect=201)
        self.api("post", "/api/shareholders/", {"name": "Too much", "share_percentage": "1"}, expect=400)
        wallets = {w["name"]: w for w in self.api("get", "/api/shareholders/wallets/").data["wallets"]}
        self.assertEqual(set(wallets), {"Partner A", "Partner B"})
        bal = D(wallets["Partner A"]["balance_usd"])
        if bal > 0:
            self.api("post", "/api/shareholder-payments/", {"shareholder": a["id"], "amount_usd": "1",
                                                            "paid_on": self.today()}, expect=201)
            cash -= D("1")
        self.api("post", "/api/shareholder-payments/", {"shareholder": a["id"], "amount_usd": str(bal + 1000),
                                                        "paid_on": self.today()}, expect=400)

        # 13) Online storefront order -> completed -> becomes a sale -----------
        self.client.force_authenticate(user=None)
        order = self.api("post", "/api/public/storefront/submit_order/", {
            "shop": self.shop.pk, "customer_name": "Online Buyer", "customer_phone": "07503333333",
            "customer_address": "Erbil", "items": [{"product": charger.pk, "quantity": 2}],
        }, expect=201).data
        self.assert_stock(charger, 37)
        self.as_token(tokens["cashier"], users["cashier"])
        self.api("patch", f"/api/merchant/storefront-orders/{order['id']}/", {"status": "COMPLETED"})
        self.assert_stock(charger, 37)

        # 14) Every report answers and agrees ---------------------------------
        self.as_owner()
        totals = self.profit()
        for key in ("sum_sale_line_prices_usd", "sum_sale_line_buy_prices_usd", "total_customer_discounts_usd"):
            self.assertIn(key, totals)
        self.assertGreater(D(totals["sum_sale_line_prices_usd"]), D("0"))
        self.api("get", f"/api/reports/jard/?from={self.today()}&to={self.today()}")
        dash = self.api("get", f"/api/dashboard/stats/?from={self.today()}&to={self.today()}").data
        self.assertIsInstance(dash, dict)
        self.api("get", "/api/purchases/supplier-archive/")
        self.api("get", "/api/purchases/returns-history/")
        self.api("get", f"/api/products/{phone.pk}/purchase-costs/")
        self.api("get", "/api/users/me-activity/")
        self.as_user(self.admin)
        self.api("get", f"/api/admin/stats/?from={self.today()}&to={self.today()}")

        # 15) Role and shop isolation -----------------------------------------
        self.as_token(tokens["nobody"], users["nobody"])
        self.assertEqual(self.status("post", "/api/sales/", {}), 403)
        self.assertEqual(self.status("get", "/api/sales/"), 403)
        self.assertEqual(self.status("get", "/api/expenses/"), 403)
        self.assertEqual(self.status("post", "/api/products/", {"name": "x"}), 403)
        self.as_token(tokens["editor"], users["editor"])
        self.assertEqual(self.status("get", "/api/sales/"), 200)
        self.assertEqual(self.status("get", "/api/expenses/"), 403)
        self.client.credentials()
        self.as_user(self.owner2)
        self.assertEqual(self.status("get", f"/api/sales/{sale_a['id']}/"), 404)
        self.assertEqual(self.status("get", f"/api/products/{phone.pk}/"), 404)
        other_sales = self.api("get", "/api/sales/").data
        self.assertEqual(len(other_sales["results"] if isinstance(other_sales, dict) else other_sales), 0)

        # 16) Logout kills the token ------------------------------------------
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {tokens['cashier']}")
        self.client.post("/api/auth/logout/")
        self.assertEqual(self.status("get", "/api/users/me/"), 401)

        # 17) Final invariants -------------------------------------------------
        self.client.credentials()
        self.as_owner()
        self.assert_all_stock_matches_fifo()
        self.assertFalse(ProductBatch.objects.filter(remaining_quantity__lt=0).exists())
        self.assert_stock(phone, 6)
        self.assert_stock(charger, 37)
        self.assert_stock(cable, 0)
        self.assertEqual(self.findings, [], "\n".join(self.findings))
