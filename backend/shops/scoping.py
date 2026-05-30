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

    - Normal users: always their ``user.shop_id`` when that shop still exists.
    - Superusers: ``?shop_id=`` / ``X-Shop-ID`` when the shop exists; stale ids are ignored.
    """
    from shops.models import Shop

    user = request.user
    if not user.is_authenticated:
        return None
    if user.is_superuser:
        sid = request.query_params.get("shop_id") or request.headers.get("X-Shop-ID")
        if sid is not None and str(sid).strip() != "":
            try:
                parsed = int(sid)
            except (TypeError, ValueError) as exc:
                raise ValidationError({"shop_id": "Invalid shop id."}) from exc
            if Shop.objects.filter(pk=parsed).exists():
                return parsed
            return None
        if getattr(user, "shop_id", None):
            uid = int(user.shop_id)
            if Shop.objects.filter(pk=uid).exists():
                return uid
        return None
    if getattr(user, "shop_id", None):
        uid = int(user.shop_id)
        if Shop.objects.filter(pk=uid).exists():
            return uid
    return None


def require_shop_id(request: HttpRequest) -> int:
    """
    Active shop for writes (create/update) and scoped reads that require a single shop.

    Resolution order:
    1) Query param ``shop_id`` or ``X-Shop-ID`` header (superuser), or the user's ``shop_id``.
    2) For superusers only: ``shop`` in JSON/form body (primary key) when no query scope.
    """
    user = getattr(request, "user", None)
    if user and user.is_authenticated and getattr(user, "is_superuser", False):
        raw = request.query_params.get("shop_id") or request.headers.get("X-Shop-ID")
        if raw is not None and str(raw).strip() != "":
            try:
                return _assert_shop_exists(int(raw))
            except (TypeError, ValueError) as exc:
                raise ValidationError({"shop_id": "Invalid shop id."}) from exc
        data = getattr(request, "data", None)
        if data is not None:
            body_shop = data.get("shop")
            if body_shop is not None and str(body_shop).strip() != "":
                try:
                    return _assert_shop_exists(int(body_shop))
                except (TypeError, ValueError) as exc:
                    raise ValidationError({"shop": "Invalid shop id."}) from exc

    sid = get_shop_id_for_request(request)
    if sid is not None:
        return sid
    raise PermissionDenied(
        "No shop scope: assign a shop to this user, pass shop_id, or include shop in the request body (superuser).",
    )


def is_superuser_global_list_scope(request: HttpRequest) -> bool:
    """Superuser with no shop filter — list endpoints may return all tenants."""
    u = getattr(request, "user", None)
    return bool(
        u and u.is_authenticated and getattr(u, "is_superuser", False) and get_shop_id_for_request(request) is None,
    )
