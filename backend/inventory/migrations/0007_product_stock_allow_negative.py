from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0006_purchase_invoice_note_currency_payment_damaged"),
    ]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="current_stock_quantity",
            field=models.IntegerField(default=0),
        ),
    ]
