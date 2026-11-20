"""
Full-system scenario, part 2: everything the business-day test does not reach.

- Admin creates a brand-new shop, renames it, gives it an owner, and runs it from zero.
- Every "rename/edit" path: shop, settings, receipt, category, product, supplier,
  customer (synced to sibling shops), user display name, expenses, debts, purchases.
- Online storefront: settings, delivery zones, banners, category cards, online prices,
  public pages, an order with delivery fee, stats, cancel.
- Marketing website CMS, the QR landing page, deactivating a user, deleting a shop.
"""

from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.models import Permission
from django.utils import timezone

from accounts.models import User, UserRole
from inventory.models import Customer, Expense, Product, Purchase, Sale
from marketing.models import MarketingEditor
from shops.models import Shop

from .base import RATE, D, ShopTestCase


class FullSystemPart2Tests(ShopTestCase):
    def setUp(self):
        super().setUp()
        self.findings: list[str] = []

    def tearDown(self):
        super().tearDown()

    def soft(self, actual, expected, what: str):
        if not isinstance(expected, bool) and (isinstance(expected, (int, float, Decimal)) or _is_num(expected)):
            ok = D(actual).quantize(Decimal("0.01")) == D(expected).quantize(Decimal("0.01"))
        else:
            ok = actual == expected
        if not ok:
            self.findings.append(f"{what}: got {actual!r}, expected {expected!r}")

    def done(self):
        self.assertEqual(self.findings, [], "\n" + "\n".join(self.findings))

    def code(self, method, path, data=None, **kw) -> int:
        return getattr(self.client, method)(path, data, format="json", **kw).status_code

    # ------------------------------------------------------------------ new shop

    def test_admin_builds_new_shop_and_renames_everything(self):
        self.as_user(self.admin)

        # Create a shop, rename it, look it up by slug.
        shop = self.api("post", "/api/shops/", {"name": "Haval Mobile", "slug": "haval-mobile"}, expect=201).data
        self.assertTrue(shop["slug"])
        self.api("patch", f"/api/shops/{shop['id']}/", {"name": "Haval Mobile Center"})
        self.soft(self.api("get", f"/api/shops/{shop['slug']}/").data["name"], "Haval Mobile Center", "shop rename")
        self.assertGreaterEqual(len(self.api("get", "/api/shops/").data), 3)
        self.api("post", "/api/shops/", {"name": "", "slug": "x"}, expect=400)
        self.api("post", "/api/shops/", {"name": "Dup", "slug": "haval-mobile"}, expect=400)
        new_shop = Shop.objects.get(pk=shop["id"])

        # Owner for it; owner logs in and sees only their shop.
        self.api("post", "/api/users/", {"email": "boss@new.test", "password": "Boss-pass-123",
                                         "shop": new_shop.pk, "role": "owner", "is_active": True}, expect=201)
        boss = User.objects.get(email="boss@new.test")
        res = self.client.post("/api/auth/login/", {"email": "BOSS@new.test", "password": "Boss-pass-123"}, format="json")
        self.soft(res.status_code, 200, "login is case-insensitive on email")
        self.as_user(boss)
        visible = self.api("get", "/api/shops/").data
        visible = visible["results"] if isinstance(visible, dict) else visible
        self.soft([s["id"] for s in visible], [new_shop.pk], "owner sees only own shop")
        self.soft(self.code("post", "/api/shops/", {"name": "Sneaky", "slug": "sneaky"}), 403, "owner cannot create shops")
        self.soft(self.code("delete", f"/api/shops/{new_shop.pk}/"), 403, "owner cannot delete shops")
        self.soft(self.code("patch", f"/api/shops/{self.shop.pk}/", {"name": "Hijack"}), 404, "owner cannot rename another shop")

        # Profile rename.
        self.api("patch", "/api/users/me/profile/", {"display_name": "Kak Haval"})
        self.soft(self.api("get", "/api/users/me/").data.get("display_name"), "Kak Haval", "display name rename")

        # Shop + receipt settings.
        s = self.api("patch", "/api/shop-settings/", {"primary_color": "#112233", "low_stock_threshold": 3,
                                                      "default_mode": "dark"}).data
        self.soft(s["primary_color"], "#112233", "shop colour saved")
        r = self.api("patch", "/api/receipt-settings/", {"shop_name_en": "Haval Mobile", "shop_name_ku": "هەڤاڵ مۆبایل",
                                                         "phone_number": "07501234567", "footer_note": "Thanks"}).data
        self.soft(r["shop_name_ku"], "هەڤاڵ مۆبایل", "receipt Kurdish name")
        self.api("patch", "/api/receipt-settings/", {"shop_name_en": "Haval Mobile Center"})
        self.soft(self.api("get", "/api/receipt-settings/").data["shop_name_en"], "Haval Mobile Center", "receipt rename")

        # Exchange rate: set, change same day, list.
        self.api("post", "/api/currencies/set-today/", {"usd_to_iqd": "1480"})
        self.api("post", "/api/currencies/set-today/", {"usd_to_iqd": "1500"})
        rates = self.api("get", "/api/currencies/").data
        rates = rates["results"] if isinstance(rates, dict) else rates
        self.soft(len(rates), 1, "one rate row per day")
        self.soft(rates[0]["usd_to_iqd"], "1500", "rate updated in place")

        # Category: create, rename, delete an empty one.
        cat = self.api("post", "/api/categories/", {"name": "Covers", "name_ku": "بەرگ"}, expect=201).data
        self.api("patch", f"/api/categories/{cat['id']}/", {"name_en": "Phone Covers", "name_ku": "بەرگی مۆبایل"})
        got = self.api("get", f"/api/categories/{cat['id']}/").data
        self.soft((got["name"], got["name_ku"], got["name_en"]), ("بەرگی مۆبایل", "بەرگی مۆبایل", "Phone Covers"),
                  "category rename (display name follows Kurdish)")
        tmp = self.api("post", "/api/categories/", {"name": "Tmp", "name_ku": "کاتی"}, expect=201).data
        self.api("delete", f"/api/categories/{tmp['id']}/", expect=204)

        # Product: create with SKU/barcode, rename, reprice, search by every key.
        prod = self.api("post", "/api/products/", {
            "name": "iPhone Cover", "category": cat["id"], "sku": "COV-1", "barcode": "123456789",
            "buy_price": "2", "sale_price_retail": "5", "sale_price_wholesale": "4", "current_stock_quantity": 0,
        }, expect=201).data
        self.api("patch", f"/api/products/{prod['id']}/", {"name": "iPhone 16 Cover", "sale_price_retail": "6"})
        p = Product.objects.get(pk=prod["id"])
        self.soft(p.name, "iPhone 16 Cover", "product rename")
        self.soft(p.sale_price_retail, "6", "product reprice")
        for q in ("16 Cover", "COV-1", "123456789"):
            hits = self.api("get", f"/api/products/?search={q}").data["results"]
            self.soft([h["id"] for h in hits], [p.pk], f"product search '{q}'")
        ensured = self.api("post", "/api/products/ensure-by-name/", {"name": "Screen fix", "sale_price_retail": "10"}).data
        again = self.api("post", "/api/products/ensure-by-name/", {"name": "Screen fix"}).data
        self.soft(again["id"], ensured["id"], "ensure-by-name is idempotent")

        # Supplier rename.
        comp = self.api("post", "/api/companies/", {"name": "China Supply"}, expect=201).data
        self.api("patch", f"/api/companies/{comp['id']}/", {"name": "China Supply Co."})
        self.soft(self.api("get", f"/api/companies/{comp['id']}/").data["name"], "China Supply Co.", "supplier rename")

        # Customer: created here is copied to sibling shops; a rename follows.
        cust = self.api("post", "/api/customers/", {"name": "Rebin", "phone_1": "07709998877"}, expect=201).data
        self.soft(Customer.objects.filter(phone_1="07709998877").count(), Shop.objects.filter(is_active=True).count(),
                  "customer replicated to every active shop")
        self.api("patch", f"/api/customers/{cust['id']}/", {"name": "Rebin Ahmed", "address": "Sulaymaniyah"})
        names = set(Customer.objects.filter(phone_1="07709998877").values_list("name", flat=True))
        self.soft(names, {"Rebin Ahmed"}, "customer rename synced to every shop")

        # Buy with invoice number, then edit the purchase (qty and note).
        pur = self.api("post", "/api/purchases/", {
            "company": comp["id"], "occurred_at": timezone.now().isoformat(),
            "exchange_rate_usd_to_iqd": "1500", "amount_paid_usd": "0", "discount_received_usd": "0",
            "payment_type": "debt", "invoice_number": "77",
            "lines": [{"product": p.pk, "quantity": 20, "unit_cost_usd": "2", "damaged_quantity": 0}],
        }, expect=201).data
        self.assert_stock(p, 20)
        self.api("patch", f"/api/purchases/{pur['id']}/", {
            "note": "corrected", "lines": [{"product": p.pk, "quantity": 25, "unit_cost_usd": "2", "damaged_quantity": 0}],
        })
        self.assert_stock(p, 25)
        self.soft(Purchase.objects.get(pk=pur["id"]).note, "corrected", "purchase note edit")
        out = self.api("get", f"/api/purchases/company-outstanding/?company_id={comp['id']}").data["outstanding_usd"]
        self.soft(out, "50", "supplier debt follows edited purchase")
        hits = self.api("get", "/api/purchases/").data
        hits = hits["results"] if isinstance(hits, dict) else hits
        self.soft(len(hits), 1, "only this shop's purchases listed")

        # Return to supplier, then correct the return line's note.
        pur = self.api("get", f"/api/purchases/{pur['id']}/").data
        self.api("post", "/api/purchases/return-products/", {
            "purchase_id": pur["id"], "lines": [{"purchase_line_id": pur["lines"][0]["id"], "quantity": 5}],
        }, expect=201)
        self.assert_stock(p, 20)
        rl = self.api("get", "/api/purchases/returns-history/").data
        rl = rl["results"] if isinstance(rl, dict) else rl
        self.api("patch", f"/api/purchases/purchase-return-lines/{rl[0]['id']}/", {"note": "broken box"})
        self.api("patch", f"/api/purchases/{pur['id']}/", {"note": "x"}, expect=400)  # locked after return

        # Sell on credit, then correct the sale with PUT (price change).
        cust_here = Customer.objects.get(shop=new_shop, phone_1="07709998877")
        sale = self.api("post", "/api/sales/", {
            "customer": cust_here.pk, "occurred_at": timezone.now().isoformat(),
            "exchange_rate_usd_to_iqd": "1500", "invoice_discount_usd": "0",
            "amount_paid_usd": "10", "amount_paid_iqd": "0",
            "lines": [{"product": p.pk, "quantity": 4, "unit_price_usd": "6"}],
        }, expect=201).data
        self.soft(sale["unpaid_balance_usd"], "14", "credit sale balance")
        self.soft(sale["receipt_number"], 1, "new shop receipts start at 1")
        self.api("put", f"/api/sales/{sale['id']}/", {
            "customer": cust_here.pk, "occurred_at": sale["occurred_at"],
            "exchange_rate_usd_to_iqd": "1500", "invoice_discount_usd": "0",
            "amount_paid_usd": "10", "amount_paid_iqd": "0", "note": "price fixed",
            "lines": [{"product": p.pk, "quantity": 4, "unit_price_usd": "5"}],
        })
        sale = self.api("get", f"/api/sales/{sale['id']}/").data
        self.soft(sale["unpaid_balance_usd"], "10", "edited sale balance")
        self.assert_stock(p, 16)
        for q, expect_n in ((f"?customer_name=Rebin", 1), ("?payment_status=debt", 1), ("?payment_status=paid", 0),
                            ("?receipt_number=1", 1), ("?product_name=Cover", 1), ("?search=price fixed", 1)):
            rows = self.api("get", f"/api/sales/{q}").data
            rows = rows["results"] if isinstance(rows, dict) else rows
            self.soft(len(rows), expect_n, f"sales filter {q}")

        # Collect debt, then edit the payment's date.
        pay = self.api("post", f"/api/customers/{cust_here.pk}/collect-payment/", {"amount_paid_iqd": "7500"}).data
        self.soft(pay["outstanding_balance_usd_after"], "5", "IQD debt payment at shop rate")
        rows = self.api("get", "/api/customer-debt-payments/").data
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.soft(len(rows), 1, "debt payment recorded")

        # Expense: add, rename, change amount, delete.
        e = self.api("post", "/api/expenses/", {"name": "Generator", "amount": "20", "currency": "USD",
                                                "occurred_on": self.today()}, expect=201).data
        self.api("patch", f"/api/expenses/{e['id']}/", {"name": "Generator fuel", "amount": "25"})
        self.soft(Expense.objects.get(pk=e["id"]).name, "Generator fuel", "expense rename")
        rows = self.api("get", f"/api/expenses/?date_from={self.today()}&date_to={self.today()}").data
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.soft(len(rows), 1, "expense date filter")

        # Opening cash: set, read, delete.
        self.api("post", "/api/cashier/opening/", {"for_date": self.today(), "opening_cash_usd": "100"})
        snap = self.cashier()
        self.soft(snap["opening_cash_usd"], "100", "opening cash")
        # 100 opening + 10 sale + 5 debt payment - 25 expense
        self.soft(snap["current_cash_usd"], "90", "new shop cash drawer")
        op = self.api("get", "/api/cashier/opening/").data
        op_rows = op if isinstance(op, list) else op.get("results", op.get("rows", []))
        if op_rows:
            self.api("delete", f"/api/cashier/opening/{op_rows[0]['id']}/", expect=204)
            self.soft(self.cashier()["current_cash_usd"], "-10", "cash after removing opening")
        self.api("get", "/api/dashboard/petty-cash-trend/?days=7")
        self.api("get", f"/api/dashboard/stats/?from={self.today()}&to={self.today()}")
        self.api("get", f"/api/reports/jard/?from={self.today()}&to={self.today()}")

        # Activity log shows what the owner did today.
        acts = self.api("get", "/api/users/me-activity/").data["entries"]
        self.assertTrue(acts, "activity log should not be empty")

        # Superuser can work inside the shop by header, and only that shop's data comes back.
        self.as_user(self.admin)
        rows = self.client.get("/api/sales/", HTTP_X_SHOP_ID=str(new_shop.pk)).data
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.soft(len(rows), 1, "superuser X-Shop-ID scope")
        rows = self.client.get("/api/sales/").data
        rows = rows["results"] if isinstance(rows, dict) else rows
        self.soft(len(rows), 0, "superuser without scope sees no tenant rows")

        # Deactivate a user -> login refused; reactivate -> works.
        self.api("patch", f"/api/users/{boss.pk}/", {"is_active": False})
        self.client.force_authenticate(user=None)
        self.soft(self.code("post", "/api/auth/login/", {"email": "boss@new.test", "password": "Boss-pass-123"}),
                  401, "inactive user cannot log in")
        self.as_user(self.admin)
        self.api("patch", f"/api/users/{boss.pk}/", {"is_active": True})

        # A shop with sales history is protected from deletion, and nothing is half-deleted.
        before = (Product.objects.filter(shop_id=new_shop.pk).count(), Sale.objects.filter(shop_id=new_shop.pk).count())
        self.api("delete", f"/api/shops/{new_shop.pk}/", expect=409)
        after = (Product.objects.filter(shop_id=new_shop.pk).count(), Sale.objects.filter(shop_id=new_shop.pk).count())
        self.soft(after, before, "refused shop delete leaves data intact")
        self.soft(User.objects.filter(email="boss@new.test").count(), 1, "refused shop delete keeps users")
        # An empty shop (with a user) deletes cleanly, and nothing of other shops is touched.
        empty = self.api("post", "/api/shops/", {"name": "Empty", "slug": "empty"}, expect=201).data
        self.api("post", "/api/users/", {"email": "e@empty.test", "password": "Empty-pass-1",
                                         "shop": empty["id"], "role": "owner"}, expect=201)
        other_before = Sale.objects.filter(shop=self.shop).count()
        self.api("delete", f"/api/shops/{empty['id']}/", expect=204)
        self.soft(User.objects.filter(email="e@empty.test").count(), 0, "shop delete removes its users")
        self.soft(Sale.objects.filter(shop=self.shop).count(), other_before, "other shop untouched")
        self.soft(Customer.objects.filter(shop=self.shop, phone_1="07709998877").count(), 1,
                  "synced customer copy in other shop survives")
        self.done()

    # ------------------------------------------------------------------ online store

    def test_online_storefront_end_to_end(self):
        p = self.make_product(name="AirPods", buy="50", stock=10)
        self.api("patch", f"/api/products/{p.pk}/", {"sale_price_retail": "80"})
        self.shop.storefront_host = "shop-a.mmiraq.com"
        self.shop.save()

        st = self.api("patch", "/api/merchant/storefront-settings/", {}).data
        self.assertIsInstance(st, dict)
        zones = self.api("patch", "/api/merchant/storefront-delivery-zones/", {
            "zones": [{"name": "Erbil", "delivery_fee_usd": "3"}, {"name": "Duhok", "delivery_fee_usd": "5"}],
        }).data["zones"]
        self.soft(len(zones), 2, "delivery zones saved")
        self.api("patch", "/api/merchant/storefront-delivery-zones/", {
            "zones": [{"name": "Erbil", "delivery_fee_usd": "3"}, {"name": "erbil", "delivery_fee_usd": "1"}],
        }, expect=400)
        erbil = next(z for z in zones if z["name"] == "Erbil")

        def banner(title):
            res = self.client.post("/api/merchant/storefront-banners/",
                                   {"title": title, "image": _png(title)}, format="multipart")
            self.assertEqual(res.status_code, 201, getattr(res, "data", None))
            return res.data
        b1, b2 = banner("Sale"), banner("New")
        order = self.api("patch", "/api/merchant/storefront-banners/", {"order": [b2["id"], b1["id"]]}).data
        self.soft([b["id"] for b in order], [b2["id"], b1["id"]], "banner reorder")
        self.api("patch", f"/api/merchant/storefront-banners/{b1['id']}/", {"title": "Big Sale"})
        self.api("delete", f"/api/merchant/storefront-banners/{b2['id']}/", expect=204)

        self.api("patch", "/api/merchant/storefront-category-cards/", {
            "items": [{"id": self.category.pk, "storefront_home_order": 1, "storefront_bg_from": "#ff0000",
                       "storefront_bg_to": "#0000ff"}],
        })
        rows = self.api("patch", "/api/merchant/online-product-pricing/", {
            "items": [{"id": p.pk, "online_sale_price": "75", "online_description": "Wireless"}],
        }).data
        row = next(r for r in rows if r["id"] == p.pk)
        self.soft(row["online_sale_price"], "75", "online price saved")

        # Public side (no login).
        self.client.force_authenticate(user=None)
        res = self.api("get", f"/api/public/storefront/resolve/?host=shop-a.mmiraq.com").data
        self.soft(res["shop_id"], self.shop.pk, "storefront host resolves to shop")
        cat = self.api("get", f"/api/public/storefront/catalog/?shop_id={self.shop.pk}").data
        self.assertIn("AirPods", str(cat))
        self.api("get", f"/api/public/storefront/products/?shop_id={self.shop.pk}")
        self.api("get", "/api/public/storefront/catalog/?shop_id=999999", expect=400)
        order = self.api("post", "/api/public/storefront/submit_order/", {
            "shop": self.shop.pk, "customer_name": "Online Buyer", "customer_phone": "07501112233",
            "customer_address": "Erbil, 100m", "delivery_zone_id": erbil["id"],
            "items": [{"product": p.pk, "quantity": 2}],
        }, expect=201).data
        self.soft(order["total_amount"], "153", "online total = 2 x $75 + $3 delivery")
        self.api("post", "/api/public/storefront/submit_order/", {
            "shop": self.shop2.pk, "customer_name": "X", "customer_phone": "1", "customer_address": "Y",
            "items": [{"product": p.pk, "quantity": 1}],
        }, expect=400)
        self.assert_stock(p, 8)

        # Merchant side.
        self.as_user(self.employee)
        self.soft(self.api("get", "/api/merchant/storefront-orders/pending-count/").data["pending_count"], 1, "pending count")
        self.api("get", "/api/merchant/storefront-orders/stats/")
        self.soft(self.code("patch", "/api/merchant/storefront-settings/", {}), 403, "employee cannot change store settings")
        self.soft(self.code("post", "/api/merchant/storefront-banners/", {"title": "x"}), 403, "employee cannot add banners")
        # Changing order status needs the online-orders permission (not just being staff).
        self.soft(self.code("patch", f"/api/merchant/storefront-orders/{order['id']}/", {"status": "CANCELLED"}), 403,
                  "employee without permission cannot change order status")
        from django.contrib.auth.models import Permission

        self.employee.user_permissions.add(Permission.objects.get(codename="change_storefrontorder"))
        self.employee = type(self.employee).objects.get(pk=self.employee.pk)  # reset permission cache
        self.as_user(self.employee)
        self.api("patch", f"/api/merchant/storefront-orders/{order['id']}/", {"status": "CANCELLED"})
        self.assert_stock(p, 10)
        self.as_user(self.owner2)
        self.soft(self.code("get", "/api/merchant/storefront-orders/"), 403, "shop without storefront is blocked")
        self.done()

    # ------------------------------------------------------------------ marketing CMS

    def test_marketing_website_cms(self):
        editor = MarketingEditor(email="cms@mm.test", display_name="CMS")
        editor.set_password("Cms-pass-123")
        editor.save()
        self.client.force_authenticate(user=None)
        self.api("post", "/api/marketing/auth/login/", {"email": "cms@mm.test", "password": "bad"}, expect=401)
        tok = self.api("post", "/api/marketing/auth/login/", {"email": "CMS@mm.test", "password": "Cms-pass-123"}).data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"MarketingToken {tok}")
        self.api("get", "/api/marketing/auth/me/")
        self.api("post", "/api/marketing/site/", {"action": "import_defaults"})
        site = self.api("patch", "/api/marketing/site/", {"brand_name": "MM IRAQ Test"}).data
        self.soft(site.get("brand_name"), "MM IRAQ Test", "brand rename")

        cat = self.api("post", "/api/marketing/product-categories/", {"page": "tech", "title": {"en": "Phones"}}, expect=201).data
        self.api("patch", f"/api/marketing/product-categories/{cat['id']}/", {"title": {"en": "Smart Phones"}})
        card = self.api("post", "/api/marketing/products/", {"page": "tech", "category": cat["id"],
                                                             "title": {"en": "Galaxy"}, "tone": "cyan"}, expect=201).data
        self.api("patch", f"/api/marketing/products/{card['id']}/", {"title": {"en": "Galaxy S25"}})

        # Public site, a visitor sends a message, editor reads and deletes it.
        self.client.credentials()
        pub = self.api("get", "/api/public/marketing-site/").data
        self.soft(pub["is_published"], True, "site published")
        self.assertIn("Galaxy S25", str(self.api("get", "/api/public/marketing-products/?page=tech").data))
        msg = self.api("post", "/api/public/marketing-contact/", {"name": "Visitor", "email": "v@x.test",
                                                                 "message": "Hello"}, expect=201).data
        self.client.credentials(HTTP_AUTHORIZATION=f"MarketingToken {tok}")
        self.soft(self.api("get", "/api/marketing/contact/stats/").data["unread"], 1, "unread message")
        self.api("patch", f"/api/marketing/contact/{msg['id']}/", {"is_read": True})
        self.soft(self.api("get", "/api/marketing/contact/stats/").data["unread"], 0, "marked read")
        self.api("delete", f"/api/marketing/contact/{msg['id']}/", expect=204)
        self.api("delete", f"/api/marketing/products/{card['id']}/", expect=204)
        self.api("delete", f"/api/marketing/product-categories/{cat['id']}/", expect=204)

        # POS token does not open the CMS, CMS token does not open the POS.
        self.api("post", "/api/marketing/auth/logout/")
        self.assertIn(self.code("get", "/api/marketing/auth/me/"), (401, 403), "CMS logout")
        self.client.credentials()
        self.as_user(self.owner)
        self.soft(self.code("get", "/api/marketing/site/"), 403, "shop owner cannot edit marketing site")
        self.done()

    # ------------------------------------------------------------------ QR landing

    def test_qr_landing_page(self):
        self.as_user(self.admin)
        self.api("patch", "/api/admin/qr-landing/", {"headline": "MM Iraq", "phone": "07500000000"})
        link = self.api("post", "/api/admin/qr-landing/custom-links/", {"label": "Website", "url": "https://mmiraq.com"},
                        expect=201).data
        self.api("patch", f"/api/admin/qr-landing/custom-links/{link['id']}/", {"label": "Our site"})
        self.client.force_authenticate(user=None)
        pub = self.api("get", "/api/public/qr-landing/").data
        self.assertIn("MM Iraq", str(pub))
        self.assertIn("Our site", str(pub))
        self.as_user(self.owner)
        self.soft(self.code("get", "/api/admin/qr-landing/"), 403, "owner cannot edit QR page")
        self.as_user(self.admin)
        self.api("delete", f"/api/admin/qr-landing/custom-links/{link['id']}/", expect=204)
        self.done()

    # ------------------------------------------------------------------ staff money

    def test_staff_permissions_and_money_edits(self):
        # Employee with exact perms for expenses only.
        clerk = User.objects.create_user("clerk@a.test", "Clerk-pass-1", shop=self.shop, role=UserRole.EMPLOYEE)
        clerk.user_permissions.set(Permission.objects.filter(codename__in=["view_expense", "add_expense"]))
        self.as_user(User.objects.get(pk=clerk.pk))
        e = self.api("post", "/api/expenses/", {"name": "Tea", "amount": "3000", "currency": "IQD",
                                                "occurred_on": self.today()}, expect=201).data
        self.soft(e["amount_usd"], "2", "IQD expense converted")
        self.soft(self.code("patch", f"/api/expenses/{e['id']}/", {"amount": "1"}), 403, "no change_expense perm")
        self.soft(self.code("delete", f"/api/expenses/{e['id']}/"), 403, "no delete_expense perm")
        self.soft(self.code("get", "/api/sales/"), 403, "clerk cannot see sales")

        # Owner edits and deletes employee debt rows; summary follows.
        self.as_user(self.owner)
        d = self.api("post", "/api/employee-debts/", {"employee": clerk.pk, "amount": "40", "debt_type": "taken",
                                                      "occurred_on": self.today()}, expect=201).data
        self.api("patch", f"/api/employee-debts/{d['id']}/", {"amount": "30"})
        summ = self.api("get", "/api/employee-debts/summary/").data["employees"]
        self.assertIn("30", str(summ))
        self.api("delete", f"/api/employee-debts/{d['id']}/", expect=204)

        # Shareholders: rename, edit share, month recalculation, payout edit.
        sh = self.api("post", "/api/shareholders/", {"name": "Ali", "share_percentage": "50"}, expect=201).data
        self.api("patch", f"/api/shareholders/{sh['id']}/", {"name": "Ali Karim", "share_percentage": "40"})
        import datetime as dt
        last_month = (timezone.localdate().replace(day=1) - dt.timedelta(days=1)).replace(day=1)
        self.api("patch", f"/api/shareholders/{sh['id']}/", {"wallet_start_month": last_month.isoformat()})
        p = self.make_product(buy="10", stock=10)
        when = timezone.make_aware(dt.datetime.combine(last_month.replace(day=10), dt.time(12)))
        self.sell([(p, 10, "30")], paid_usd="300", occurred_at=when)
        self.api("post", "/api/shareholders/recalculate-month/", {"month": last_month.isoformat()})
        w = {x["name"]: x for x in self.api("get", "/api/shareholders/wallets/").data["wallets"]}
        bal = D(w["Ali Karim"]["balance_usd"])
        self.assertGreater(bal, 0, "shareholder earns from profit after recalculation")
        pay = self.api("post", "/api/shareholder-payments/", {"shareholder": sh["id"], "amount_usd": "10",
                                                               "paid_on": self.today()}, expect=201).data
        self.api("patch", f"/api/shareholder-payments/{pay['id']}/", {"amount_usd": "15"})
        w = {x["name"]: x for x in self.api("get", "/api/shareholders/wallets/").data["wallets"]}
        self.soft(D(w["Ali Karim"]["balance_usd"]), bal - 15, "payout edit updates wallet")
        self.done()


    # ------------------------------------------------------------------ uploads

    def test_image_uploads(self):
        import shutil
        import tempfile

        from django.test import override_settings

        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        with override_settings(MEDIA_ROOT=media):
            p = self.make_product(name="Watch", buy="10", stock=1)
            # Product photo and category photo.
            res = self.client.patch(f"/api/products/{p.pk}/", {"image": _png("watch")}, format="multipart")
            self.assertEqual(res.status_code, 200, getattr(res, "data", None))
            res = self.client.patch(f"/api/categories/{self.category.pk}/", {"image": _png("cat")}, format="multipart")
            self.assertEqual(res.status_code, 200, getattr(res, "data", None))
            # Online gallery: add two, delete one.
            ids = []
            for n in ("g1", "g2"):
                res = self.client.post(f"/api/merchant/online-product-pricing/{p.pk}/gallery/",
                                       {"image": _png(n)}, format="multipart")
                self.assertEqual(res.status_code, 201, getattr(res, "data", None))
                ids.append(res.data["id"])
            self.api("delete", f"/api/merchant/online-product-pricing/gallery/{ids[0]}/", expect=204)
            # Receipt logo and profile picture.
            res = self.client.patch("/api/receipt-settings/", {"logo": _png("logo")}, format="multipart")
            self.assertEqual(res.status_code, 200, getattr(res, "data", None))
            self.assertTrue(res.data["logo_url"])
            res = self.client.patch("/api/users/me/profile/", {"profile_picture": _png("me")}, format="multipart")
            self.assertEqual(res.status_code, 200, getattr(res, "data", None))
            # Another shop cannot touch this gallery.
            self.as_user(self.owner2)
            self.soft(self.code("delete", f"/api/merchant/online-product-pricing/gallery/{ids[1]}/"), 403,
                      "other shop cannot delete gallery image")
        self.done()


    def test_gallery_rejects_non_image_files(self):
        import shutil
        import tempfile

        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.test import override_settings

        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        with override_settings(MEDIA_ROOT=media):
            p = self.make_product(name="Watch", buy="10", stock=1)
            for name, body in (("x.png", b"not an image"), ("x.html", b"<script>alert(1)</script>")):
                bad = SimpleUploadedFile(name, body, content_type="image/png")
                res = self.client.post(f"/api/merchant/online-product-pricing/{p.pk}/gallery/", {"image": bad},
                                       format="multipart")
                self.assertEqual(res.status_code, 400, f"{name} must be rejected")


    def test_gallery_accepts_every_common_image_format(self):
        import io
        import shutil
        import tempfile

        from django.core.files.uploadedfile import SimpleUploadedFile
        from django.test import override_settings
        from PIL import Image

        from inventory.models import StorefrontProductGalleryImage

        media = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        with override_settings(MEDIA_ROOT=media):
            p = self.make_product(name="Camera", buy="10", stock=1)
            formats = [("JPEG", "photo.jpg", "jpg"), ("JPEG", "photo.JPEG", "jpg"), ("PNG", "a.png", "png"),
                       ("GIF", "a.gif", "gif"), ("WEBP", "a.webp", "webp"), ("BMP", "a.bmp", "bmp"),
                       ("TIFF", "a.tif", "tiff")]
            from PIL import features
            if features.check("avif"):
                formats.append(("AVIF", "a.avif", "avif"))
            # Wrong extension does not matter; real content decides the stored extension.
            formats.append(("PNG", "camera-upload", "png"))
            formats.append(("PNG", "trick.html", "png"))
            StorefrontProductGalleryImage.objects.filter(product=p).delete()
            for fmt, name, ext in formats:
                buf = io.BytesIO()
                Image.new("RGB", (30, 30), (10, 120, 200)).save(buf, format=fmt)
                up = SimpleUploadedFile(name, buf.getvalue(), content_type="application/octet-stream")
                res = self.client.post(f"/api/merchant/online-product-pricing/{p.pk}/gallery/", {"image": up},
                                       format="multipart")
                self.assertEqual(res.status_code, 201, f"{fmt} {name}: {getattr(res, 'data', None)}")
                stored = StorefrontProductGalleryImage.objects.get(pk=res.data["id"]).image.name
                self.assertTrue(stored.endswith("." + ext), f"{name} stored as {stored}")
                StorefrontProductGalleryImage.objects.filter(pk=res.data["id"]).delete()  # stay under the 10 limit
            # Truncated/corrupt image is refused.
            buf = io.BytesIO()
            Image.new("RGB", (30, 30)).save(buf, format="PNG")
            broken = SimpleUploadedFile("b.png", buf.getvalue()[:40], content_type="image/png")
            res = self.client.post(f"/api/merchant/online-product-pricing/{p.pk}/gallery/", {"image": broken},
                                   format="multipart")
            self.assertEqual(res.status_code, 400)
            self.assertFalse(StorefrontProductGalleryImage.objects.filter(product=p).exists())


def _is_num(v) -> bool:
    try:
        Decimal(str(v))
        return not isinstance(v, (set, list, dict, bool))
    except Exception:
        return False


def _png(name: str):
    import io

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (40, 20), (200, 50, 50)).save(buf, format="PNG")
    return SimpleUploadedFile(f"{name}.png", buf.getvalue(), content_type="image/png")
