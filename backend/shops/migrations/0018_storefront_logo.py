from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0017_storefront_banners"),
    ]

    operations = [
        migrations.AddField(
            model_name="storefrontsettings",
            name="logo",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="storefront-logos/%Y/%m/",
            ),
        ),
    ]
