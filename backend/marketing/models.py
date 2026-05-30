import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone

from .defaults import default_sections, default_translations


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
