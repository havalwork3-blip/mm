from decimal import Decimal

from django.db.utils import OperationalError, ProgrammingError
from django.utils import timezone
from inventory.admin_views import IsSuperuser
from rest_framework import viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import UserRole
from inventory.permissions import (
    IsShopOwnerOrDjangoModelPermission,
    IsShopOwnerOrDjangoModelPermissionOrReceiptEditorCurrency,
)

from shops.scoping import get_shop_id_for_request, require_shop_id

from inventory.permissions import IsShopStaffWithOnlineStorefront

from .models import (
    Currency,
    QrLandingCustomLink,
    QrLandingSettings,
    ReceiptSettings,
    Shop,
    ShopSettings,
    StorefrontBanner,
    StorefrontDeliveryZone,
    StorefrontSettings,
)
from .storefront_settings_utils import get_or_create_storefront_settings

QR_PRESET_META = (
    ("instagram", "Instagram"),
    ("facebook", "Facebook"),
    ("tiktok", "TikTok"),
    ("youtube", "YouTube"),
    ("whatsapp", "WhatsApp"),
    ("telegram", "Telegram"),
    ("snapchat", "Snapchat"),
    ("x", "X"),
    ("website", "Website"),
)
from .serializers import (
    CurrencySerializer,
    QrLandingAdminPatchSerializer,
    QrLandingCustomLinkSerializer,
    ReceiptSettingsSerializer,
    ShopSerializer,
    ShopSettingsSerializer,
    StorefrontBannerReorderSerializer,
    StorefrontBannerSerializer,
    StorefrontDeliveryZoneSerializer,
    StorefrontDeliveryZonesPatchSerializer,
    StorefrontSettingsSerializer,
)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok", "service": "multi-shop-api"})


def _primary_logo_url(request, obj: QrLandingSettings) -> str | None:
    if not obj.primary_logo:
        return None
    url = obj.primary_logo.url
    return request.build_absolute_uri(url) if request else url


@api_view(["GET"])
@permission_classes([AllowAny])
def public_qr_landing(request):
    """Public JSON for /qr-code — global landing (no shop query param)."""
    try:
        s = QrLandingSettings.load()
    except (OperationalError, ProgrammingError):
        return Response(
            {
                "detail": "Database not ready for QR landing. On the server run: python manage.py migrate",
            },
            status=503,
        )
    headline = (s.headline or "").strip() or "Connect"
    tagline = (s.tagline or "").strip()
    accent = (s.accent_color or "").strip() or "#c9a962"
    logo_url = _primary_logo_url(request, s)
    phone = (s.phone or "").strip()

    raw_presets = s.preset_links if isinstance(s.preset_links, list) else []
    saved_by_id = {}
    for item in raw_presets:
        if not isinstance(item, dict):
            continue
        lid = (item.get("id") or "").strip()
        if lid:
            saved_by_id[lid] = item

    preset_out = []
    for lid, label in QR_PRESET_META:
        row = saved_by_id.get(lid, {})
        url = (row.get("url") or "").strip()
        if row.get("enabled") is False:
            continue
        if not url:
            continue
        preset_out.append({"kind": "preset", "id": lid, "label": label, "url": url})

    custom_out = []
    for row in (
        QrLandingCustomLink.objects.filter(settings_id=1, enabled=True)
        .order_by("sort_order", "id")
        .iterator()
    ):
        url = (row.url or "").strip()
        if not url:
            continue
        lu = None
        if row.logo:
            u = row.logo.url
            lu = request.build_absolute_uri(u) if request else u
        bg = (row.bg_color or "").strip() or "#14110f"
        custom_out.append(
            {
                "kind": "custom",
                "id": row.pk,
                "label": row.label,
                "url": url,
                "bg_color": bg,
                "logo_url": lu,
            }
        )

    return Response(
        {
            "headline": headline,
            "tagline": tagline,
            "accent_color": accent,
            "logo_url": logo_url,
            "phone": phone,
            "preset_links": preset_out,
            "custom_links": custom_out,
        }
    )


