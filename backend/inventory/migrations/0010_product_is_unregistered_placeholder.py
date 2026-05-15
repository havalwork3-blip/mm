from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0009_saleline_manual_name_alter_saleline_product"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="is_unregistered_placeholder",
            field=models.BooleanField(default=False),
        ),
    ]

