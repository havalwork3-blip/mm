from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0019_online_order_sound"),
    ]

    operations = [
        migrations.AddField(
            model_name="storefrontsettings",
            name="price_display_default",
            field=models.CharField(
                choices=[("usd", "USD"), ("iqd", "IQD"), ("both", "Both")],
                default="usd",
                max_length=8,
            ),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="contact_phone",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="contact_whatsapp",
            field=models.CharField(blank=True, default="", max_length=64),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="contact_email",
            field=models.EmailField(blank=True, default="", max_length=254),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="about_title",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="about_body",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="faq_items",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="shop_address",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="location_url",
            field=models.URLField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="location_image",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="storefront-location/%Y/%m/",
            ),
        ),
    ]
