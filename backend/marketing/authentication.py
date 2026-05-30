from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import MarketingAuthToken, MarketingEditor


class MarketingTokenAuthentication(BaseAuthentication):
    """Authorization: MarketingToken <hex-key> — separate from POS Basic auth."""

    keyword = "MarketingToken"

    def authenticate(self, request):
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not header.startswith(self.keyword + " "):
            return None
        key = header[len(self.keyword) + 1 :].strip()
        if not key:
            return None
        try:
            token = MarketingAuthToken.objects.select_related("editor").get(key=key)
        except MarketingAuthToken.DoesNotExist as exc:
            raise AuthenticationFailed("Invalid marketing token.") from exc
        if not token.is_valid:
            raise AuthenticationFailed("Marketing token expired.")
        editor = token.editor
        if not editor.is_active:
            raise AuthenticationFailed("Marketing editor account disabled.")
        return (editor, token)
