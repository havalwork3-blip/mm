from django.db.utils import OperationalError, ProgrammingError
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import MarketingTokenAuthentication
from .defaults import default_sections, default_translations
from .models import MarketingAuthToken, MarketingEditor, MarketingSiteContent
from .permissions import IsMarketingEditor
from .serializers import (
    MarketingEditorSerializer,
    MarketingLoginSerializer,
    MarketingSiteContentSerializer,
)


class MarketingLoginView(APIView):
    """CMS-only login — returns a token unrelated to POS Basic auth."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        ser = MarketingLoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = ser.validated_data["email"].strip().lower()
        password = ser.validated_data["password"]
        try:
            editor = MarketingEditor.objects.get(email__iexact=email)
        except MarketingEditor.DoesNotExist:
            return Response({"detail": "Invalid email or password."}, status=401)
        if not editor.is_active or not editor.check_password(password):
            return Response({"detail": "Invalid email or password."}, status=401)
        token = MarketingAuthToken.create_for_editor(editor)
        return Response(
            {
                "token": token.key,
                "expires_at": token.expires_at.isoformat(),
                "editor": MarketingEditorSerializer(editor).data,
            }
        )


class MarketingLogoutView(APIView):
    authentication_classes = [MarketingTokenAuthentication]
    permission_classes = [IsMarketingEditor]

    def post(self, request):
        token = getattr(request, "auth", None)
        if isinstance(token, MarketingAuthToken):
            token.delete()
        return Response({"detail": "Logged out."})


class MarketingMeView(APIView):
    authentication_classes = [MarketingTokenAuthentication]
    permission_classes = [IsMarketingEditor]

    def get(self, request):
        return Response(MarketingEditorSerializer(request.user).data)


class PublicMarketingSiteView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        try:
            content = MarketingSiteContent.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {"detail": "Database not ready. Run: python manage.py migrate"},
                status=503,
            )
        if not content.is_published:
            return Response({"is_published": False, "translations": {}, "sections": {}})
        return Response(
            {
                "is_published": True,
                "translations": content.translations or {},
                "sections": content.sections or {},
                "updated_at": content.updated_at.isoformat() if content.updated_at else None,
            }
        )


class MarketingSiteAdminView(APIView):
    authentication_classes = [MarketingTokenAuthentication]
    permission_classes = [IsMarketingEditor]
    http_method_names = ["get", "patch", "post", "options", "head"]

    def get(self, request):
        try:
            content = MarketingSiteContent.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {"detail": "Database not ready. Run: python manage.py migrate"},
                status=503,
            )
        return Response(MarketingSiteContentSerializer(content).data)

    def patch(self, request):
        try:
            content = MarketingSiteContent.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {"detail": "Database not ready. Run: python manage.py migrate"},
                status=503,
            )
        ser = MarketingSiteContentSerializer(content, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(MarketingSiteContentSerializer(content).data)

    def post(self, request):
        """Reset translations/sections from bundled site defaults."""
        action = (request.data.get("action") or "").strip()
        if action != "import_defaults":
            return Response({"detail": "Unknown action."}, status=400)
        try:
            content = MarketingSiteContent.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {"detail": "Database not ready. Run: python manage.py migrate"},
                status=503,
            )
        content.translations = default_translations()
        content.sections = default_sections()
        content.save(update_fields=["translations", "sections", "updated_at"])
        return Response(MarketingSiteContentSerializer(content).data)
