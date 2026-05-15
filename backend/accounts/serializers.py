from django.contrib.auth.models import Permission
from django.db.models import Q
from rest_framework import serializers

from shops.models import Shop

from .models import User


PERMISSION_DEPENDENCIES: dict[tuple[str, str], tuple[tuple[str, str], ...]] = {
    # Product add/change: category + shop lookups. Do not auto-inject ``view_company`` here:
    # that would re-add "purchasing" permissions after the admin removes them, because
    # company rows appear under the purchase section in the UI. Grant ``view_company``
    # explicitly if a user needs the supplier list outside of purchase screens.
    ("inventory", "product"): (
        ("inventory", "category"),
        ("shops", "shop"),
    ),
}


def _permission_to_dict(p: Permission) -> dict:
    ct = p.content_type
    return {
        "id": p.id,
        "codename": p.codename,
        "name": p.name,
        "app_label": ct.app_label,
        "model": ct.model,
    }


class UserSerializer(serializers.ModelSerializer):
    shop_name = serializers.SerializerMethodField()
    user_permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "shop",
            "shop_name",
            "role",
            "is_active",
            "is_staff",
            "is_superuser",
            "date_joined",
            "last_login",
            "user_permissions",
        ]
        read_only_fields = fields

    def get_shop_name(self, obj: User) -> str:
        return obj.shop.name if obj.shop_id else ""

    def get_user_permissions(self, obj: User) -> list[str]:
        # Includes both direct user permissions and group-inherited permissions.
        return sorted(obj.get_all_permissions())


class UserDetailSerializer(UserSerializer):
    """GET /users/:id/ — includes catalog + current user permission ids (superuser tooling)."""

    all_permissions = serializers.SerializerMethodField()
    user_permission_ids = serializers.SerializerMethodField()

    class Meta(UserSerializer.Meta):
        fields = UserSerializer.Meta.fields + [
            "all_permissions",
            "user_permission_ids",
        ]
        read_only_fields = fields

    def get_all_permissions(self, obj: User) -> list[dict]:
        qs = Permission.objects.select_related("content_type").order_by(
            "content_type__app_label",
            "content_type__model",
            "codename",
        )
        return [_permission_to_dict(p) for p in qs]

    def get_user_permission_ids(self, obj: User) -> list[int]:
        return list(obj.user_permissions.order_by("id").values_list("id", flat=True))


