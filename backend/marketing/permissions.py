from rest_framework.permissions import BasePermission

from .models import MarketingEditor


class IsMarketingEditor(BasePermission):
    def has_permission(self, request, view):
        return isinstance(getattr(request, "user", None), MarketingEditor)
