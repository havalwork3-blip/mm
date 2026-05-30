from django.urls import path

from . import product_views, views

urlpatterns = [
    path("public/marketing-site/", views.PublicMarketingSiteView.as_view(), name="public-marketing-site"),
    path("public/marketing-contact/", views.PublicContactSubmitView.as_view(), name="public-marketing-contact"),
    path(
        "public/marketing-products/",
        product_views.PublicMarketingProductsView.as_view(),
        name="public-marketing-products",
    ),
    path("marketing/auth/login/", views.MarketingLoginView.as_view(), name="marketing-auth-login"),
    path("marketing/auth/logout/", views.MarketingLogoutView.as_view(), name="marketing-auth-logout"),
    path("marketing/auth/me/", views.MarketingMeView.as_view(), name="marketing-auth-me"),
    path("marketing/site/", views.MarketingSiteAdminView.as_view(), name="marketing-site-admin"),
    path("marketing/contact/stats/", views.MarketingContactStatsView.as_view(), name="marketing-contact-stats"),
    path("marketing/contact/", views.MarketingContactListView.as_view(), name="marketing-contact-list"),
    path("marketing/contact/<int:pk>/", views.MarketingContactDetailView.as_view(), name="marketing-contact-detail"),
    path(
        "marketing/products/seed/",
        product_views.MarketingProductSeedView.as_view(),
        name="marketing-products-seed",
    ),
    path(
        "marketing/product-categories/",
        product_views.MarketingProductCategoryListView.as_view(),
        name="marketing-product-categories",
    ),
    path(
        "marketing/product-categories/<int:pk>/",
        product_views.MarketingProductCategoryDetailView.as_view(),
        name="marketing-product-category-detail",
    ),
    path("marketing/products/", product_views.MarketingProductListView.as_view(), name="marketing-products"),
    path(
        "marketing/products/<int:pk>/",
        product_views.MarketingProductDetailView.as_view(),
        name="marketing-product-detail",
    ),
]
