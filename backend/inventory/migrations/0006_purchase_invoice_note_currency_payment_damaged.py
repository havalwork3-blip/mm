from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0005_normalize_empty_sku_barcode"),
    ]

    operations = [
        migrations.AddField(
            model_name="purchase",
            name="invoice_number",
            field=models.CharField(blank=True, default="", max_length=128),
        ),
        migrations.AddField(
            model_name="purchase",
            name="note",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="purchase",
            name="currency",
            field=models.CharField(
                choices=[("USD", "USD"), ("IQD", "IQD")],
                default="USD",
                max_length=3,
            ),
        ),
        migrations.AddField(
            model_name="purchase",
            name="payment_type",
            field=models.CharField(
                choices=[("cash", "cash"), ("debt", "debt")],
                default="debt",
                max_length=8,
            ),
        ),
        migrations.AddField(
            model_name="purchaseline",
            name="damaged_quantity",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
