from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("shops", "0011_qrlanding_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="shopsettings",
            name="background_color",
            field=models.CharField(default="#f1f5f9", max_length=7),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="dark_background_color",
            field=models.CharField(default="#0f172a", max_length=7),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="accent_color",
            field=models.CharField(default="#06b6d4", max_length=7),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="sidebar_color",
            field=models.CharField(default="#0f172a", max_length=7),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="surface_color",
            field=models.CharField(default="#ffffff", max_length=7),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="surface_color_dark",
            field=models.CharField(default="#1e293b", max_length=7),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="success_color",
            field=models.CharField(default="#16a34a", max_length=7),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="warning_color",
            field=models.CharField(default="#f59e0b", max_length=7),
        ),
        migrations.AddField(
            model_name="shopsettings",
            name="danger_color",
            field=models.CharField(default="#ef4444", max_length=7),
        ),
    ]
