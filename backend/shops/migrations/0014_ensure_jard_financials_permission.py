from django.db import migrations


def ensure_jard_financials_permission(apps, schema_editor):
    Permission = apps.get_model("auth", "Permission")
    ContentType = apps.get_model("contenttypes", "ContentType")
    ct = ContentType.objects.filter(app_label="shops", model="shop").first()
    if ct is None:
        return
    Permission.objects.get_or_create(
        codename="view_jard_financials",
        content_type=ct,
        defaults={
            "name": "Can view Jard buy prices, stock value, and sales totals",
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("shops", "0013_shop_jard_financials_permission"),
    ]

    operations = [
        migrations.RunPython(ensure_jard_financials_permission, migrations.RunPython.noop),
    ]
