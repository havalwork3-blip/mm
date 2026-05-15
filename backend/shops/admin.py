from django.contrib import admin

from .models import Currency, ReceiptSettings, Shop


@admin.register(Shop)
class ShopAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Currency)
class CurrencyAdmin(admin.ModelAdmin):
    list_display = ("shop", "date", "usd_to_iqd", "created_at")
    list_filter = ("shop", "date")
    date_hierarchy = "date"


@admin.register(ReceiptSettings)
class ReceiptSettingsAdmin(admin.ModelAdmin):
    list_display = ("shop", "shop_name_en", "phone_number", "direct_print", "updated_at")
    list_filter = ("direct_print", "shop")
    search_fields = ("shop__name", "shop_name_en", "shop_name_ku", "phone_number", "email")
