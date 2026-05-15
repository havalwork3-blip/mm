from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import User
from .serializers import (
    UserAdminCreateSerializer,
    UserAdminUpdateSerializer,
    UserDetailSerializer,
    UserSerializer,
)


class IsSuperuser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser,
        )


class UserViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = User.objects.select_related("shop").prefetch_related(
        "groups",
        "user_permissions",
    )
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "reset_password"):
            return [IsAuthenticated(), IsSuperuser()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == "retrieve":
            if self.request.user.is_superuser:
                return UserDetailSerializer
            return UserSerializer
        if self.action == "me":
            return UserSerializer
        if self.action == "create":
            return UserAdminCreateSerializer
        if self.action in ("update", "partial_update"):
            return UserAdminUpdateSerializer
        return UserSerializer

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.is_superuser:
            return qs.all()
        if user.shop_id:
            return qs.filter(shop_id=user.shop_id)
        return User.objects.none()

    @action(detail=False, methods=["get"], permission_classes=[IsAuthenticated])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        user = self.get_object()
        password = request.data.get("password")
        if not password or not isinstance(password, str):
            raise ValidationError({"password": "Password is required."})
        if len(password) < 8:
            raise ValidationError(
                {"password": "Password must be at least 8 characters."},
            )
        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"detail": "Password updated."})
