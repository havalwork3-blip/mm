"""Backfill sale line buy snapshots from catalog buy_price or latest purchase cost."""

from decimal import Decimal

from django.db import migrations


def backfill_sale_line_buy_prices(apps, schema_editor):
    SaleLine = apps.get_model("inventory", "SaleLine")
    PurchaseLine = apps.get_model("inventory", "PurchaseLine")

    purchase_cost: dict[int, Decimal] = {}
    for pl in (
        PurchaseLine.objects.filter(product_id__isnull=False)
        .select_related("purchase")
        .order_by("product_id", "-purchase__occurred_at", "-id")
    ):
        pid = pl.product_id
        if pid not in purchase_cost:
            purchase_cost[pid] = Decimal(str(pl.unit_cost_usd or 0))

    batch: list = []
    for ln in (
        SaleLine.objects.filter(unit_buy_price_usd=0)
        .select_related("product")
        .iterator(chunk_size=500)
    ):
        cost = Decimal("0")
        if ln.product_id:
            if ln.product_id and ln.product is not None:
                catalog = Decimal(str(ln.product.buy_price or 0))
                if catalog > 0:
                    cost = catalog
            if cost <= 0:
                cost = purchase_cost.get(ln.product_id, Decimal("0"))
        if cost > 0:
            ln.unit_buy_price_usd = cost
            batch.append(ln)
        if len(batch) >= 500:
            SaleLine.objects.bulk_update(batch, ["unit_buy_price_usd"], batch_size=500)
            batch.clear()
    if batch:
        SaleLine.objects.bulk_update(batch, ["unit_buy_price_usd"], batch_size=500)


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0031_customer_debt_payment"),
    ]

    operations = [
        migrations.RunPython(backfill_sale_line_buy_prices, migrations.RunPython.noop),
    ]
