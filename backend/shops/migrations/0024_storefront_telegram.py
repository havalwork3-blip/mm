from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0023_storefront_delivery_free_min"),
    ]

    operations = [
        migrations.AddField(
            model_name="storefrontsettings",
            name="telegram_notify_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="telegram_bot_token",
            field=models.CharField(blank=True, default="", max_length=256),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="telegram_link_code",
            field=models.CharField(blank=True, default="", max_length=32),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="telegram_recipients",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
