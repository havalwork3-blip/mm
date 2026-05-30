from django.urls import path

from . import views

urlpatterns = [
    path("public/marketing-site/", views.PublicMarketingSiteView.as_view(), name="public-marketing-site"),
    path("marketing/auth/login/", views.MarketingLoginView.as_view(), name="marketing-auth-login"),
    path("marketing/auth/logout/", views.MarketingLogoutView.as_view(), name="marketing-auth-logout"),
    path("marketing/auth/me/", views.MarketingMeView.as_view(), name="marketing-auth-me"),
    path("marketing/site/", views.MarketingSiteAdminView.as_view(), name="marketing-site-admin"),
]
