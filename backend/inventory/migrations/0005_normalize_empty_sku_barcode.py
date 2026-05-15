from django.db import migrations


def empty_str_to_null(apps, schema_editor):
    Product = apps.get_model("inventory", "Product")
    Product.objects.filter(sku="").update(sku=None)
    Product.objects.filter(barcode="").update(barcode=None)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0004_add_search_indexes"),
    ]

    operations = [
        migrations.RunPython(empty_str_to_null, noop_reverse),
    ]
