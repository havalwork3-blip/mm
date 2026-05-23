from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0025_storefront_order_customer_notes"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="storefront_home_order",
            field=models.PositiveIntegerField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="category",
            name="storefront_bg_from",
            field=models.CharField(blank=True, default="", max_length=7),
        ),
        migrations.AddField(
            model_name="category",
            name="storefront_bg_to",
            field=models.CharField(blank=True, default="", max_length=7),
        ),
    ]