class QrLandingAdminView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]
    http_method_names = ["get", "patch", "options", "head"]

    def get(self, request):
        try:
            s = QrLandingSettings.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {
                    "detail": "Database not ready for QR landing. Run: python manage.py migrate",
                },
                status=503,
            )
        ser = QrLandingCustomLinkSerializer(
            QrLandingCustomLink.objects.filter(settings_id=1).order_by("sort_order", "id"),
            many=True,
            context={"request": request},
        )
        from shops.telegram_notify import mask_bot_token

        return Response(
            {
                "headline": s.headline,
                "tagline": s.tagline,
                "accent_color": s.accent_color,
                "phone": s.phone,
                "primary_logo_url": _primary_logo_url(request, s),
                "preset_links": s.preset_links if isinstance(s.preset_links, list) else [],
                "custom_links": ser.data,
                "manager_telegram_notify_enabled": bool(s.manager_telegram_notify_enabled),
                "manager_telegram_bot_token_masked": mask_bot_token(
                    s.manager_telegram_bot_token or "",
                ),
                "manager_telegram_chat_id": s.manager_telegram_chat_id or "",
                "manager_telegram_send_hour": int(s.manager_telegram_send_hour or 8),
                "manager_telegram_send_minute": int(s.manager_telegram_send_minute or 0),
                "manager_telegram_last_sent_date": (
                    s.manager_telegram_last_sent_date.isoformat()
                    if s.manager_telegram_last_sent_date
                    else None
                ),
                "manager_telegram_schedule": self._manager_schedule_status(),
                "updated_at": s.updated_at.isoformat() if s.updated_at else None,
            }
        )

    @staticmethod
    def _manager_schedule_status() -> dict:
        try:
            from shops.manager_telegram_scheduler import schedule_status

            return schedule_status()
        except Exception:
            return {"scheduler_enabled": False}

    def patch(self, request):
        try:
            s = QrLandingSettings.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {
                    "detail": "Database not ready for QR landing. Run: python manage.py migrate",
                },
                status=503,
            )
        ser = QrLandingAdminPatchSerializer(data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if "headline" in data:
            s.headline = data["headline"]
        if "tagline" in data:
            s.tagline = data["tagline"]
        if "accent_color" in data:
            s.accent_color = data["accent_color"] or "#c9a962"
        if "phone" in data:
            s.phone = data["phone"]
        if "preset_links" in data:
            s.preset_links = data["preset_links"]
        if "manager_telegram_notify_enabled" in data:
            s.manager_telegram_notify_enabled = bool(data["manager_telegram_notify_enabled"])
        if "manager_telegram_bot_token" in data:
            raw = (data.get("manager_telegram_bot_token") or "").strip()
            if raw:
                s.manager_telegram_bot_token = raw
        if "manager_telegram_chat_id" in data:
            s.manager_telegram_chat_id = (data.get("manager_telegram_chat_id") or "").strip()
        if "manager_telegram_send_hour" in data:
            s.manager_telegram_send_hour = int(data["manager_telegram_send_hour"])
        if "manager_telegram_send_minute" in data:
            s.manager_telegram_send_minute = int(data["manager_telegram_send_minute"])
        if data.get("manager_telegram_clear_last_sent"):
            s.manager_telegram_last_sent_date = None
        s.save()
        try:
            from shops.manager_telegram_scheduler import refresh_manager_telegram_schedule

            refresh_manager_telegram_schedule()
        except Exception:
            import logging

            logging.getLogger(__name__).exception(
                "Could not refresh manager Telegram schedule after save",
            )
        return self.get(request)


class QrLandingManagerTelegramTestView(APIView):
    """POST — test manager daily Telegram bot."""

    permission_classes = [IsAuthenticated, IsSuperuser]

    def post(self, request):
        from shops.manager_daily_telegram import send_manager_test_message

        s = QrLandingSettings.load()
        ok = send_manager_test_message(s)
        return Response({"ok": ok})


class QrLandingManagerTelegramSendNowView(APIView):
    """POST — send today's full digest immediately (superuser)."""

    permission_classes = [IsAuthenticated, IsSuperuser]

    def post(self, request):
        from shops.manager_daily_telegram import (
            business_today,
            parse_report_date_param,
            send_manager_daily_digest,
        )

        s = QrLandingSettings.load()
        report_date = business_today()
        raw_date = request.data.get("report_date") if isinstance(request.data, dict) else None
        if raw_date:
            try:
                parsed = parse_report_date_param(raw_date)
            except ValueError as exc:
                return Response({"detail": str(exc)}, status=400)
            if parsed is not None:
                report_date = parsed
        result = send_manager_daily_digest(s, report_date=report_date, force=True)
        return Response(
            {
                "ok": result.get("shop_ok", 0) > 0 or result.get("sent", 0) > 0,
                "sent": result.get("sent", 0),
                "shops": result.get("shops", 0),
                "shop_ok": result.get("shop_ok", 0),
                "messages": result.get("messages", 0),
                "failed": result.get("failed", []),
                "report_date": result.get("report_date") or report_date.isoformat(),
            },
        )


class QrLandingPrimaryLogoView(APIView):
    permission_classes = [IsAuthenticated, IsSuperuser]
    parser_classes = [MultiPartParser, FormParser]
    http_method_names = ["post", "delete", "options", "head"]

    def post(self, request):
        try:
            s = QrLandingSettings.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {"detail": "Database not ready for QR landing. Run: python manage.py migrate"},
                status=503,
            )
        f = request.FILES.get("logo")
        if not f:
            return Response({"detail": "Missing file field `logo`."}, status=400)
        s.primary_logo = f
        s.save()
        return Response({"primary_logo_url": _primary_logo_url(request, s)})

    def delete(self, request):
        try:
            s = QrLandingSettings.load()
        except (OperationalError, ProgrammingError):
            return Response(
                {"detail": "Database not ready for QR landing. Run: python manage.py migrate"},
                status=503,
            )
        if s.primary_logo:
            s.primary_logo.delete(save=False)
        s.primary_logo = None
        s.save()
        return Response({"primary_logo_url": None})


