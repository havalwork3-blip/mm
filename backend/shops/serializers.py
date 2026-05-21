from decimal import Decimal

from django.utils.text import slugify as django_slugify
from rest_framework import serializers

from shops.storefront_hosts import normalize_storefront_host, validate_storefront_host

from inventory.models import Category

from .models import (
    Currency,
    QrLandingCustomLink,
    ReceiptSettings,
    Shop,
    ShopSettings,
    StorefrontBanner,
    StorefrontDeliveryZone,
    StorefrontSettings,
)


class ShopSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shop
        fields = [
            "id",
            "name",
            "slug",
            "settings",
            "is_active",
            "online_storefront_enabled",
            "storefront_host",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def _request_user_is_superuser(self) -> bool:
        request = self.context.get("request")
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and user.is_superuser)

    def validate_slug(self, value: str) -> str:
        normalized = django_slugify(str(value or "").strip())
        if not normalized:
            raise serializers.ValidationError("Slug is required.")
        return normalized

    def validate(self, attrs: dict) -> dict:
        storefront_keys = ("online_storefront_enabled", "storefront_host")
        if any(k in attrs for k in storefront_keys) and not self._request_user_is_superuser():
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Only superusers may configure the online storefront for a shop.",
                    ],
                },
            )

        enabled = attrs.get(
            "online_storefront_enabled",
            getattr(self.instance, "online_storefront_enabled", False),
        )
        raw_host = attrs.get("storefront_host", getattr(self.instance, "storefront_host", ""))
        if "storefront_host" in attrs:
            try:
                attrs["storefront_host"] = validate_storefront_host(str(raw_host or ""))
            except ValueError as exc:
                raise serializers.ValidationError({"storefront_host": str(exc)}) from exc
        else:
            attrs.setdefault("storefront_host", normalize_storefront_host(str(raw_host or "")))

        host = str(attrs.get("storefront_host", "") or "")
        if enabled and not host:
            raise serializers.ValidationError(
                {"storefront_host": "Required when online shopping is enabled."},
            )
        if not enabled and "online_storefront_enabled" in attrs:
            attrs["storefront_host"] = ""

        if host:
            dup = Shop.objects.filter(storefront_host=host)
            if self.instance is not None:
                dup = dup.exclude(pk=self.instance.pk)
            if dup.exists():
                raise serializers.ValidationError(
                    {"storefront_host": "This hostname is already used by another shop."},
                )

        return attrs

    def create(self, validated_data: dict) -> Shop:
        if not self._request_user_is_superuser():
            validated_data.pop("online_storefront_enabled", None)
            validated_data.pop("storefront_host", None)
        return super().create(validated_data)

    def update(self, instance: Shop, validated_data: dict) -> Shop:
        if not self._request_user_is_superuser():
            validated_data.pop("online_storefront_enabled", None)
            validated_data.pop("storefront_host", None)
        return super().update(instance, validated_data)


class CurrencySerializer(serializers.ModelSerializer):
    shop = serializers.PrimaryKeyRelatedField(queryset=Shop.objects.all())

    class Meta:
        model = Currency
        fields = ["id", "shop", "date", "usd_to_iqd", "created_at"]
        read_only_fields = ["id", "created_at"]


class ReceiptSettingsSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ReceiptSettings
        fields = [
            "id",
            "shop",
            "logo",
            "logo_url",
            "shop_name_en",
            "shop_name_ku",
            "sub_title",
            "address",
            "receipt_qr_url",
            "receipt_qr_caption",
            "phone_number",
            "email",
            "footer_note",
            "direct_print",
            "show_customer_balance",
            "show_item_images",
            "receipt_format",
            "updated_at",
        ]
        read_only_fields = ["id", "shop", "logo_url", "updated_at"]

    def get_logo_url(self, obj: ReceiptSettings) -> str | None:
        if not obj.logo:
            return None
        request = self.context.get("request")
        url = obj.logo.url
        if request:
            return request.build_absolute_uri(url)
        return url


class ShopSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopSettings
        fields = [
            "id",
            "shop",
            "primary_color",
            "background_color",
            "dark_background_color",
            "accent_color",
            "sidebar_color",
            "surface_color",
            "surface_color_dark",
            "success_color",
            "warning_color",
            "danger_color",
            "default_mode",
            "low_stock_threshold",
            "base_currency",
            "complete_sale_shortcut",
            "online_order_sound_enabled",
            "updated_at",
        ]
        read_only_fields = ["id", "shop", "updated_at"]


