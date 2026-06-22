from datetime import date

from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from shops.scoping import get_shop_id_for_request

from .activity import log_user_activity, maybe_log_session_start
from .models import User
from .profile_activity import daily_activity_for_user
from .serializers import (
    UserActivityEntrySerializer,
    UserAdminCreateSerializer,
    UserAdminUpdateSerializer,
    UserDetailSerializer,
    UserProfileUpdateSerializer,
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
        if self.action == "update_profile":
            return UserProfileUpdateSerializer
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

    @action(
        detail=False,
        methods=["get"],
        permission_classes=[IsAuthenticated],
    )
    def me(self, request):
        shop_id = get_shop_id_for_request(request)
        maybe_log_session_start(request.user, shop_id)
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

    @action(
        detail=False,
        methods=["patch"],
        url_path="me/profile",
        parser_classes=[MultiPartParser, FormParser, JSONParser],
        permission_classes=[IsAuthenticated],
    )
    def update_profile(self, request):
        user = request.user
        serializer = UserProfileUpdateSerializer(
            user,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        shop_id = get_shop_id_for_request(request)
        log_user_activity(
            user,
            shop_id=shop_id,
            action="profile_updated",
            label="profile_updated",
            meta={},
        )
        out = UserSerializer(user, context={"request": request})
        return Response(out.data)

    @action(
        detail=False,
        methods=["get"],
        url_path="me-activity",
        permission_classes=[IsAuthenticated],
    )
    def me_activity(self, request):
        raw = (request.query_params.get("date") or "").strip()
        if raw:
            try:
                for_date = date.fromisoformat(raw)
            except ValueError as exc:
                raise ValidationError({"date": "Use YYYY-MM-DD."}) from exc
        else:
            for_date = date.today()

        shop_id = get_shop_id_for_request(request)
        entries = daily_activity_for_user(
            request.user,
            for_date,
            shop_id=shop_id,
        )
        ser = UserActivityEntrySerializer(entries, many=True)
        return Response(
            {
                "date": for_date.isoformat(),
                "entries": ser.data,
            },
        )

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
