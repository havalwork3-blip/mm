from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shops", "0002_receiptsettings"),
    ]

    operations = [
        migrations.AddField(
            model_name="receiptsettings",
            name="receipt_format",
            field=models.CharField(
                choices=[("A4", "A4"), ("80MM", "80MM")],
                default="80MM",
                max_length=8,
            ),
        ),
    ]

