from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0018_storefront_logo"),
    ]

    operations = [
        migrations.AddField(
            model_name="shopsettings",
            name="online_order_sound_enabled",
            field=models.BooleanField(default=True),
        ),
    ]