class QrLandingCustomLinkViewSet(viewsets.ModelViewSet):
    serializer_class = QrLandingCustomLinkSerializer
    permission_classes = [IsAuthenticated, IsSuperuser]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        QrLandingSettings.load()
        return QrLandingCustomLink.objects.filter(settings_id=1).order_by("sort_order", "id")

    def perform_create(self, serializer):
        serializer.save(settings=QrLandingSettings.load())


class ShopViewSet(viewsets.ModelViewSet):
    queryset = Shop.objects.all()
    serializer_class = ShopSerializer
    permission_classes = [IsAuthenticated, IsShopOwnerOrDjangoModelPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.user.is_authenticated and self.request.user.is_superuser:
            # Admin shops page must always show all shops for superusers.
            return qs.all()
        sid = get_shop_id_for_request(self.request)
        if sid is not None:
            return qs.filter(pk=sid)
        return qs.none()

class CurrencyViewSet(viewsets.ModelViewSet):
    serializer_class = CurrencySerializer
    permission_classes = [IsAuthenticated, IsShopOwnerOrDjangoModelPermissionOrReceiptEditorCurrency]
    http_method_names = ["get", "post", "head", "options", "put", "patch", "delete"]

    @action(detail=False, methods=["post"], url_path="set-today")
    def set_today(self, request):
        """Create or update today's USD→IQD rate for the active shop."""
        shop_id = require_shop_id(request)
        raw = request.data.get("usd_to_iqd")
        if raw is None:
            return Response({"detail": "usd_to_iqd is required."}, status=400)
        rate = Decimal(str(raw))
        today = timezone.localdate()
        obj, _ = Currency.objects.update_or_create(
            shop_id=shop_id,
            date=today,
            defaults={"usd_to_iqd": rate},
        )
        ser = CurrencySerializer(obj, context={"request": request})
        return Response(ser.data)

    def get_queryset(self):
        qs = Currency.objects.select_related("shop").order_by("-date", "-id")
        shop_id = get_shop_id_for_request(self.request)
        if shop_id is not None:
            return qs.filter(shop_id=shop_id)
        # Force explicit shop scope for superusers on tenant-owned data.
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(shop_id=require_shop_id(self.request))

    def perform_update(self, serializer):
        serializer.save(shop_id=require_shop_id(self.request))

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        if hasattr(serializer, "fields") and "shop" in serializer.fields:
            try:
                sid = require_shop_id(self.request)
            except PermissionDenied:
                sid = None
            if sid is not None:
                serializer.fields["shop"].queryset = Shop.objects.filter(pk=sid)
            else:
                serializer.fields["shop"].queryset = Shop.objects.none()
        return serializer

    def update(self, request, *args, **kwargs):
        """Restrict updates to rows belonging to the active shop."""
        instance = self.get_object()
        if instance.shop_id != require_shop_id(request):
            from rest_framework.exceptions import NotFound

            raise NotFound()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.shop_id != require_shop_id(request):
            from rest_framework.exceptions import NotFound

            raise NotFound()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.shop_id != require_shop_id(request):
            from rest_framework.exceptions import NotFound

            raise NotFound()
        return super().destroy(request, *args, **kwargs)


class ReceiptSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "put", "patch", "options", "head"]

    def _get_or_create(self, request) -> ReceiptSettings:
        shop_id = require_shop_id(request)
        defaults = {}
        user_shop_id = getattr(request.user, "shop_id", None)
        if user_shop_id == shop_id:
            user_shop = getattr(request.user, "shop", None)
            if user_shop is not None:
                defaults["shop_name_en"] = getattr(user_shop, "name", "")
        obj, _ = ReceiptSettings.objects.get_or_create(shop_id=shop_id, defaults=defaults)
        return obj

    def get(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.view_receiptsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        return Response(ReceiptSettingsSerializer(obj, context={"request": request}).data)

    def put(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.change_receiptsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        ser = ReceiptSettingsSerializer(
            obj,
            data=request.data,
            partial=False,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save(shop_id=obj.shop_id)
        return Response(ser.data)

    def patch(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.change_receiptsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        ser = ReceiptSettingsSerializer(
            obj,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save(shop_id=obj.shop_id)
        return Response(ser.data)


class ShopSettingsView(APIView):
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "put", "patch", "options", "head"]

    def _get_or_create(self, request) -> ShopSettings:
        shop_id = require_shop_id(request)
        obj, _ = ShopSettings.objects.get_or_create(shop_id=shop_id)
        return obj

    def get(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.view_shopsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        return Response(ShopSettingsSerializer(obj, context={"request": request}).data)

    def put(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.change_shopsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        ser = ShopSettingsSerializer(
            obj,
            data=request.data,
            partial=False,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save(shop_id=obj.shop_id)
        return Response(ser.data)

    def patch(self, request):
        obj = self._get_or_create(request)
        if not (
            getattr(request.user, "is_superuser", False)
            or getattr(request.user, "role", None)
            in (UserRole.OWNER, UserRole.EMPLOYEE, UserRole.MANAGER, UserRole.RECEIPT_EDITOR)
            or request.user.has_perm("shops.change_shopsettings")
        ):
            return Response({"detail": "You do not have permission for this action."}, status=403)
        ser = ShopSettingsSerializer(
            obj,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save(shop_id=obj.shop_id)
        return Response(ser.data)


class MerchantStorefrontSettingsView(APIView):
    """GET/PATCH online shop appearance for the active tenant."""

    permission_classes = [IsAuthenticated, IsShopStaffWithOnlineStorefront]
    http_method_names = ["get", "patch", "options", "head"]

    def _get_settings(self, request) -> StorefrontSettings:
        shop_id = require_shop_id(request)
        shop = Shop.objects.filter(pk=shop_id, online_storefront_enabled=True).first()
        if shop is None:
            raise PermissionDenied("Online storefront is not enabled for this shop.")
        return get_or_create_storefront_settings(shop)

    def get(self, request):
        from shops.telegram_notify import ensure_link_code

        obj = self._get_settings(request)
        if obj.telegram_notify_enabled:
            ensure_link_code(obj)
        return Response(StorefrontSettingsSerializer(obj, context={"request": request}).data)

    def patch(self, request):
        obj = self._get_settings(request)
        ser = StorefrontSettingsSerializer(
            obj,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


def _storefront_shop_id(request) -> int:
    shop_id = require_shop_id(request)
    shop = Shop.objects.filter(pk=shop_id, online_storefront_enabled=True).first()
    if shop is None:
        raise PermissionDenied("Online storefront is not enabled for this shop.")
    return int(shop_id)


class MerchantStorefrontBannersView(APIView):
    """GET list / POST create hero banners for the active shop."""

    permission_classes = [IsAuthenticated, IsShopStaffWithOnlineStorefront]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    http_method_names = ["get", "post", "patch", "options", "head"]

    def get(self, request):
        shop_id = _storefront_shop_id(request)
        qs = StorefrontBanner.objects.filter(shop_id=shop_id).order_by("sort_order", "id")
        ser = StorefrontBannerSerializer(qs, many=True, context={"request": request, "shop_id": shop_id})
        return Response(ser.data)

    def post(self, request):
        shop_id = _storefront_shop_id(request)
        ser = StorefrontBannerSerializer(
            data=request.data,
            context={"request": request, "shop_id": shop_id},
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=201)

    def patch(self, request):
        """Reorder banners: body `{ "order": [3, 1, 2] }`."""
        shop_id = _storefront_shop_id(request)
        reorder = StorefrontBannerReorderSerializer(data=request.data)
        reorder.is_valid(raise_exception=True)
        ids = reorder.validated_data["order"]
        banners = {
            b.id: b
            for b in StorefrontBanner.objects.filter(shop_id=shop_id, pk__in=ids)
        }
        if len(banners) != len(set(ids)):
            return Response({"detail": "Invalid banner id in order list."}, status=400)
        for idx, bid in enumerate(ids):
            banners[bid].sort_order = idx
            banners[bid].save(update_fields=["sort_order", "updated_at"])
        qs = StorefrontBanner.objects.filter(shop_id=shop_id).order_by("sort_order", "id")
        ser = StorefrontBannerSerializer(qs, many=True, context={"request": request, "shop_id": shop_id})
        return Response(ser.data)


class MerchantStorefrontBannerDetailView(APIView):
    permission_classes = [IsAuthenticated, IsShopStaffWithOnlineStorefront]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    http_method_names = ["patch", "delete", "options", "head"]

    def _get_banner(self, request, pk: int) -> StorefrontBanner:
        shop_id = _storefront_shop_id(request)
        row = StorefrontBanner.objects.filter(pk=pk, shop_id=shop_id).first()
        if row is None:
            from rest_framework.exceptions import NotFound

            raise NotFound()
        return row

    def patch(self, request, pk: int):
        obj = self._get_banner(request, pk)
        shop_id = obj.shop_id
        ser = StorefrontBannerSerializer(
            obj,
            data=request.data,
            partial=True,
            context={"request": request, "shop_id": shop_id},
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def delete(self, request, pk: int):
        obj = self._get_banner(request, pk)
        if obj.image:
            obj.image.delete(save=False)
        obj.delete()
        return Response(status=204)


class MerchantStorefrontDeliveryZonesView(APIView):
    """GET/PATCH delivery areas and fees for the online storefront."""

    permission_classes = [IsAuthenticated, IsShopStaffWithOnlineStorefront]
    http_method_names = ["get", "patch", "options", "head"]

    def _delivery_config_response(self, request, shop_id: int):
        from shops.storefront_settings_utils import (
            delivery_free_min_usd_public,
            get_or_create_storefront_settings,
        )

        shop = Shop.objects.filter(pk=shop_id).first()
        settings = get_or_create_storefront_settings(shop) if shop is not None else None
        qs = StorefrontDeliveryZone.objects.filter(shop_id=shop_id).order_by(
            "sort_order",
            "name",
            "id",
        )
        ser = StorefrontDeliveryZoneSerializer(qs, many=True)
        return Response(
            {
                "zones": ser.data,
                "delivery_free_min_usd": (
                    delivery_free_min_usd_public(settings) if settings is not None else None
                ),
            },
        )

    def get(self, request):
        shop_id = _storefront_shop_id(request)
        return self._delivery_config_response(request, shop_id)

    def patch(self, request):
        shop_id = _storefront_shop_id(request)
        body = StorefrontDeliveryZonesPatchSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        zones_data = body.validated_data["zones"]

        if "delivery_free_min_usd" in body.validated_data:
            from shops.storefront_settings_utils import get_or_create_storefront_settings

            shop = Shop.objects.filter(pk=shop_id).first()
            if shop is not None:
                settings = get_or_create_storefront_settings(shop)
                settings.delivery_free_min_usd = body.validated_data["delivery_free_min_usd"]
                settings.save(update_fields=["delivery_free_min_usd", "updated_at"])

        existing_ids = set(
            StorefrontDeliveryZone.objects.filter(shop_id=shop_id).values_list("pk", flat=True),
        )
        keep_ids: set[int] = set()

        for idx, row in enumerate(zones_data):
            zone_id = row.pop("id", None)
            row["sort_order"] = idx
            if zone_id is not None and zone_id in existing_ids:
                obj = StorefrontDeliveryZone.objects.filter(pk=zone_id, shop_id=shop_id).first()
                if obj is None:
                    continue
                for key, val in row.items():
                    setattr(obj, key, val)
                obj.save()
                keep_ids.add(zone_id)
            else:
                obj = StorefrontDeliveryZone.objects.create(shop_id=shop_id, **row)
                keep_ids.add(obj.pk)

        StorefrontDeliveryZone.objects.filter(shop_id=shop_id).exclude(pk__in=keep_ids).delete()

        return self._delivery_config_response(request, shop_id)


@api_view(["GET", "POST"])
@permission_classes([AllowAny])
def cron_manager_telegram_tick(request):
    """
    Backup scheduled send — call every 5 minutes from system cron.
    Header: X-Cron-Secret: <CRON_SECRET> or ?key=<CRON_SECRET>
    """
    import os

    expected = os.environ.get("CRON_SECRET", "").strip()
    provided = (
        request.headers.get("X-Cron-Secret")
        or request.query_params.get("key")
        or ""
    ).strip()
    if not expected or provided != expected:
        return Response({"detail": "Forbidden"}, status=403)
    from shops.manager_telegram_scheduler import run_scheduled_manager_digest

    result = run_scheduled_manager_digest()
    return Response(result)


@api_view(["POST"])
@permission_classes([AllowAny])
def public_telegram_webhook(request):
    """Telegram Bot API webhook — links mobile chats via /start LINKCODE."""
    import json

    from shops.telegram_notify import process_telegram_update

    try:
        payload = request.data if isinstance(request.data, dict) else json.loads(request.body or b"{}")
    except (json.JSONDecodeError, TypeError, ValueError):
        payload = {}
    process_telegram_update(payload)
    return Response({"ok": True})


class MerchantTelegramTestView(APIView):
    """POST — send a test message to all linked Telegram recipients."""

    permission_classes = [IsAuthenticated, IsShopStaffWithOnlineStorefront]

    def post(self, request):
        from shops.telegram_notify import send_test_notification

        shop_id = require_shop_id(request)
        shop = Shop.objects.filter(pk=shop_id, online_storefront_enabled=True).first()
        if shop is None:
            raise PermissionDenied("Online storefront is not enabled for this shop.")
        settings = get_or_create_storefront_settings(shop)
        ok, total = send_test_notification(settings)
        return Response({"sent": ok, "total": total})


class MerchantWhatsAppTestView(APIView):
    """POST — send a test WhatsApp message (optional body: { \"phone\": \"07...\" })."""

    permission_classes = [IsAuthenticated, IsShopStaffWithOnlineStorefront]

    def post(self, request):
        from shops.whatsapp_notify import send_test_customer_notification

        shop_id = require_shop_id(request)
        shop = Shop.objects.filter(pk=shop_id, online_storefront_enabled=True).first()
        if shop is None:
            raise PermissionDenied("Online storefront is not enabled for this shop.")
        settings = get_or_create_storefront_settings(shop)
        phone = (request.data.get("phone") if isinstance(request.data, dict) else None) or ""
        ok = send_test_customer_notification(settings, phone=str(phone).strip() or None)
        return Response({"ok": ok})
