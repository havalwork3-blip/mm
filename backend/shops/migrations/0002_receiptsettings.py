from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("shops", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ReceiptSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("logo", models.ImageField(blank=True, null=True, upload_to="receipt-logos/%Y/%m/")),
                ("shop_name_en", models.CharField(blank=True, max_length=255)),
                ("shop_name_ku", models.CharField(blank=True, max_length=255)),
                (
                    "sub_title",
                    models.CharField(
                        blank=True,
                        default="بۆ بازرگانی مۆبایل و پێداویستییەکانی",
                        max_length=255,
                    ),
                ),
                ("address", models.CharField(blank=True, max_length=255)),
                ("phone_number", models.CharField(blank=True, max_length=64)),
                ("email", models.EmailField(blank=True, max_length=254)),
                (
                    "footer_note",
                    models.CharField(
                        blank=True,
                        default="هەڵە و سەهوو دەگەڕێتەوە بۆ هەردوولا",
                        max_length=255,
                    ),
                ),
                ("direct_print", models.BooleanField(default=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("shop", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to="shops.shop")),
            ],
            options={},
        ),
        migrations.AddConstraint(
            model_name="receiptsettings",
            constraint=models.UniqueConstraint(fields=("shop",), name="uniq_receipt_settings_shop"),
        ),
    ]

