from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.exceptions import ValidationError
from django.db import models


class UserRole(models.TextChoices):
    OWNER = "owner", "Owner"
    MANAGER = "manager", "Manager"
    RECEIPT_EDITOR = "receipt_editor", "Receipt editor"
    EMPLOYEE = "employee", "Employee"


class UserManager(BaseUserManager):
    """Email-based user creation (no username)."""

    use_in_migrations = True

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    """Auth user scoped to a shop with an owner/employee role."""

    username = None
    email = models.EmailField(unique=True)
    shop = models.ForeignKey(
        "shops.Shop",
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
    )
    role = models.CharField(
        max_length=20,
        choices=UserRole.choices,
        default=UserRole.EMPLOYEE,
    )
    display_name = models.CharField(max_length=120, blank=True, default="")
    profile_picture = models.ImageField(
        upload_to="profile-pictures/%Y/%m/",
        blank=True,
        null=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        ordering = ["email"]

    def clean(self) -> None:
        super().clean()
        if not self.is_superuser and self.shop_id is None:
            raise ValidationError({"shop": "Shop is required for non-superuser accounts."})

    def __str__(self) -> str:
        return self.email

    @property
    def effective_display_name(self) -> str:
        name = (self.display_name or "").strip()
        if name:
            return name
        local = (self.email or "").split("@", 1)[0].strip()
        return local or self.email


class UserActivityLog(models.Model):
    """Chronological work events for employee profile history."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="activity_logs",
    )
    shop = models.ForeignKey(
        "shops.Shop",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="user_activity_logs",
    )
    action = models.CharField(max_length=40, db_index=True)
    label = models.CharField(max_length=255)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self) -> str:
        return f"{self.user_id} {self.action} @ {self.created_at:%Y-%m-%d %H:%M}"
