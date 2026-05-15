from django.db import migrations, models


def _preset_links_default():
    return [
        {"id": "instagram", "url": "", "enabled": True},
        {"id": "facebook", "url": "", "enabled": True},
        {"id": "tiktok", "url": "", "enabled": True},
        {"id": "youtube", "url": "", "enabled": True},
        {"id": "whatsapp", "url": "", "enabled": True},
        {"id": "telegram", "url": "", "enabled": True},
        {"id": "snapchat", "url": "", "enabled": True},
        {"id": "x", "url": "", "enabled": True},
        {"id": "website", "url": "", "enabled": True},
    ]


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0010_shop_cashier_permission"),
    ]

    operations = [
        migrations.CreateModel(
            name="QrLandingSettings",
            fields=[
                ("id", models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ("headline", models.CharField(blank=True, default="", max_length=255)),
                ("tagline", models.CharField(blank=True, default="", max_length=500)),
                ("accent_color", models.CharField(default="#c9a962", max_length=32)),
                ("primary_logo", models.ImageField(blank=True, null=True, upload_to="qr-landing/")),
                ("phone", models.CharField(blank=True, default="", max_length=64)),
                ("preset_links", models.JSONField(default=_preset_links_default)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "QR landing settings",
            },
        ),
        migrations.CreateModel(
            name="QrLandingCustomLink",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("label", models.CharField(max_length=120)),
                ("url", models.CharField(max_length=500)),
                ("enabled", models.BooleanField(default=True)),
                ("bg_color", models.CharField(blank=True, default="#14110f", max_length=32)),
                ("logo", models.ImageField(blank=True, null=True, upload_to="qr-landing/custom/")),
                (
                    "settings",
                    models.ForeignKey(
                        on_delete=models.CASCADE,
                        related_name="extra_links",
                        to="shops.qrlandingsettings",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
            },
        ),
    ]
