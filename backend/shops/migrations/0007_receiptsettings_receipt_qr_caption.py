from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shops", "0006_receiptsettings_receipt_qr_url"),
    ]

    operations = [
        migrations.AddField(
            model_name="receiptsettings",
            name="receipt_qr_caption",
            field=models.TextField(blank=True, default=""),
        ),
    ]
