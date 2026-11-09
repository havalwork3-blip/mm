from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0034_product_batch_fifo"),
    ]

    operations = [
        migrations.AddField(
            model_name="salereturn",
            name="cash_refund_usd",
            field=models.DecimalField(blank=True, decimal_places=4, max_digits=18, null=True),
        ),
    ]
