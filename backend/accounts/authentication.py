"""Email login for dashboard Basic auth (case-insensitive email lookup)."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from rest_framework import exceptions
from rest_framework.authentication import BasicAuthentication

User = get_user_model()


class CaseInsensitiveEmailBackend(ModelBackend):
    """Authenticate with email + password; match email case-insensitively."""

    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if username is None or password is None:
            return None

        login = str(username).strip()
        if not login:
            return None

        try:
            user = User._default_manager.get(email__iexact=login)
        except User.DoesNotExist:
            User().set_password(password)
            return None
        except User.MultipleObjectsReturned:
            user = User._default_manager.filter(email__iexact=login).order_by("pk").first()
            if user is None:
                return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None


class EmailBasicAuthentication(BasicAuthentication):
    """HTTP Basic auth using email; clearer 401 message for the SPA."""

    www_authenticate_realm = "api"

    def authenticate_credentials(self, userid, password, request=None):
        try:
            return super().authenticate_credentials(
                str(userid or "").strip(),
                password,
                request=request,
            )
        except exceptions.AuthenticationFailed as exc:
            detail = str(getattr(exc, "detail", "") or "")
            if "username" in detail.lower() or "password" in detail.lower():
                raise exceptions.AuthenticationFailed(
                    "Invalid email or password.",
                ) from exc
            raise
