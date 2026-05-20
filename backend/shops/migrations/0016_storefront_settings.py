from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0015_shop_online_storefront"),
    ]

    operations = [
        migrations.CreateModel(
            name="StorefrontSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("catalog_title", models.CharField(blank=True, default="", max_length=255)),
                ("catalog_subtitle", models.CharField(blank=True, default="", max_length=500)),
                ("welcome_message", models.CharField(blank=True, default="", max_length=1000)),
                ("accent_color", models.CharField(default="#fbbf24", max_length=32)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "shop",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="storefront_settings",
                        to="shops.shop",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("shop",),
                        name="uniq_storefront_settings_shop",
                    ),
                ],
            },
        ),
    ]
