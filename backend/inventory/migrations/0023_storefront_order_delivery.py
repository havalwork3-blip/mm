from decimal import Decimal

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0022_product_online_pricing"),
        ("shops", "0022_storefront_delivery_zones"),
    ]

    operations = [
        migrations.AddField(
            model_name="storefrontorder",
            name="subtotal_amount",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                max_digits=18,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="storefrontorder",
            name="delivery_fee",
            field=models.DecimalField(
                decimal_places=4,
                default=Decimal("0"),
                max_digits=18,
            ),
        ),
        migrations.AddField(
            model_name="storefrontorder",
            name="delivery_zone_name",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="storefrontorder",
            name="delivery_zone",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="orders",
                to="shops.storefrontdeliveryzone",
            ),
        ),
    ]
