from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0020_storefront_content"),
    ]

    operations = [
        migrations.AddField(
            model_name="storefrontsettings",
            name="social_links",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
