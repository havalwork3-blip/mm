import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shops", "0003_receiptsettings_receipt_format"),
    ]

    operations = [
        migrations.AddField(
            model_name="receiptsettings",
            name="show_customer_balance",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="receiptsettings",
            name="show_item_images",
            field=models.BooleanField(default=True),
        ),
        migrations.CreateModel(
            name="ShopSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("primary_color", models.CharField(default="#7c3aed", max_length=7)),
                (
                    "default_mode",
                    models.CharField(
                        choices=[("light", "Light"), ("dark", "Dark"), ("system", "System")],
                        default="system",
                        max_length=10,
                    ),
                ),
                ("low_stock_threshold", models.PositiveIntegerField(default=5)),
                (
                    "base_currency",
                    models.CharField(
                        choices=[("USD", "USD"), ("IQD", "IQD")],
                        default="USD",
                        max_length=3,
                    ),
                ),
                ("complete_sale_shortcut", models.CharField(default="F12", max_length=32)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "shop",
                    models.ForeignKey(
                        db_index=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        to="shops.shop",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="shopsettings",
            constraint=models.UniqueConstraint(fields=("shop",), name="uniq_shop_settings_shop"),
        ),
    ]
