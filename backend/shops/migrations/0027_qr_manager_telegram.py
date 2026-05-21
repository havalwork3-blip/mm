from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0026_storefront_whatsapp_customer"),
    ]

    operations = [
        migrations.AddField(
            model_name="qrlandingsettings",
            name="manager_telegram_notify_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="qrlandingsettings",
            name="manager_telegram_bot_token",
            field=models.CharField(blank=True, default="", max_length=256),
        ),
        migrations.AddField(
            model_name="qrlandingsettings",
            name="manager_telegram_chat_id",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="qrlandingsettings",
            name="manager_telegram_send_hour",
            field=models.PositiveSmallIntegerField(default=8),
        ),
        migrations.AddField(
            model_name="qrlandingsettings",
            name="manager_telegram_send_minute",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="qrlandingsettings",
            name="manager_telegram_last_sent_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
