from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0012_salereturn_salereturnline"),
    ]

    operations = [
        migrations.AddField(
            model_name="customer",
            name="address",
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
