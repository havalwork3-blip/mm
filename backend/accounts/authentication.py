"""Dashboard authentication: email + password login that issues an API token."""

from __future__ import annotations

import hashlib
import ipaddress
import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.core.cache import cache
from django.utils import timezone
from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication, BasicAuthentication

User = get_user_model()

# Lock an email+IP pair after this many wrong passwords within the window, and
# an IP after IP_MAX_FAILED_LOGINS wrong passwords across all emails.
MAX_FAILED_LOGINS = 10
IP_MAX_FAILED_LOGINS = 30
FAILED_LOGIN_WINDOW_SECONDS = 15 * 60

# A login token stops working after this long without use.
TOKEN_IDLE_LIFETIME = timedelta(days=14)
TOKEN_KEYWORD = "Token"


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


def client_ip(request) -> str:
    """
    Real client address. Behind the local nginx proxy REMOTE_ADDR is 127.0.0.1, so
    use X-Real-IP, which nginx overwrites with $remote_addr (clients cannot forge it).
    """
    meta = getattr(request, "META", {}) if request is not None else {}
    remote = (meta.get("REMOTE_ADDR") or "").strip()
    forwarded = (meta.get("HTTP_X_REAL_IP") or "").strip()
    try:
        behind_local_proxy = ipaddress.ip_address(remote).is_loopback
    except ValueError:
        behind_local_proxy = False
    if behind_local_proxy and forwarded:
        return forwarded
    return remote


def _fail_keys(login: str, ip: str) -> tuple[str, str]:
    return f"auth-fail:{login.strip().lower()}:{ip}", f"auth-fail-ip:{ip}"


def check_login_allowed(login: str, request) -> None:
    """Raise when this email+IP (or this IP overall) had too many wrong passwords."""
    pair_key, ip_key = _fail_keys(login, client_ip(request))
    if cache.get(pair_key, 0) >= MAX_FAILED_LOGINS or cache.get(ip_key, 0) >= IP_MAX_FAILED_LOGINS:
        raise exceptions.Throttled(
            detail="Too many wrong passwords. Try again in 15 minutes.",
        )


def record_login_failure(login: str, request) -> None:
    for key in _fail_keys(login, client_ip(request)):
        try:
            cache.incr(key)
        except ValueError:
            cache.set(key, 1, FAILED_LOGIN_WINDOW_SECONDS)


def clear_login_failures(login: str, request) -> None:
    cache.delete(_fail_keys(login, client_ip(request))[0])


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def issue_token(user, request=None) -> str:
    """Create a login token; only its hash is stored, the raw value goes to the browser."""
    from .models import ApiToken

    raw = secrets.token_urlsafe(32)
    ApiToken.objects.create(
        user=user,
        key_hash=_hash_token(raw),
        ip_address=client_ip(request)[:64] if request is not None else "",
    )
    return raw


def revoke_token(raw: str) -> None:
    from .models import ApiToken

    ApiToken.objects.filter(key_hash=_hash_token(raw)).delete()


class ApiTokenAuthentication(BaseAuthentication):
    """`Authorization: Token <key>` issued by POST /api/auth/login/."""

    def authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        parts = header.split()
        if len(parts) != 2 or parts[0] != TOKEN_KEYWORD:
            return None
        from .models import ApiToken

        token = (
            ApiToken.objects.select_related("user")
            .filter(key_hash=_hash_token(parts[1]))
            .first()
        )
        if token is None:
            raise exceptions.AuthenticationFailed("Session expired. Please sign in again.")
        now = timezone.now()
        if token.last_used_at < now - TOKEN_IDLE_LIFETIME:
            token.delete()
            raise exceptions.AuthenticationFailed("Session expired. Please sign in again.")
        if not token.user.is_active:
            raise exceptions.AuthenticationFailed("This account is disabled.")
        if token.last_used_at < now - timedelta(minutes=10):
            type(token).objects.filter(pk=token.pk).update(last_used_at=now)
        return token.user, token

    def authenticate_header(self, request):
        return TOKEN_KEYWORD


class EmailBasicAuthentication(BasicAuthentication):
    """HTTP Basic auth using email (scripts / API tools); same lockout as the login form."""

    www_authenticate_realm = "api"

    def authenticate_credentials(self, userid, password, request=None):
        login = str(userid or "").strip()
        check_login_allowed(login, request)
        try:
            user = super().authenticate_credentials(login, password, request=request)
        except exceptions.AuthenticationFailed as exc:
            record_login_failure(login, request)
            detail = str(getattr(exc, "detail", "") or "")
            if "username" in detail.lower() or "password" in detail.lower():
                raise exceptions.AuthenticationFailed(
                    "Invalid email or password.",
                ) from exc
            raise
        clear_login_failures(login, request)
        return user
