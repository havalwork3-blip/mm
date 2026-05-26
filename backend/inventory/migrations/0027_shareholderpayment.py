# Generated manually for partner profit payments.

import decimal

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0026_category_storefront_card"),
    ]

    operations = [
        migrations.CreateModel(
            name="ShareholderPayment",
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
                    "amount_usd",
                    models.DecimalField(
                        decimal_places=4,
                        max_digits=18,
                        validators=[
                            django.core.validators.MinValueValidator(
                                decimal.Decimal("0.0001"),
                            ),
                        ],
                    ),
                ),
                ("paid_on", models.DateField(db_index=True)),
                (
                    "period_from",
                    models.DateField(
                        help_text="Profit report period start when this payment was recorded.",
                    ),
                ),
                (
                    "period_to",
                    models.DateField(
                        help_text="Profit report period end when this payment was recorded.",
                    ),
                ),
                ("note", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "shareholder",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="profit_payments",
                        to="inventory.shareholder",
                    ),
                ),
                (
                    "shop",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="shops.shop",
                    ),
                ),
            ],
            options={
                "ordering": ["-paid_on", "-id"],
            },
        ),
    ]
