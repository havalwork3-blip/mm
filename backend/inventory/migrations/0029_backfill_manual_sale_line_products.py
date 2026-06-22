"""Link legacy sale lines (manual_name only) to inventory products."""

from decimal import Decimal

from django.db import migrations


def backfill_manual_sale_line_products(apps, schema_editor):
    SaleLine = apps.get_model("inventory", "SaleLine")
    Product = apps.get_model("inventory", "Product")
    Category = apps.get_model("inventory", "Category")

    orphan_lines = (
        SaleLine.objects.filter(product_id__isnull=True)
        .exclude(manual_name="")
        .select_related("sale")
    )
    for line in orphan_lines.iterator():
        name = str(line.manual_name or "").strip()
        if not name:
            continue
        shop_id = int(line.sale.shop_id)
        product = Product.objects.filter(shop_id=shop_id, name__iexact=name).first()
        if product is None:
            category = Category.objects.filter(shop_id=shop_id).order_by("id").first()
            if category is None:
                category = Category.objects.create(shop_id=shop_id, name="General")
            unit_price = Decimal(str(line.unit_price_usd))
            product = Product.objects.create(
                shop_id=shop_id,
                name=name,
                is_unregistered_placeholder=True,
                category_id=category.id,
                buy_price=Decimal("0"),
                sale_price_retail=unit_price,
                sale_price_wholesale=unit_price,
                current_stock_quantity=0,
            )
        line.product_id = product.id
        line.manual_name = ""
        line.save(update_fields=["product_id", "manual_name"])


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0028_alter_category_options_and_more"),
    ]

    operations = [
        migrations.RunPython(
            backfill_manual_sale_line_products,
            migrations.RunPython.noop,
        ),
    ]
