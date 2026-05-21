from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0025_storefront_copy_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="storefrontsettings",
            name="whatsapp_customer_notify_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="whatsapp_access_token",
            field=models.CharField(blank=True, default="", max_length=512),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="whatsapp_phone_number_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
    ]
