from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"shops", views.ShopViewSet, basename="shop")
router.register(r"currencies", views.CurrencyViewSet, basename="currency")
router.register(
    r"admin/qr-landing/custom-links",
    views.QrLandingCustomLinkViewSet,
    basename="qr-landing-custom-link",
)

urlpatterns = [
    path("public/qr-landing/", views.public_qr_landing, name="public-qr-landing"),
    path("admin/qr-landing/", views.QrLandingAdminView.as_view(), name="admin-qr-landing"),
    path("admin/qr-landing/logo/", views.QrLandingPrimaryLogoView.as_view(), name="admin-qr-landing-logo"),
    path("receipt-settings/", views.ReceiptSettingsView.as_view(), name="receipt-settings"),
    path("shop-settings/", views.ShopSettingsView.as_view(), name="shop-settings"),
    path(
        "merchant/storefront-settings/",
        views.MerchantStorefrontSettingsView.as_view(),
        name="merchant-storefront-settings",
    ),
    path("", include(router.urls)),
]
