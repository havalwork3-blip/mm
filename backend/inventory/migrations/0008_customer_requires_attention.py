from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0007_product_stock_allow_negative"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="requires_attention",
            field=models.BooleanField(default=False),
        ),
    ]
