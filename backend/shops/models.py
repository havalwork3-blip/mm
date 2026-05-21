from django.core.validators import MinValueValidator
from django.db import models


class Shop(models.Model):
    """A tenant boundary; each shop has its own settings and isolated data."""

    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, db_index=True)
    settings = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    online_storefront_enabled = models.BooleanField(
        default=False,
        help_text="Public online catalog + checkout for this shop.",
    )
    storefront_host = models.CharField(
        max_length=255,
        blank=True,
        default="",
        db_index=True,
        help_text="Customer-facing host, e.g. rada.mmiraq.com (unique when set).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        permissions = [
            ("view_profitreport", "Can view profit report"),
            ("view_cashier", "Can use cashier (Qasa)"),
            (
                "view_jard_financials",
                "Can view Jard buy prices, stock value, and sales totals",
            ),
        ]

    def __str__(self) -> str:
        return self.name


class ShopScopedModel(models.Model):
    """Abstract base: all tenant-owned rows reference a shop."""

    shop = models.ForeignKey(
        Shop,
        on_delete=models.CASCADE,
        db_index=True,
    )

    class Meta:
        abstract = True


class Currency(ShopScopedModel):
    """Daily USD → IQD exchange rate for a shop."""

    date = models.DateField(db_index=True)
    usd_to_iqd = models.DecimalField(max_digits=18, decimal_places=4)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "date"],
                name="uniq_currency_shop_date",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.shop.slug} {self.date} {self.usd_to_iqd}"


class ReceiptSettings(ShopScopedModel):
    class ReceiptFormat(models.TextChoices):
        A4 = "A4", "A4"
        MM80 = "80MM", "80MM"

    logo = models.ImageField(upload_to="receipt-logos/%Y/%m/", blank=True, null=True)
    shop_name_en = models.CharField(max_length=255, blank=True)
    shop_name_ku = models.CharField(max_length=255, blank=True)
    sub_title = models.CharField(
        max_length=255,
        default="بۆ بازرگانی مۆبایل و پێداویستییەکانی",
        blank=True,
    )
    address = models.CharField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=64, blank=True)
    email = models.EmailField(blank=True)
    # Text encoded into the on-receipt QR (any URL or custom string). Shown on PDF/print only; generated in-browser.
    receipt_qr_url = models.TextField(blank=True, default="")
    # Short customer-facing hint shown above the QR on the receipt (editable in settings).
    receipt_qr_caption = models.TextField(blank=True, default="")
    footer_note = models.CharField(
        max_length=255,
        default="هەڵە و سەهوو دەگەڕێتەوە بۆ هەردوولا",
        blank=True,
    )
    direct_print = models.BooleanField(default=False)
    show_customer_balance = models.BooleanField(default=True)
    show_item_images = models.BooleanField(default=True)
    receipt_format = models.CharField(
        max_length=8,
        choices=ReceiptFormat.choices,
        default=ReceiptFormat.MM80,
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["shop"], name="uniq_receipt_settings_shop"),
        ]

    def __str__(self) -> str:
        return f"ReceiptSettings({self.shop_id})"


class StorefrontSettings(ShopScopedModel):
    """Customer-facing online shop copy and theme (per tenant)."""

    catalog_title = models.CharField(max_length=255, blank=True, default="")
    catalog_subtitle = models.CharField(max_length=500, blank=True, default="")
    header_show_shop_name = models.BooleanField(
        default=False,
        help_text="If catalog title is empty, show shop legal name in the storefront header.",
    )
    home_categories_title = models.CharField(max_length=200, blank=True, default="")
    home_highlights_title = models.CharField(max_length=200, blank=True, default="")
    home_collection_titles = models.JSONField(default=dict, blank=True)
    welcome_message = models.CharField(max_length=1000, blank=True, default="")
    logo = models.ImageField(upload_to="storefront-logos/%Y/%m/", blank=True, null=True)
    accent_color = models.CharField(max_length=32, default="#fbbf24")
    banner_rotate_seconds = models.PositiveSmallIntegerField(default=5)

    class PriceDisplay(models.TextChoices):
        USD = "usd", "USD"
        IQD = "iqd", "IQD"
        BOTH = "both", "Both"

    price_display_default = models.CharField(
        max_length=8,
        choices=PriceDisplay.choices,
        default=PriceDisplay.USD,
    )
    contact_phone = models.CharField(max_length=64, blank=True, default="")
    contact_whatsapp = models.CharField(max_length=64, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    about_title = models.CharField(max_length=255, blank=True, default="")
    about_body = models.TextField(blank=True, default="")
    faq_items = models.JSONField(default=list, blank=True)
    shop_address = models.CharField(max_length=500, blank=True, default="")
    location_url = models.URLField(blank=True, default="")
    location_image = models.ImageField(
        upload_to="storefront-location/%Y/%m/",
        blank=True,
        null=True,
    )
    social_links = models.JSONField(default=list, blank=True)
    delivery_free_min_usd = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[MinValueValidator(0)],
        help_text="Subtotal (USD) at or above this gets free delivery; null/0 = off.",
    )
    telegram_notify_enabled = models.BooleanField(default=False)
    telegram_bot_token = models.CharField(max_length=256, blank=True, default="")
    telegram_link_code = models.CharField(max_length=32, blank=True, default="")
    telegram_recipients = models.JSONField(default=list, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["shop"],
                name="uniq_storefront_settings_shop",
            ),
        ]

    def __str__(self) -> str:
        return f"StorefrontSettings({self.shop_id})"


