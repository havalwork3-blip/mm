from django.contrib import admin

from .models import ContactMessage, MarketingAuthToken, MarketingEditor, MarketingProductCard, MarketingProductCategory, MarketingSiteContent


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


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "is_read", "lang", "created_at")
    list_filter = ("is_read", "lang")
    search_fields = ("name", "email", "message")
    readonly_fields = ("created_at", "ip_address", "user_agent")


@admin.register(MarketingProductCategory)
class MarketingProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("page", "sort_order", "is_published", "updated_at")
    list_filter = ("page", "is_published")


@admin.register(MarketingProductCard)
class MarketingProductCardAdmin(admin.ModelAdmin):
    list_display = ("page", "sort_order", "is_published", "tone", "updated_at")
    list_filter = ("page", "is_published", "tone")
    search_fields = ("title", "link_url")