class StorefrontSettingsSerializer(serializers.ModelSerializer):
    shop = serializers.PrimaryKeyRelatedField(read_only=True)
    logo_url = serializers.SerializerMethodField(read_only=True)
    location_image_url = serializers.SerializerMethodField(read_only=True)
    storefront_host = serializers.SerializerMethodField(read_only=True)
    storefront_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = StorefrontSettings
        fields = [
            "id",
            "shop",
            "catalog_title",
            "catalog_subtitle",
            "welcome_message",
            "logo",
            "logo_url",
            "accent_color",
            "banner_rotate_seconds",
            "price_display_default",
            "contact_phone",
            "contact_whatsapp",
            "contact_email",
            "about_title",
            "about_body",
            "faq_items",
            "shop_address",
            "location_url",
            "location_image",
            "location_image_url",
            "social_links",
            "delivery_free_min_usd",
            "storefront_host",
            "storefront_url",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "shop",
            "logo_url",
            "location_image_url",
            "storefront_host",
            "storefront_url",
            "updated_at",
        ]

    def get_logo_url(self, obj: StorefrontSettings) -> str | None:
        if not obj.logo:
            return None
        request = self.context.get("request")
        url = obj.logo.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_location_image_url(self, obj: StorefrontSettings) -> str | None:
        if not obj.location_image:
            return None
        request = self.context.get("request")
        url = obj.location_image.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def validate_price_display_default(self, value: str) -> str:
        v = (value or "usd").strip().lower()
        if v not in ("usd", "iqd", "both"):
            raise serializers.ValidationError("Must be usd, iqd, or both.")
        return v

    def validate_faq_items(self, value: object) -> list:
        from shops.storefront_settings_utils import _normalize_faq_items

        return _normalize_faq_items(value)

    def validate_social_links(self, value: object) -> list:
        from shops.storefront_settings_utils import _normalize_social_links

        return _normalize_social_links(value)

    def validate_delivery_free_min_usd(self, value) -> Decimal | None:
        from decimal import Decimal as D

        if value is None or value == "":
            return None
        fee = D(str(value))
        if fee <= 0:
            return None
        return fee.quantize(D("0.0001"))

    def get_storefront_host(self, obj: StorefrontSettings) -> str:
        return (obj.shop.storefront_host or "").strip()

    def get_storefront_url(self, obj: StorefrontSettings) -> str:
        host = (obj.shop.storefront_host or "").strip()
        if not host:
            return ""
        return f"https://{host}"

    def validate_banner_rotate_seconds(self, value: int) -> int:
        if value < 2:
            return 2
        if value > 60:
            return 60
        return value


class StorefrontBannerSerializer(serializers.ModelSerializer):
    shop = serializers.PrimaryKeyRelatedField(read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)
    category_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = StorefrontBanner
        fields = [
            "id",
            "shop",
            "sort_order",
            "title",
            "subtitle",
            "image",
            "image_url",
            "link_type",
            "link_url",
            "category",
            "category_name",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "shop", "image_url", "category_name", "created_at", "updated_at"]
        extra_kwargs = {"image": {"required": False, "write_only": True}}

    def get_category_name(self, obj: StorefrontBanner) -> str | None:
        if obj.category_id is None:
            return None
        cat = obj.category
        if cat is None:
            return None
        return (getattr(cat, "name_ku", None) or cat.name or "").strip() or None

    def get_image_url(self, obj: StorefrontBanner) -> str | None:
        if not obj.image:
            return None
        try:
            url = obj.image.url
        except Exception:
            return None
        request = self.context.get("request")
        if not request:
            return url
        try:
            return request.build_absolute_uri(url)
        except Exception:
            return url

    def to_internal_value(self, data):
        if hasattr(data, "get"):
            mutable = data.copy() if hasattr(data, "copy") else data
            if hasattr(mutable, "get"):
                for key in ("is_active",):
                    if key in mutable and isinstance(mutable.get(key), str):
                        raw = mutable.get(key).strip().lower()
                        if raw in ("true", "1", "yes", "on"):
                            if hasattr(mutable, "_mutable"):
                                mutable._mutable = True
                            mutable[key] = True
                        elif raw in ("false", "0", "no", "off"):
                            if hasattr(mutable, "_mutable"):
                                mutable._mutable = True
                            mutable[key] = False
                if "sort_order" in mutable and isinstance(mutable.get("sort_order"), str):
                    try:
                        if hasattr(mutable, "_mutable"):
                            mutable._mutable = True
                        mutable["sort_order"] = int(mutable.get("sort_order") or 0)
                    except (TypeError, ValueError):
                        pass
            data = mutable
        return super().to_internal_value(data)

    def validate(self, attrs):
        link_type = attrs.get(
            "link_type",
            getattr(self.instance, "link_type", StorefrontBanner.LinkType.NONE),
        )
        link_url = (attrs.get("link_url") or getattr(self.instance, "link_url", "") or "").strip()
        category = attrs.get("category", getattr(self.instance, "category", None))
        if link_type == StorefrontBanner.LinkType.URL and not link_url:
            raise serializers.ValidationError({"link_url": "URL is required for link type URL."})
        if link_type == StorefrontBanner.LinkType.CATEGORY and category is None:
            raise serializers.ValidationError({"category": "Category is required for link type category."})
        if link_type != StorefrontBanner.LinkType.URL:
            attrs["link_url"] = ""
        if link_type != StorefrontBanner.LinkType.CATEGORY:
            attrs["category"] = None
        return attrs

    def validate_category(self, value: Category | None) -> Category | None:
        if value is None:
            return None
        shop_id = self.context.get("shop_id")
        if shop_id is not None and value.shop_id != int(shop_id):
            raise serializers.ValidationError("Category does not belong to this shop.")
        return value

    def create(self, validated_data):
        shop_id = self.context["shop_id"]
        if not validated_data.get("image"):
            raise serializers.ValidationError({"image": "Banner image is required."})
        return StorefrontBanner.objects.create(shop_id=shop_id, **validated_data)