class StorefrontDeliveryZone(ShopScopedModel):
    """Per-area delivery fee for the public online storefront."""

    name = models.CharField(max_length=255)
    delivery_fee_usd = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=0,
        validators=[MinValueValidator(0)],
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["shop", "name"],
                name="uniq_storefront_delivery_zone_shop_name",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.shop_id})"


class StorefrontBanner(ShopScopedModel):
    """Rotating hero banners on the public online storefront."""

    class LinkType(models.TextChoices):
        NONE = "none", "None"
        URL = "url", "External URL"
        CATEGORY = "category", "Product category"

    sort_order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=255, blank=True, default="")
    subtitle = models.CharField(max_length=500, blank=True, default="")
    image = models.ImageField(upload_to="storefront-banners/%Y/%m/", blank=True, null=True)
    link_type = models.CharField(
        max_length=16,
        choices=LinkType.choices,
        default=LinkType.NONE,
    )
    link_url = models.URLField(max_length=500, blank=True, default="")
    category = models.ForeignKey(
        "inventory.Category",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="storefront_banners",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return f"StorefrontBanner({self.shop_id}, #{self.pk})"


class ShopSettings(ShopScopedModel):
    class DefaultMode(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"
        SYSTEM = "system", "System"

    class BaseCurrency(models.TextChoices):
        USD = "USD", "USD"
        IQD = "IQD", "IQD"

    primary_color = models.CharField(max_length=7, default="#7c3aed")
    background_color = models.CharField(max_length=7, default="#f1f5f9")
    dark_background_color = models.CharField(max_length=7, default="#0f172a")
    accent_color = models.CharField(max_length=7, default="#06b6d4")
    sidebar_color = models.CharField(max_length=7, default="#0f172a")
    surface_color = models.CharField(max_length=7, default="#ffffff")
    surface_color_dark = models.CharField(max_length=7, default="#1e293b")
    success_color = models.CharField(max_length=7, default="#16a34a")
    warning_color = models.CharField(max_length=7, default="#f59e0b")
    danger_color = models.CharField(max_length=7, default="#ef4444")
    default_mode = models.CharField(
        max_length=10,
        choices=DefaultMode.choices,
        default=DefaultMode.SYSTEM,
    )
    low_stock_threshold = models.PositiveIntegerField(default=5)
    base_currency = models.CharField(
        max_length=3,
        choices=BaseCurrency.choices,
        default=BaseCurrency.USD,
    )
    complete_sale_shortcut = models.CharField(max_length=32, default="F12")
    online_order_sound_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["shop"], name="uniq_shop_settings_shop"),
        ]

    def __str__(self) -> str:
        return f"ShopSettings({self.shop_id})"


def _default_qr_preset_links():
    return [
        {"id": "instagram", "url": "", "enabled": True},
        {"id": "facebook", "url": "", "enabled": True},
        {"id": "tiktok", "url": "", "enabled": True},
        {"id": "youtube", "url": "", "enabled": True},
        {"id": "whatsapp", "url": "", "enabled": True},
        {"id": "telegram", "url": "", "enabled": True},
        {"id": "snapchat", "url": "", "enabled": True},
        {"id": "x", "url": "", "enabled": True},
        {"id": "website", "url": "", "enabled": True},
    ]


class QrLandingSettings(models.Model):
    """Singleton (pk=1): global public page at /qr-code — one QR for all shops."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    headline = models.CharField(max_length=255, blank=True, default="")
    tagline = models.CharField(max_length=500, blank=True, default="")
    accent_color = models.CharField(max_length=32, default="#c9a962")
    primary_logo = models.ImageField(upload_to="qr-landing/", blank=True, null=True)
    phone = models.CharField(max_length=64, blank=True, default="")
    preset_links = models.JSONField(default=_default_qr_preset_links)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "QR landing settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, created = cls.objects.get_or_create(
            pk=1,
            defaults={
                "preset_links": _default_qr_preset_links(),
            },
        )
        if not created and (not isinstance(obj.preset_links, list) or len(obj.preset_links) < 9):
            obj.preset_links = _default_qr_preset_links()
            obj.save(update_fields=["preset_links"])
        return obj


class QrLandingCustomLink(models.Model):
    """Extra buttons on the global QR landing page (custom bg + logo per row)."""

    settings = models.ForeignKey(
        QrLandingSettings,
        on_delete=models.CASCADE,
        related_name="extra_links",
    )
    sort_order = models.PositiveIntegerField(default=0)
    label = models.CharField(max_length=120)
    url = models.CharField(max_length=500)
    enabled = models.BooleanField(default=True)
    bg_color = models.CharField(max_length=32, blank=True, default="#14110f")
    logo = models.ImageField(upload_to="qr-landing/custom/", blank=True, null=True)

    class Meta:
        ordering = ["sort_order", "id"]

    def __str__(self) -> str:
        return self.label
