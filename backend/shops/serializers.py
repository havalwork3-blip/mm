from rest_framework import serializers

from shops.storefront_hosts import normalize_storefront_host, validate_storefront_host

from .models import (
    Currency,
    QrLandingCustomLink,
    ReceiptSettings,
    Shop,
    ShopSettings,
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
            "updated_at",
        ]
        read_only_fields = ["id", "shop", "updated_at"]


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
