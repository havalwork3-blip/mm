from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0012_shop_settings_theme_colors"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="shop",
            options={
                "ordering": ["name"],
                "permissions": [
                    ("view_profitreport", "Can view profit report"),
                    ("view_cashier", "Can use cashier (Qasa)"),
                    (
                        "view_jard_financials",
                        "Can view Jard buy prices, stock value, and sales totals",
                    ),
                ],
            },
        ),
    ]