class StorefrontBannerReorderSerializer(serializers.Serializer):
    order = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=True,
    )


QR_PRESET_IDS = frozenset(
    {
        "instagram",
        "facebook",
        "tiktok",
        "youtube",
        "whatsapp",
        "telegram",
        "snapchat",
        "x",
        "website",
    }
)


class QrLandingCustomLinkSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = QrLandingCustomLink
        fields = [
            "id",
            "sort_order",
            "label",
            "url",
            "enabled",
            "bg_color",
            "logo",
            "logo_url",
        ]
        read_only_fields = ["id", "logo_url"]

    def get_logo_url(self, obj: QrLandingCustomLink) -> str | None:
        if not obj.logo:
            return None
        request = self.context.get("request")
        url = obj.logo.url
        if request:
            return request.build_absolute_uri(url)
        return url


class QrLandingAdminPatchSerializer(serializers.Serializer):
    headline = serializers.CharField(allow_blank=True, required=False, max_length=255)
    tagline = serializers.CharField(allow_blank=True, required=False, max_length=500)
    accent_color = serializers.CharField(max_length=32, required=False)
    phone = serializers.CharField(allow_blank=True, required=False, max_length=64)
    preset_links = serializers.ListField(required=False, child=serializers.DictField())

    def validate_preset_links(self, value):
        out = []
        seen = set()
        for row in value:
            if not isinstance(row, dict):
                raise serializers.ValidationError("Each preset entry must be an object.")
            lid = (row.get("id") or "").strip()
            if lid not in QR_PRESET_IDS:
                raise serializers.ValidationError(f"Invalid preset id: {lid!r}.")
            if lid in seen:
                raise serializers.ValidationError(f"Duplicate preset id: {lid!r}.")
            seen.add(lid)
            url = (row.get("url") or "").strip()
            enabled = row.get("enabled", True)
            if enabled is False:
                enabled = False
            else:
                enabled = True
            out.append({"id": lid, "url": url, "enabled": enabled})
        if seen != QR_PRESET_IDS:
            raise serializers.ValidationError("preset_links must include every platform id exactly once.")
        return out


class StorefrontDeliveryZoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = StorefrontDeliveryZone
        fields = [
            "id",
            "shop",
            "name",
            "delivery_fee_usd",
            "sort_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "shop", "created_at", "updated_at"]

    def validate_name(self, value: str) -> str:
        name = (value or "").strip()
        if not name:
            raise serializers.ValidationError("Area name is required.")
        return name[:255]

    def validate_delivery_fee_usd(self, value) -> Decimal:
        from decimal import Decimal as D

        fee = D(str(value))
        if fee < 0:
            raise serializers.ValidationError("Delivery fee cannot be negative.")
        return fee.quantize(D("0.0001"))


class StorefrontDeliveryZonesPatchSerializer(serializers.Serializer):
    """Replace/sync delivery zones and optional free-delivery threshold (USD subtotal)."""

    zones = serializers.ListField(child=serializers.DictField(), required=True)
    delivery_free_min_usd = serializers.DecimalField(
        max_digits=18,
        decimal_places=4,
        required=False,
        allow_null=True,
    )

    def validate_delivery_free_min_usd(self, value) -> Decimal | None:
        from decimal import Decimal as D

        if value is None:
            return None
        fee = D(str(value))
        if fee <= 0:
            return None
        return fee.quantize(D("0.0001"))

    def validate_zones(self, value: list) -> list:
        if len(value) > 50:
            raise serializers.ValidationError("Too many delivery zones (max 50).")
        out: list[dict] = []
        names: set[str] = set()
        for row in value:
            if not isinstance(row, dict):
                raise serializers.ValidationError("Each zone must be an object.")
            name = str(row.get("name") or "").strip()
            if not name:
                raise serializers.ValidationError("Each zone needs a name.")
            key = name.casefold()
            if key in names:
                raise serializers.ValidationError(f"Duplicate area name: {name}")
            names.add(key)
            ser = StorefrontDeliveryZoneSerializer(
                data={
                    "name": name,
                    "delivery_fee_usd": row.get("delivery_fee_usd", "0"),
                    "sort_order": row.get("sort_order", 0),
                    "is_active": row.get("is_active", True),
                },
            )
            ser.is_valid(raise_exception=True)
            item = dict(ser.validated_data)
            if row.get("id") is not None:
                try:
                    item["id"] = int(row["id"])
                except (TypeError, ValueError) as exc:
                    raise serializers.ValidationError("Invalid zone id.") from exc
            out.append(item)
        return out