class UserAdminUpdateSerializer(serializers.ModelSerializer):
    """Superuser-only partial updates for Django-admin–style user editing."""

    shop = serializers.PrimaryKeyRelatedField(
        queryset=Shop.objects.all(),
        allow_null=True,
        required=False,
    )
    user_permission_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        write_only=True,
    )
    user_permission_codenames = serializers.ListField(
        child=serializers.CharField(max_length=255),
        required=False,
        write_only=True,
    )

    class Meta:
        model = User
        fields = [
            "email",
            "shop",
            "role",
            "is_active",
            "is_staff",
            "is_superuser",
            "user_permission_ids",
            "user_permission_codenames",
        ]

    def validate_email(self, value: str) -> str:
        value = User.objects.normalize_email(value)
        if User.objects.exclude(pk=self.instance.pk).filter(email=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate_user_permission_ids(self, value: list[int]) -> list[int]:
        if value is None:
            return value
        unique = list(dict.fromkeys(value))
        count = Permission.objects.filter(pk__in=unique).count()
        if count != len(unique):
            raise serializers.ValidationError("Invalid or unknown permission id(s).")
        return unique

    def validate(self, attrs: dict) -> dict:
        if "user_permission_ids" in attrs and "user_permission_codenames" in attrs:
            raise serializers.ValidationError(
                {
                    "user_permission_ids": (
                        "Send either user_permission_ids or user_permission_codenames, "
                        "not both."
                    ),
                },
            )

        instance: User = self.instance
        request = self.context.get("request")
        is_super = attrs.get("is_superuser", instance.is_superuser)
        shop = attrs.get("shop", instance.shop)

        if request and instance.pk == request.user.pk:
            if "is_superuser" in attrs and attrs["is_superuser"] is False:
                raise serializers.ValidationError(
                    {
                        "is_superuser": "You cannot remove your own superuser status.",
                    },
                )

        if not is_super and shop is None:
            raise serializers.ValidationError(
                {"shop": "Shop is required for non-superuser accounts."},
            )

        return attrs

    def update(self, instance: User, validated_data: dict) -> User:
        perm_ids = validated_data.pop("user_permission_ids", None)
        codenames_raw = validated_data.pop("user_permission_codenames", None)

        if codenames_raw is not None:
            resolved: list[int] = []
            for token in codenames_raw:
                if "." not in token:
                    raise serializers.ValidationError(
                        {
                            "user_permission_codenames": (
                                f"Each entry must be app_label.codename, got: {token!r}"
                            ),
                        },
                    )
                app_label, codename = token.split(".", 1)
                p = Permission.objects.filter(
                    content_type__app_label=app_label,
                    codename=codename,
                ).first()
                if p is None:
                    raise serializers.ValidationError(
                        {
                            "user_permission_codenames": (
                                f"Unknown permission {app_label}.{codename}"
                            ),
                        },
                    )
                resolved.append(p.pk)
            perm_ids = list(dict.fromkeys(resolved))

        def with_dependencies(ids: list[int]) -> list[int]:
            perms = list(
                Permission.objects.filter(pk__in=ids).select_related("content_type"),
            )
            desired = set(ids)
            view_targets: set[tuple[str, str]] = set()

            for perm in perms:
                app_label = perm.content_type.app_label
                model = perm.content_type.model
                codename = perm.codename or ""
                if codename.startswith(("add_", "change_")):
                    # Always include view_<same model> when add/change is granted.
                    view_targets.add((app_label, model))
                    # Include known cross-model prerequisites used by forms.
                    view_targets.update(PERMISSION_DEPENDENCIES.get((app_label, model), ()))

            if not view_targets:
                return ids

            query = Q()
            for app_label, model in view_targets:
                query |= Q(
                    content_type__app_label=app_label,
                    content_type__model=model,
                    codename=f"view_{model}",
                )
            if query:
                desired.update(Permission.objects.filter(query).values_list("id", flat=True))
            return sorted(desired)

        instance = super().update(instance, validated_data)

        if perm_ids is not None:
            perm_ids = with_dependencies(perm_ids)
            instance.user_permissions.set(Permission.objects.filter(pk__in=perm_ids))

        return instance


class UserAdminCreateSerializer(serializers.ModelSerializer):
    """Superuser-only user creation from Admin → Users."""

    shop = serializers.PrimaryKeyRelatedField(
        queryset=Shop.objects.all(),
        allow_null=True,
        required=False,
    )
    password = serializers.CharField(min_length=8, write_only=True)
    user_permission_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        write_only=True,
    )

    class Meta:
        model = User
        fields = [
            "email",
            "password",
            "shop",
            "role",
            "is_active",
            "is_staff",
            "is_superuser",
            "user_permission_ids",
        ]

    def validate_email(self, value: str) -> str:
        value = User.objects.normalize_email(value)
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with that email already exists.")
        return value

    def validate_user_permission_ids(self, value: list[int]) -> list[int]:
        unique = list(dict.fromkeys(value))
        count = Permission.objects.filter(pk__in=unique).count()
        if count != len(unique):
            raise serializers.ValidationError("Invalid or unknown permission id(s).")
        return unique

    def validate(self, attrs: dict) -> dict:
        is_super = attrs.get("is_superuser", False)
        shop = attrs.get("shop")
        if not is_super and shop is None:
            raise serializers.ValidationError(
                {"shop": "Shop is required for non-superuser accounts."},
            )
        return attrs

    def create(self, validated_data: dict) -> User:
        perm_ids = validated_data.pop("user_permission_ids", [])
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)
        if perm_ids:
            user.user_permissions.set(Permission.objects.filter(pk__in=perm_ids))
        return user
