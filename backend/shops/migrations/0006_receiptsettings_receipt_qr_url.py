from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shops", "0005_shop_purchase_receipt_seq"),
    ]

    operations = [
        migrations.AddField(
            model_name="receiptsettings",
            name="receipt_qr_url",
            field=models.TextField(blank=True, default=""),
        ),
    ]
