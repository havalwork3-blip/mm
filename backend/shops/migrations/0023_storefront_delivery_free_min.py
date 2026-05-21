from decimal import Decimal

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0022_storefront_delivery_zones"),
    ]

    operations = [
        migrations.AddField(
            model_name="storefrontsettings",
            name="delivery_free_min_usd",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text="Order subtotal (USD) at or above this amount gets free delivery. Empty = disabled.",
                max_digits=18,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal("0"))],
            ),
        ),
    ]
