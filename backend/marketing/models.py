import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone

from .defaults import default_sections, default_translations

DEFAULT_BRAND_NAME = "MM IRAQ"
DEFAULT_BRAND_LOGO_PATH = "/logo-optimized.webp"


class MarketingEditor(models.Model):
    """Separate CMS login — not linked to POS / inventory accounts.User."""

    email = models.EmailField(unique=True, db_index=True)
    password_hash = models.CharField(max_length=128)
    display_name = models.CharField(max_length=120, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["email"]

    def __str__(self) -> str:
        return self.email

    def set_password(self, raw_password: str) -> None:
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return check_password(raw_password, self.password_hash)


class MarketingAuthToken(models.Model):
    key = models.CharField(max_length=64, unique=True, db_index=True)
    editor = models.ForeignKey(
        MarketingEditor,
        on_delete=models.CASCADE,
        related_name="tokens",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)

    class Meta:
        ordering = ["-created_at"]

    @classmethod
    def create_for_editor(cls, editor: MarketingEditor, *, days: int = 30) -> "MarketingAuthToken":
        cls.objects.filter(editor=editor, expires_at__lt=timezone.now()).delete()
        return cls.objects.create(
            key=secrets.token_hex(32),
            editor=editor,
            expires_at=timezone.now() + timedelta(days=days),
        )

    @property
    def is_valid(self) -> bool:
        return self.expires_at >= timezone.now()


class MarketingSiteContent(models.Model):
    """Singleton: published copy for mmiraq.com landing (ckb / ar / en)."""

    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    translations = models.JSONField(default=dict, blank=True)
    sections = models.JSONField(default=dict, blank=True)
    brand_name = models.CharField(max_length=120, blank=True, default=DEFAULT_BRAND_NAME)
    brand_logo = models.ImageField(upload_to="marketing-brand/", blank=True, null=True)
    is_published = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Marketing site content"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "MarketingSiteContent":
        obj, _created = cls.objects.get_or_create(pk=1)
        changed = False
        if not obj.translations:
            obj.translations = default_translations()
            changed = True
        if not obj.sections:
            obj.sections = default_sections()
            changed = True
        if changed:
            obj.save(update_fields=["translations", "sections", "updated_at"])
        return obj


class ContactMessage(models.Model):
    """Visitor message from mmiraq.com contact form."""

    name = models.CharField(max_length=120)
    email = models.EmailField()
    message = models.TextField()
    lang = models.CharField(max_length=8, blank=True, default="ckb")
    is_read = models.BooleanField(default=False)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} <{self.email}>"


class MarketingProductCategory(models.Model):
    class Page(models.TextChoices):
        LUXURY = "luxury", "Luxury"
        TECH = "tech", "Technology"
        SHOP = "shop", "Shop"
        SERVICES = "services", "Services"

    page = models.CharField(max_length=32, choices=Page.choices, db_index=True)
    title = models.JSONField(default=dict, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["page", "sort_order", "id"]
        verbose_name_plural = "Marketing product categories"

    def __str__(self) -> str:
        t = self.title if isinstance(self.title, dict) else {}
        return t.get("ckb") or t.get("en") or f"{self.page} #{self.pk}"


class MarketingProductCard(models.Model):
    class Page(models.TextChoices):
        LUXURY = "luxury", "Luxury"
        TECH = "tech", "Technology"
        SHOP = "shop", "Shop"
        SERVICES = "services", "Services"

    class Tone(models.TextChoices):
        VIOLET = "violet", "Violet"
        CYAN = "cyan", "Cyan"
        GOLD = "gold", "Gold"
        INDIGO = "indigo", "Indigo"

    page = models.CharField(max_length=32, choices=Page.choices, db_index=True)
    category = models.ForeignKey(
        MarketingProductCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="products",
    )
    title = models.JSONField(default=dict, blank=True)
    tag = models.JSONField(default=dict, blank=True)
    image = models.ImageField(upload_to="marketing-products/%Y/%m/", blank=True, null=True)
    link_url = models.CharField(max_length=500, blank=True, default="")
    tone = models.CharField(max_length=16, choices=Tone.choices, default=Tone.VIOLET)
    sort_order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["page", "sort_order", "id"]

    def __str__(self) -> str:
        t = self.title if isinstance(self.title, dict) else {}
        return t.get("ckb") or t.get("en") or f"Product #{self.pk}"
