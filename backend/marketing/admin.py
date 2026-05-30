from django.contrib import admin

from .models import MarketingAuthToken, MarketingEditor, MarketingSiteContent


@admin.register(MarketingEditor)
class MarketingEditorAdmin(admin.ModelAdmin):
    list_display = ("email", "display_name", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("email", "display_name")


@admin.register(MarketingAuthToken)
class MarketingAuthTokenAdmin(admin.ModelAdmin):
    list_display = ("editor", "key", "expires_at", "created_at")
    list_filter = ("expires_at",)
    search_fields = ("editor__email", "key")
    readonly_fields = ("key", "created_at")


@admin.register(MarketingSiteContent)
class MarketingSiteContentAdmin(admin.ModelAdmin):
    list_display = ("id", "is_published", "updated_at")
