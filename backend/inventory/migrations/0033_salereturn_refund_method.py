from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0032_backfill_sale_line_buy_prices"),
    ]

    operations = [
        migrations.AddField(
            model_name="salereturn",
            name="refund_method",
            field=models.CharField(
                choices=[
                    ("cash", "Cash refund"),
                    ("debt_reduction", "Deduct from customer debt"),
                ],
                default="cash",
                max_length=20,
            ),
        ),
    ]
