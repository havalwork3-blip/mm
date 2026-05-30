"""Helpers for multi-tenant queryset and permission checks."""

from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

if TYPE_CHECKING:
    from django.http import HttpRequest


def _assert_shop_exists(shop_id: int) -> int:
    from shops.models import Shop

    if not Shop.objects.filter(pk=shop_id).exists():
        raise NotFound("Shop not found.")
    return shop_id


def get_shop_id_for_request(request: HttpRequest) -> int | None:
    """
    Resolve the active shop for the current request.

    - Normal users: always their ``user.shop_id``.
    - Superusers: must pass ``?shop_id=`` (or ``X-Shop-ID`` header) to scope data.
    """
    user = request.user
    if not user.is_authenticated:
        return None
    if user.is_superuser:
        sid = request.query_params.get("shop_id") or request.headers.get("X-Shop-ID")
        if sid is not None and str(sid).strip() != "":
            try:
                return _assert_shop_exists(int(sid))
            except (TypeError, ValueError) as exc:
                raise ValidationError({"shop_id": "Invalid shop id."}) from exc
        if getattr(user, "shop_id", None):
            return _assert_shop_exists(int(user.shop_id))
        return None
    if getattr(user, "shop_id", None):
        return _assert_shop_exists(int(user.shop_id))
    return None


def require_shop_id(request: HttpRequest) -> int:
    """
    Active shop for writes (create/update) and scoped reads that require a single shop.

    Resolution order:
    1) Query param ``shop_id`` or ``X-Shop-ID`` header (superuser), or the user's ``shop_id``.
    2) For superusers only: ``shop`` in JSON/form body (primary key) when no query scope.
    """
    sid = get_shop_id_for_request(request)
    if sid is not None:
        return sid
    user = getattr(request, "user", None)
    if user and user.is_authenticated and getattr(user, "is_superuser", False):
        data = getattr(request, "data", None)
        if data is not None:
            raw = data.get("shop")
            if raw is not None and str(raw).strip() != "":
                try:
                    return _assert_shop_exists(int(raw))
                except (TypeError, ValueError) as exc:
                    raise ValidationError({"shop": "Invalid shop id."}) from exc
    raise PermissionDenied(
        "No shop scope: assign a shop to this user, pass shop_id, or include shop in the request body (superuser).",
    )


def is_superuser_global_list_scope(request: HttpRequest) -> bool:
    """Superuser with no shop filter — list endpoints may return all tenants."""
    u = getattr(request, "user", None)
    return bool(
        u and u.is_authenticated and getattr(u, "is_superuser", False) and get_shop_id_for_request(request) is None,
    )
