from django.db.utils import OperationalError, ProgrammingError
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import MarketingTokenAuthentication
from .defaults import default_sections, default_translations
from .models import ContactMessage, MarketingAuthToken, MarketingEditor, MarketingSiteContent
from .permissions import IsMarketingEditor
from .serializers import (
    ContactMessageSerializer,
    MarketingEditorSerializer,
    MarketingLoginSerializer,
    MarketingSiteContentSerializer,
    PublicContactSubmitSerializer,
)


def _client_ip(request) -> str | None:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR")


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
        payload = {
            "is_published": True,
            "translations": content.translations or {},
            "sections": content.sections or {},
            "updated_at": content.updated_at.isoformat() if content.updated_at else None,
        }
        return Response(payload, headers={"Cache-Control": "no-store, max-age=0"})


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


class PublicContactSubmitView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        ser = PublicContactSubmitSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if data.get("website"):
            return Response({"detail": "ok"}, status=201)
        try:
            msg = ContactMessage.objects.create(
                name=data["name"].strip(),
                email=data["email"].strip().lower(),
                message=data["message"].strip(),
                lang=(data.get("lang") or "ckb")[:8],
                ip_address=_client_ip(request),
                user_agent=(request.META.get("HTTP_USER_AGENT") or "")[:300],
            )
        except (OperationalError, ProgrammingError):
            return Response(
                {"detail": "Database not ready. Run: python manage.py migrate"},
                status=503,
            )
        return Response({"id": msg.id, "detail": "Message received."}, status=201)


class MarketingContactStatsView(APIView):
    authentication_classes = [MarketingTokenAuthentication]
    permission_classes = [IsMarketingEditor]

    def get(self, request):
        total = ContactMessage.objects.count()
        unread = ContactMessage.objects.filter(is_read=False).count()
        return Response({"total": total, "unread": unread})


class MarketingContactListView(APIView):
    authentication_classes = [MarketingTokenAuthentication]
    permission_classes = [IsMarketingEditor]

    def get(self, request):
        qs = ContactMessage.objects.all().order_by("-created_at")
        unread_only = request.query_params.get("unread") == "1"
        if unread_only:
            qs = qs.filter(is_read=False)
        limit = min(int(request.query_params.get("limit") or 100), 200)
        rows = qs[:limit]
        return Response(ContactMessageSerializer(rows, many=True).data)


class MarketingContactDetailView(APIView):
    authentication_classes = [MarketingTokenAuthentication]
    permission_classes = [IsMarketingEditor]

    def patch(self, request, pk: int):
        try:
            msg = ContactMessage.objects.get(pk=pk)
        except ContactMessage.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if "is_read" in request.data:
            msg.is_read = bool(request.data["is_read"])
            msg.save(update_fields=["is_read"])
        return Response(ContactMessageSerializer(msg).data)

    def delete(self, request, pk: int):
        deleted, _ = ContactMessage.objects.filter(pk=pk).delete()
        if not deleted:
            return Response({"detail": "Not found."}, status=404)
        return Response(status=204)
