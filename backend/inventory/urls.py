from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views
from .admin_views import GlobalAdminStatsView
from .report_dashboard_views import (
    CashierLedgerView,
    CashierSummaryView,
    DashboardStatsView,
    ShopOpeningCashDetailView,
    ShopOpeningCashView,
)
from .report_views import JardReportView, ProfitReportView

router = DefaultRouter()
router.register(r"categories", views.CategoryViewSet, basename="category")
router.register(r"products", views.ProductViewSet, basename="product")
router.register(r"companies", views.CompanyViewSet, basename="company")
router.register(r"customers", views.CustomerViewSet, basename="customer")
router.register(r"expenses", views.ExpenseViewSet, basename="expense")
router.register(r"purchases", views.PurchaseViewSet, basename="purchase")
router.register(r"sales", views.SaleViewSet, basename="sale")
router.register(r"shareholders", views.ShareholderViewSet, basename="shareholder")
router.register(r"employee-debts", views.EmployeeDebtViewSet, basename="employee-debt")
router.register(
    r"merchant/storefront-orders",
    views.MerchantStorefrontOrderViewSet,
    basename="merchant-storefront-order",
)

urlpatterns = [
    path("translate/", views.translate_category_names, name="translate-category-names"),
    # Public storefront (mounted at /api/ in config.urls — do NOT prefix with api/ here).
    path(
        "public/storefront/resolve/",
        views.public_storefront_resolve,
        name="public-storefront-resolve",
    ),
    path(
        "public/storefront/products/",
        views.public_storefront_products,
        name="public-storefront-products",
    ),
    path(
        "public/storefront/catalog/",
        views.public_storefront_catalog,
        name="public-storefront-catalog",
    ),
    path(
        "public/storefront/submit_order/",
        views.public_storefront_submit_order,
        name="public-storefront-submit-order",
    ),
    path("admin/stats/", GlobalAdminStatsView.as_view(), name="admin-global-stats"),
    path("reports/profit/", ProfitReportView.as_view(), name="profit-report"),
    path("reports/jard/", JardReportView.as_view(), name="jard-report"),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("cashier/summary/", CashierSummaryView.as_view(), name="cashier-summary"),
    path("cashier/ledger/", CashierLedgerView.as_view(), name="cashier-ledger"),
    path("cashier/opening/<int:pk>/", ShopOpeningCashDetailView.as_view(), name="cashier-opening-detail"),
    path("cashier/opening/", ShopOpeningCashView.as_view(), name="cashier-opening"),
    path("", include(router.urls)),
]
