from django.contrib import admin

from .models import (
    Category,
    Company,
    Customer,
    EmployeeDebt,
    Expense,
    Product,
    Purchase,
    PurchaseLine,
    Sale,
    SaleLine,
    SaleReturn,
    SaleReturnLine,
    Shareholder,
    ShopDayOpeningCash,
)


class PurchaseLineInline(admin.TabularInline):
    model = PurchaseLine
    extra = 0


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("name", "shop", "amount", "currency", "occurred_on")
    list_filter = ("shop", "currency")


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "shop",
        "company",
        "occurred_at",
        "exchange_rate_usd_to_iqd",
        "discount_received_usd",
        "created_at",
    )
    list_filter = ("shop",)
    inlines = [PurchaseLineInline]


class SaleLineInline(admin.TabularInline):
    model = SaleLine
    extra = 0
    readonly_fields = ("unit_buy_price_usd",)


class SaleReturnLineInline(admin.TabularInline):
    model = SaleReturnLine
    extra = 0
    readonly_fields = ("sale_line", "product", "quantity", "unit_price_usd")


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "shop",
        "customer",
        "occurred_at",
        "exchange_rate_usd_to_iqd",
        "invoice_discount_usd",
        "created_at",
    )
    list_filter = ("shop",)
    inlines = [SaleLineInline]


@admin.register(SaleReturn)
class SaleReturnAdmin(admin.ModelAdmin):
    list_display = ("id", "shop", "sale", "customer", "occurred_at")
    list_filter = ("shop",)
    inlines = [SaleReturnLineInline]


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "shop")
    list_filter = ("shop",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "shop",
        "sku",
        "current_stock_quantity",
        "sale_price_retail",
        "is_discontinued",
    )
    list_filter = ("shop", "category", "is_discontinued")
    search_fields = ("name", "sku", "barcode")


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("name", "shop", "phone_1")
    list_filter = ("shop",)


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "shop", "workplace", "phone_1")
    list_filter = ("shop",)


@admin.register(Shareholder)
class ShareholderAdmin(admin.ModelAdmin):
    list_display = ("name", "shop", "share_percentage", "capital_contribution_usd")
    list_filter = ("shop",)


@admin.register(EmployeeDebt)
class EmployeeDebtAdmin(admin.ModelAdmin):
    list_display = ("employee", "shop", "amount", "debt_type", "occurred_on")
    list_filter = ("shop", "debt_type")


@admin.register(ShopDayOpeningCash)
class ShopDayOpeningCashAdmin(admin.ModelAdmin):
    list_display = ("shop", "for_date", "opening_cash_usd")
    list_filter = ("shop",)
