from django.db import migrations, models


def backfill_sale_receipt_numbers(apps, schema_editor):
    Sale = apps.get_model("inventory", "Sale")
    for shop_id in Sale.objects.values_list("shop_id", flat=True).distinct():
        next_receipt = 1
        for sale in Sale.objects.filter(shop_id=shop_id).order_by("occurred_at", "id").iterator():
            sale.receipt_number = next_receipt
            sale.save(update_fields=["receipt_number"])
            next_receipt += 1


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0016_shareholder_capital_contribution_usd"),
    ]

    operations = [
        migrations.AddField(
            model_name="sale",
            name="receipt_number",
            field=models.PositiveIntegerField(default=1, db_index=True),
            preserve_default=False,
        ),
        migrations.RunPython(backfill_sale_receipt_numbers, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="sale",
            constraint=models.UniqueConstraint(
                fields=("shop", "receipt_number"),
                name="uniq_sale_shop_receipt_number",
            ),
        ),
    ]
