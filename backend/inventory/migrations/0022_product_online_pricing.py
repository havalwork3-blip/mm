from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0021_category_names_i18n"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="online_sale_price",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                max_digits=18,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="online_discount_percent",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0"),
                max_digits=5,
            ),
        ),
        migrations.AddField(
            model_name="product",
            name="online_discount_min_quantity",
            field=models.PositiveSmallIntegerField(default=1),
        ),
    ]
