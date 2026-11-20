"""
Undo the +3h shift on purchases saved while TIME_ZONE was "UTC".

The purchase form sent local Iraq wall-clock time without a timezone
(e.g. "2026-10-01T20:54:00"). With TIME_ZONE="UTC" the server stored it as
20:54 UTC = 23:54 Baghdad, i.e. 3 hours later than the real purchase, which
can push late-evening purchases onto the next calendar day.

Only rows whose occurred_at is ~3 hours after created_at are corrected — that
is the exact signature of a default ("now") date misread as UTC. Rows where the
user deliberately picked another date are left untouched. FIFO batches created
from those purchases (received_at copied from occurred_at) are shifted too.
"""

from datetime import timedelta

from django.db import migrations

SHIFT = timedelta(hours=3)
TOLERANCE = timedelta(minutes=10)


def forwards(apps, schema_editor):
    Purchase = apps.get_model("inventory", "Purchase")
    ProductBatch = apps.get_model("inventory", "ProductBatch")

    fixed = 0
    for p in Purchase.objects.all().only("id", "occurred_at", "created_at").iterator():
        if p.occurred_at is None or p.created_at is None:
            continue
        delta = p.occurred_at - p.created_at
        if abs(delta - SHIFT) > TOLERANCE:
            continue
        old = p.occurred_at
        new = old - SHIFT
        Purchase.objects.filter(pk=p.pk).update(occurred_at=new)
        ProductBatch.objects.filter(
            purchase_line__purchase_id=p.pk, received_at=old
        ).update(received_at=new)
        fixed += 1
    if fixed:
        print(f"\n    Corrected +3h timezone shift on {fixed} purchase(s).")


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0039_idempotency_record"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
