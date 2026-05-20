from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shops", "0014_ensure_jard_financials_permission"),
    ]

    operations = [
        migrations.AddField(
            model_name="shop",
            name="online_storefront_enabled",
            field=models.BooleanField(
                default=False,
                help_text="When enabled, this shop has a public online catalog and checkout.",
            ),
        ),
        migrations.AddField(
            model_name="shop",
            name="storefront_host",
            field=models.CharField(
                blank=True,
                db_index=True,
                default="",
                help_text="Public hostname for the shop storefront, e.g. rada.mmiraq.com",
                max_length=255,
            ),
        ),
        migrations.AddConstraint(
            model_name="shop",
            constraint=models.UniqueConstraint(
                condition=models.Q(storefront_host__gt=""),
                fields=("storefront_host",),
                name="uniq_shop_storefront_host_when_set",
            ),
        ),
    ]
