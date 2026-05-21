from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shops", "0024_storefront_telegram"),
    ]

    operations = [
        migrations.AddField(
            model_name="storefrontsettings",
            name="header_show_shop_name",
            field=models.BooleanField(
                default=False,
                help_text="When catalog title is empty, show the shop legal name in the header.",
            ),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="home_categories_title",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="home_highlights_title",
            field=models.CharField(blank=True, default="", max_length=200),
        ),
        migrations.AddField(
            model_name="storefrontsettings",
            name="home_collection_titles",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
