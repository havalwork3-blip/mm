# Generated manually for shareholder capital field.

import decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0015_purchasereturn_purchasereturnline"),
    ]

    operations = [
        migrations.AddField(
            model_name="shareholder",
            name="capital_contribution_usd",
            field=models.DecimalField(
                decimal_places=4,
                default=decimal.Decimal("0"),
                help_text="Partner capital recorded in the system (USD).",
                max_digits=18,
            ),
        ),
    ]
