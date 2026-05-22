from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from shops.models import ShopScopedModel


class Category(ShopScopedModel):
    name = models.CharField(max_length=255)
    name_ku = models.CharField(max_length=255, blank=True, default="")
    name_ar = models.CharField(max_length=255, blank=True, default="")
    name_en = models.CharField(max_length=255, blank=True, default="")
    image = models.ImageField(upload_to="categories/%Y/%m/", blank=True, null=True)

    class Meta:
        ordering = ["name_ku", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "name"],
                name="uniq_inventory_category_shop_name",
            ),
        ]

    def save(self, *args, **kwargs):
        primary = (self.name_ku or self.name or "").strip()
        if primary:
            self.name_ku = primary
            self.name = primary
        super().save(*args, **kwargs)

    def display_name(self, lang: str = "ku") -> str:
        lang = (lang or "ku").lower()[:2]
        if lang == "ar":
            ar = (self.name_ar or "").strip()
            if ar:
                return ar
        if lang == "en":
            en = (self.name_en or "").strip()
            if en:
                return en
        return (self.name_ku or self.name or "").strip()

    def __str__(self) -> str:
        return self.display_name("ku") or self.name


class Product(ShopScopedModel):
    name = models.CharField(max_length=255, db_index=True)
    # Auto-created from POS manual entries; needs full registration/review in inventory.
    is_unregistered_placeholder = models.BooleanField(default=False)
    # Shop will not restock / carry this product anymore (hidden from POS & purchase pickers by default).
    is_discontinued = models.BooleanField(default=False, db_index=True)
    image = models.ImageField(upload_to="products/%Y/%m/", blank=True, null=True)
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    sku = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    barcode = models.CharField(max_length=128, blank=True, null=True)

    buy_price = models.DecimalField(max_digits=18, decimal_places=4)
    sale_price_retail = models.DecimalField(max_digits=18, decimal_places=4)
    sale_price_wholesale = models.DecimalField(max_digits=18, decimal_places=4)
    online_sale_price = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
    )
    online_discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
    )
    online_discount_min_quantity = models.PositiveSmallIntegerField(default=1)
    online_description = models.TextField(
        blank=True,
        default="",
        help_text="Extra product info shown on the public online storefront.",
    )
    current_stock_quantity = models.IntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "sku"],
                condition=models.Q(sku__isnull=False),
                name="uniq_product_shop_sku_when_set",
            ),
            models.UniqueConstraint(
                fields=["shop", "barcode"],
                condition=models.Q(barcode__isnull=False),
                name="uniq_product_shop_barcode_when_set",
            ),
        ]

    def __str__(self) -> str:
        return self.name

    def get_prices_iqd(self, rate: Decimal | float | str) -> dict[str, Decimal]:
        """
        Convert USD list prices to IQD using the given USD→IQD rate (IQD per 1 USD).
        """
        r = Decimal(str(rate))
        return {
            "retail_iqd": (self.sale_price_retail * r).quantize(Decimal("0.0001")),
            "wholesale_iqd": (self.sale_price_wholesale * r).quantize(Decimal("0.0001")),
        }


class Company(ShopScopedModel):
    name = models.CharField(max_length=255)
    phone_1 = models.CharField(max_length=32, blank=True)
    phone_2 = models.CharField(max_length=32, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "companies"

    def __str__(self) -> str:
        return self.name


class Customer(ShopScopedModel):
    name = models.CharField(max_length=255)
    workplace = models.CharField(max_length=255, blank=True)
    address = models.CharField(max_length=255, blank=True)
    phone_1 = models.CharField(max_length=32, blank=True, db_index=True)
    phone_2 = models.CharField(max_length=32, blank=True)
    requires_attention = models.BooleanField(default=False)
    note = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Purchase(ShopScopedModel):
    """Stock-in: records the exchange rate used for profit analysis on this purchase."""

    class PurchaseCurrency(models.TextChoices):
        USD = "USD", "USD"
        IQD = "IQD", "IQD"

    class PurchasePaymentType(models.TextChoices):
        CASH = "cash", "cash"
        DEBT = "debt", "debt"

    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchases",
    )
    occurred_at = models.DateTimeField()
    exchange_rate_usd_to_iqd = models.DecimalField(max_digits=18, decimal_places=4)
    """Supplier/company discount received on this bill (USD), improves net profit."""
    discount_received_usd = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal("0"))
    """Amount already paid to the supplier toward this purchase (USD)."""
    amount_paid_usd = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal("0"))
    invoice_number = models.CharField(max_length=128, blank=True, default="")
    note = models.TextField(blank=True, default="")
    currency = models.CharField(
        max_length=3,
        choices=PurchaseCurrency.choices,
        default=PurchaseCurrency.USD,
    )
    payment_type = models.CharField(
        max_length=8,
        choices=PurchasePaymentType.choices,
        default=PurchasePaymentType.DEBT,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "invoice_number"],
                condition=models.Q(invoice_number__gt=""),
                name="uniq_purchase_shop_invoice_number_when_set",
            ),
        ]


class PurchaseLine(models.Model):
    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="purchase_lines",
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_cost_usd = models.DecimalField(max_digits=18, decimal_places=4)
    damaged_quantity = models.PositiveIntegerField(default=0)


class PurchaseReturn(ShopScopedModel):
    """Supplier returns linked to an original purchase."""

    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.PROTECT,
        related_name="returns",
    )
    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="purchase_returns",
    )
    occurred_at = models.DateTimeField(auto_now_add=True)
    note = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-occurred_at", "-id"]


