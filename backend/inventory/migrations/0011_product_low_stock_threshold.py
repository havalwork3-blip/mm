from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0010_product_is_unregistered_placeholder"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="low_stock_threshold",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
