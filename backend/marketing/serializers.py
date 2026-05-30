from rest_framework import serializers

from .models import MarketingEditor, MarketingSiteContent


class MarketingLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)


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
