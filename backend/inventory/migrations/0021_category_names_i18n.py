from django.db import migrations, models


def copy_name_to_ku(apps, schema_editor):
    Category = apps.get_model("inventory", "Category")
    for cat in Category.objects.all().only("id", "name", "name_ku"):
        if not (cat.name_ku or "").strip():
            cat.name_ku = cat.name
            cat.save(update_fields=["name_ku"])


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0020_category_image"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="name_ku",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="category",
            name="name_ar",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.AddField(
            model_name="category",
            name="name_en",
            field=models.CharField(blank=True, default="", max_length=255),
        ),
        migrations.RunPython(copy_name_to_ku, migrations.RunPython.noop),
    ]
