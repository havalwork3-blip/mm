import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0029_backfill_manual_sale_line_products"),
    ]

    operations = [
        migrations.CreateModel(
            name="CustomerDebtDiscountWriteoff",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount_usd", models.DecimalField(decimal_places=4, max_digits=18)),
                ("occurred_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "customer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="debt_discount_writeoffs",
                        to="inventory.customer",
                    ),
                ),
                (
                    "shop",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(class)ss",
                        to="shops.shop",
                    ),
                ),
            ],
            options={
                "ordering": ["-occurred_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="CustomerDebtDiscountWriteoffSale",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount_usd", models.DecimalField(decimal_places=4, max_digits=18)),
                (
                    "sale",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="debt_discount_writeoff_lines",
                        to="inventory.sale",
                    ),
                ),
                (
                    "writeoff",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sale_lines",
                        to="inventory.customerdebtdiscountwriteoff",
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("writeoff", "sale"),
                        name="uniq_debt_writeoff_sale_line",
                    ),
                ],
            },
        ),
    ]
