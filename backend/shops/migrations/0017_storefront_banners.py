from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0019_storefront_orders"),
        ("shops", "0016_storefront_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="storefrontsettings",
            name="banner_rotate_seconds",
            field=models.PositiveSmallIntegerField(default=5),
        ),
        migrations.CreateModel(
            name="StorefrontBanner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("title", models.CharField(blank=True, default="", max_length=255)),
                ("subtitle", models.CharField(blank=True, default="", max_length=500)),
                ("image", models.ImageField(blank=True, null=True, upload_to="storefront-banners/%Y/%m/")),
                (
                    "link_type",
                    models.CharField(
                        choices=[("none", "None"), ("url", "External URL"), ("category", "Product category")],
                        default="none",
                        max_length=16,
                    ),
                ),
                ("link_url", models.URLField(blank=True, default="", max_length=500)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="storefront_banners",
                        to="inventory.category",
                    ),
                ),
                (
                    "shop",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="storefront_banners",
                        to="shops.shop",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
            },
        ),
    ]
