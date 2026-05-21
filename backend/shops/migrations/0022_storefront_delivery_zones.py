from decimal import Decimal

import django.core.validators
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0021_storefront_social_links"),
    ]

    operations = [
        migrations.CreateModel(
            name="StorefrontDeliveryZone",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "shop",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="shops.shop",
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                (
                    "delivery_fee_usd",
                    models.DecimalField(
                        decimal_places=4,
                        default=Decimal("0"),
                        max_digits=18,
                        validators=[django.core.validators.MinValueValidator(Decimal("0"))],
                    ),
                ),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["sort_order", "name", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="storefrontdeliveryzone",
            constraint=models.UniqueConstraint(
                fields=("shop", "name"),
                name="uniq_storefront_delivery_zone_shop_name",
            ),
        ),
    ]
