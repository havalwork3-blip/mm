from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0024_storefront_product_content"),
    ]

    operations = [
        migrations.AddField(
            model_name="storefrontorder",
            name="customer_notes",
            field=models.TextField(blank=True, default=""),
        ),
    ]