class PurchaseReturnLine(models.Model):
    purchase_return = models.ForeignKey(
        PurchaseReturn,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    purchase_line = models.ForeignKey(
        PurchaseLine,
        on_delete=models.PROTECT,
        related_name="return_lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        related_name="purchase_return_lines",
        null=True,
        blank=True,
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    # Must match the original purchase line unit cost.
    unit_cost_usd = models.DecimalField(max_digits=18, decimal_places=4)


class Sale(ShopScopedModel):
    """Stock-out: snapshot exchange rate and payments at creation time."""

    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sales",
    )
    occurred_at = models.DateTimeField()
    exchange_rate_usd_to_iqd = models.DecimalField(max_digits=18, decimal_places=4)
    """Invoice-level discount granted to the customer (USD)."""
    invoice_discount_usd = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal("0"))
    amount_paid_iqd = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal("0"))
    amount_paid_usd = models.DecimalField(max_digits=18, decimal_places=4, default=Decimal("0"))
    receipt_number = models.PositiveIntegerField(db_index=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "receipt_number"],
                name="uniq_sale_shop_receipt_number",
            ),
        ]


class SaleLine(models.Model):
    sale = models.ForeignKey(
        Sale,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        related_name="sale_lines",
        null=True,
        blank=True,
    )
    manual_name = models.CharField(max_length=255, blank=True, default="")
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price_usd = models.DecimalField(max_digits=18, decimal_places=4)
    """Product buy price (USD) at sale time — used for profit and reporting."""
    unit_buy_price_usd = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0"),
    )


class SaleReturn(ShopScopedModel):
    """Customer product returns linked to an original sale."""

    sale = models.ForeignKey(
        Sale,
        on_delete=models.PROTECT,
        related_name="returns",
    )
    customer = models.ForeignKey(
        Customer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sale_returns",
    )
    occurred_at = models.DateTimeField(auto_now_add=True)
    note = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-occurred_at", "-id"]


class SaleReturnLine(models.Model):
    sale_return = models.ForeignKey(
        SaleReturn,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    sale_line = models.ForeignKey(
        SaleLine,
        on_delete=models.PROTECT,
        related_name="return_lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        related_name="sale_return_lines",
        null=True,
        blank=True,
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    # Must match the original sale line price.
    unit_price_usd = models.DecimalField(max_digits=18, decimal_places=4)


class ExpenseCurrency(models.TextChoices):
    USD = "USD", "USD"
    IQD = "IQD", "IQD"


class Expense(ShopScopedModel):
    """Shop expenses (سەرفیات). IQD amounts store the rate snapshot used for USD conversion."""

    name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=18, decimal_places=4)
    currency = models.CharField(
        max_length=3,
        choices=ExpenseCurrency.choices,
        default=ExpenseCurrency.USD,
    )
    note = models.TextField(blank=True)
    occurred_on = models.DateField(db_index=True)
    exchange_rate_usd_to_iqd = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Required when currency is IQD: IQD per 1 USD at entry time.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_on", "-id"]

    def amount_usd(self) -> Decimal:
        if self.currency == ExpenseCurrency.USD:
            return self.amount
        if self.exchange_rate_usd_to_iqd and self.exchange_rate_usd_to_iqd > 0:
            return (self.amount / self.exchange_rate_usd_to_iqd).quantize(Decimal("0.0001"))
        return Decimal("0")


class Shareholder(ShopScopedModel):
    name = models.CharField(max_length=255)
    share_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
        help_text="Share of net profit, e.g. 30.00 means 30%",
    )
    capital_contribution_usd = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Partner capital recorded in the system (USD).",
    )

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "name"],
                name="uniq_shareholder_shop_name",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.share_percentage}%)"


class EmployeeDebtType(models.TextChoices):
    TAKEN = "taken", "Taken"
    RETURNED = "returned", "Returned"


class EmployeeDebt(ShopScopedModel):
    """Cash taken from / returned to the till by an employee (USD)."""

    employee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="employee_debts",
    )
    amount = models.DecimalField(max_digits=18, decimal_places=4)
    debt_type = models.CharField(max_length=10, choices=EmployeeDebtType.choices)
    occurred_on = models.DateField(db_index=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_on", "-id"]


class ShopDayOpeningCash(ShopScopedModel):
    """Opening cash (USD) for a business day — used in Qasa / cashier reconciliation."""

    for_date = models.DateField(db_index=True)
    opening_cash_usd = models.DecimalField(max_digits=18, decimal_places=4)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "for_date"],
                name="uniq_shop_opening_date",
            ),
        ]


class StorefrontProductGalleryImage(models.Model):
    """Extra product photos for the online storefront (reviews / gallery)."""

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="storefront_gallery_images",
    )
    image = models.ImageField(upload_to="storefront-gallery/%Y/%m/")
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return f"GalleryImage(product={self.product_id}, #{self.sort_order})"


class StorefrontOrderStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PROCESSING = "PROCESSING", "Processing"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class StorefrontOrder(ShopScopedModel):
    """Online customer order submitted via the public storefront."""

    customer_name = models.CharField(max_length=255)
    customer_phone = models.CharField(max_length=32)
    customer_address = models.TextField()
    customer_notes = models.TextField(blank=True, default="")
    subtotal_amount = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
    )
    delivery_zone = models.ForeignKey(
        "shops.StorefrontDeliveryZone",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
    )
    delivery_zone_name = models.CharField(max_length=255, blank=True, default="")
    delivery_fee = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    total_amount = models.DecimalField(max_digits=18, decimal_places=4)
    status = models.CharField(
        max_length=16,
        choices=StorefrontOrderStatus.choices,
        default=StorefrontOrderStatus.PENDING,
        db_index=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class StorefrontOrderItem(models.Model):
    order = models.ForeignKey(
        StorefrontOrder,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="storefront_order_items",
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=18, decimal_places=4)
