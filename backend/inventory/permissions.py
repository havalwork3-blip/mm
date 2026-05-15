from __future__ import annotations

from rest_framework import permissions
from rest_framework.permissions import DjangoModelPermissions

from accounts.models import UserRole


class IsShopOwner(permissions.BasePermission):
    """Profit, shareholders, expenses (management), dashboard — owners (and superusers) only."""

    message = "This action requires the shop owner role."

    def has_permission(self, request, view) -> bool:
        u = request.user
        if not u.is_authenticated:
            return False
        if getattr(u, "is_superuser", False):
            return True
        return getattr(u, "role", None) == UserRole.OWNER


class IsShopOwnerOrEmployee(permissions.BasePermission):
    """Authenticated shop users (owner or employee)."""

    def has_permission(self, request, view) -> bool:
        u = request.user
        if not u.is_authenticated:
            return False
        if getattr(u, "is_superuser", False):
            return True
        return getattr(u, "role", None) in (
            UserRole.OWNER,
            UserRole.MANAGER,
            UserRole.RECEIPT_EDITOR,
            UserRole.EMPLOYEE,
        )


def _has_any_perm(user, codenames: list[str] | tuple[str, ...]) -> bool:
    """
    Accept either full permission names (app_label.codename) or bare codenames.
    """
    for token in codenames:
        if "." in token:
            if user.has_perm(token):
                return True
            continue
        # Try common app labels used in this project.
        if user.has_perm(f"inventory.{token}") or user.has_perm(f"shops.{token}") or user.has_perm(
            f"accounts.{token}",
        ):
            return True
    return False


class IsShopOwnerOrDjangoModelPermission(DjangoModelPermissions):
    """
    Shop owner/superuser OR Django model permission for the view's queryset model
    (e.g. inventory.view_product for GET on ProductViewSet).

    Managers and employees are gated by Django permissions only (not implicit full access).
    """

    perms_map = {
        "GET": ["%(app_label)s.view_%(model_name)s"],
        "OPTIONS": [],
        "HEAD": [],
        "POST": ["%(app_label)s.add_%(model_name)s"],
        "PUT": ["%(app_label)s.change_%(model_name)s"],
        "PATCH": ["%(app_label)s.change_%(model_name)s"],
        "DELETE": ["%(app_label)s.delete_%(model_name)s"],
    }

    def has_permission(self, request, view):
        u = request.user
        if not u.is_authenticated:
            return False
        if getattr(u, "is_superuser", False):
            return True
        role = getattr(u, "role", None)
        if role == UserRole.OWNER:
            return True
        return super().has_permission(request, view)


class IsShopOwnerOrDjangoModelPermissionOrReceiptEditorCurrency(
    IsShopOwnerOrDjangoModelPermission,
):
    """
    Currency access: Django model perms, plus receipt editors (all methods).

    Users who may complete sales at POS (`add_sale`) can list rates and POST
    `set-today` without `add_currency` / `view_currency` — otherwise checkout
    fails after assigning only sale permissions.
    """

    def has_permission(self, request, view):
        u = request.user
        if not u.is_authenticated:
            return False
        if getattr(u, "is_superuser", False) or getattr(u, "role", None) == UserRole.OWNER:
            return True
        if getattr(u, "role", None) == UserRole.RECEIPT_EDITOR:
            return True

        method = request.method
        action = getattr(view, "action", None)
        if _has_any_perm(u, ("add_sale",)) and (
            (method == "GET") or (action == "set_today" and method == "POST")
        ):
            return True

        return IsShopOwnerOrDjangoModelPermission.has_permission(self, request, view)


class IsShopOwnerOrDjangoModelPermissionOrPosProductRead(IsShopOwnerOrDjangoModelPermission):
    """
    Product list/detail for POS: receipt editors and anyone who can work sales
    may GET products without an explicit ``view_product`` assignment.

    Mutations (POST/PUT/PATCH/DELETE) still require normal Django model permissions.
    """

    def has_permission(self, request, view):
        u = request.user
        if not u.is_authenticated:
            return False
        if getattr(u, "is_superuser", False) or getattr(u, "role", None) == UserRole.OWNER:
            return True

        method = request.method
        if method in ("GET", "HEAD", "OPTIONS"):
            role = getattr(u, "role", None)
            if role == UserRole.RECEIPT_EDITOR:
                return True
            if _has_any_perm(u, ("view_product", "view_sale", "add_sale", "change_sale")):
                return True

        return IsShopOwnerOrDjangoModelPermission.has_permission(self, request, view)


class IsShopOwnerOrDjangoModelPermissionOrPosCustomerCreate(IsShopOwnerOrDjangoModelPermission):
    """
    Customer CRUD with Django perms; additionally allow POST when the user can
    record sales (`add_sale`) so POS can register walk-in customers without
    `add_customer` explicitly assigned.
    """

    def has_permission(self, request, view):
        u = request.user
        if not u.is_authenticated:
            return False
        if getattr(u, "is_superuser", False) or getattr(u, "role", None) == UserRole.OWNER:
            return True
        if request.method == "POST" and _has_any_perm(u, ("add_sale",)):
            return True
        return IsShopOwnerOrDjangoModelPermission.has_permission(self, request, view)


class IsShopOwnerOrPermission(permissions.BasePermission):
    """
    Allow shop owners/superusers by default.
    Also allow users that have any configured Django permission codename for the request method.

    Managers follow the same explicit permission rules as employees.
    """

    message = "You do not have permission for this action."

    def has_permission(self, request, view) -> bool:
        u = request.user
        if not u.is_authenticated:
            return False
        if getattr(u, "is_superuser", False):
            return True
        role = getattr(u, "role", None)
        if role == UserRole.OWNER:
            return True
        if role == UserRole.RECEIPT_EDITOR and getattr(
            view,
            "receipt_editor_allowed",
            False,
        ):
            return True

        perms_by_method = getattr(view, "permission_codenames_by_method", None)
        if isinstance(perms_by_method, dict):
            codenames = perms_by_method.get(request.method, ())
            return _has_any_perm(u, codenames)

        codenames = getattr(view, "permission_codenames", ())
        if isinstance(codenames, (list, tuple)):
            return _has_any_perm(u, codenames)
        return False


class IsShopOwnerOrCanRecordSalePayment(permissions.BasePermission):
    """
    Owner/superuser OR change_sale OR add_sale — e.g. recording payment toward
    outstanding sale balances (customer debt collection).
    """

    message = "You need change_sale or add_sale permission to record this payment."

    def has_permission(self, request, view) -> bool:
        u = request.user
        if not u.is_authenticated:
            return False
        if getattr(u, "is_superuser", False):
            return True
        role = getattr(u, "role", None)
        if role in (UserRole.OWNER, UserRole.RECEIPT_EDITOR):
            return True
        return _has_any_perm(u, ("change_sale", "add_sale"))


class IsShopOwnerOrCanPaySupplierDebt(permissions.BasePermission):
    """
    Owner/superuser OR add_purchase — paying down supplier (company) purchase debt.
    """

    message = "You need add_purchase permission to record supplier payments."

    def has_permission(self, request, view) -> bool:
        u = request.user
        if not u.is_authenticated:
            return False
        if getattr(u, "is_superuser", False):
            return True
        role = getattr(u, "role", None)
        if role == UserRole.OWNER:
            return True
        return _has_any_perm(u, ("add_purchase",))
