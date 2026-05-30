from rest_framework import serializers

from .models import (
    ContactMessage,
    MarketingEditor,
    MarketingProductCard,
    MarketingProductCategory,
    MarketingSiteContent,
)


class MarketingLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)


class PublicContactSubmitSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    email = serializers.EmailField()
    message = serializers.CharField(max_length=5000)
    lang = serializers.CharField(max_length=8, required=False, default="ckb")
    website = serializers.CharField(required=False, allow_blank=True, default="")


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = [
            "id",
            "name",
            "email",
            "message",
            "lang",
            "is_read",
            "ip_address",
            "created_at",
        ]
        read_only_fields = ["id", "ip_address", "created_at"]


class MarketingEditorSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingEditor
        fields = ["id", "email", "display_name", "is_active", "created_at", "updated_at"]
        read_only_fields = fields


class MarketingSiteContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingSiteContent
        fields = ["translations", "sections", "is_published", "updated_at"]
        read_only_fields = ["updated_at"]

    def validate_translations(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("translations must be an object.")
        for lang in ("ckb", "ar", "en"):
            if lang in value and not isinstance(value[lang], dict):
                raise serializers.ValidationError(f"translations.{lang} must be an object.")
        return value

    def validate_sections(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("sections must be an object.")
        return value


class MarketingProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingProductCategory
        fields = ["id", "page", "title", "sort_order", "is_published", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_title(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("title must be an object with ckb/ar/en keys.")
        return value


class MarketingProductCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingProductCard
        fields = [
            "id",
            "page",
            "category",
            "title",
            "tag",
            "link_url",
            "tone",
            "sort_order",
            "is_published",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_title(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("title must be an object with ckb/ar/en keys.")
        return value

    def validate_tag(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("tag must be an object.")
        return value
