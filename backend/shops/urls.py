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
    path("public/telegram/webhook/", views.public_telegram_webhook, name="public-telegram-webhook"),
    path("public/qr-landing/", views.public_qr_landing, name="public-qr-landing"),
    path("admin/qr-landing/", views.QrLandingAdminView.as_view(), name="admin-qr-landing"),
    path("admin/qr-landing/logo/", views.QrLandingPrimaryLogoView.as_view(), name="admin-qr-landing-logo"),
    path(
        "admin/qr-landing/manager-telegram-test/",
        views.QrLandingManagerTelegramTestView.as_view(),
        name="admin-qr-landing-manager-telegram-test",
    ),
    path(
        "admin/qr-landing/manager-telegram-send-now/",
        views.QrLandingManagerTelegramSendNowView.as_view(),
        name="admin-qr-landing-manager-telegram-send-now",
    ),
    path("receipt-settings/", views.ReceiptSettingsView.as_view(), name="receipt-settings"),
    path("shop-settings/", views.ShopSettingsView.as_view(), name="shop-settings"),
    path(
        "merchant/storefront-settings/",
        views.MerchantStorefrontSettingsView.as_view(),
        name="merchant-storefront-settings",
    ),
    path(
        "merchant/storefront-settings/telegram-test/",
        views.MerchantTelegramTestView.as_view(),
        name="merchant-storefront-telegram-test",
    ),
    path(
        "merchant/storefront-settings/whatsapp-test/",
        views.MerchantWhatsAppTestView.as_view(),
        name="merchant-storefront-whatsapp-test",
    ),
    path(
        "merchant/storefront-banners/",
        views.MerchantStorefrontBannersView.as_view(),
        name="merchant-storefront-banners",
    ),
    path(
        "merchant/storefront-banners/<int:pk>/",
        views.MerchantStorefrontBannerDetailView.as_view(),
        name="merchant-storefront-banner-detail",
    ),
    path(
        "merchant/storefront-delivery-zones/",
        views.MerchantStorefrontDeliveryZonesView.as_view(),
        name="merchant-storefront-delivery-zones",
    ),
    path("", include(router.urls)),
]
