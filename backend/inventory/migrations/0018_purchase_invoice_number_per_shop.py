from django.db import migrations, models


def backfill_purchase_invoice_numbers(apps, schema_editor):
    Purchase = apps.get_model("inventory", "Purchase")
    for shop_id in Purchase.objects.values_list("shop_id", flat=True).distinct():
        next_num = 1
        used: set[str] = set()
        for purchase in Purchase.objects.filter(shop_id=shop_id).order_by("occurred_at", "id").iterator():
            raw = str(purchase.invoice_number or "").strip()
            if raw.isdigit():
                n = int(raw)
                key = str(n)
                if key not in used:
                    used.add(key)
                    if n >= next_num:
                        next_num = n + 1
                    continue
            while str(next_num) in used:
                next_num += 1
            purchase.invoice_number = str(next_num)
            purchase.save(update_fields=["invoice_number"])
            used.add(str(next_num))
            next_num += 1


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0017_sale_receipt_number_per_shop"),
    ]

    operations = [
        migrations.RunPython(backfill_purchase_invoice_numbers, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="purchase",
            constraint=models.UniqueConstraint(
                fields=("shop", "invoice_number"),
                condition=~models.Q(invoice_number=""),
                name="uniq_purchase_shop_invoice_number_when_set",
            ),
        ),
    ]
