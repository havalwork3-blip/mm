from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0013_customer_address"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="is_discontinued",
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
