from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0023_storefront_order_delivery"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="online_description",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Extra product info shown on the public online storefront.",
            ),
        ),
        migrations.CreateModel(
            name="StorefrontProductGalleryImage",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("image", models.ImageField(upload_to="storefront-gallery/%Y/%m/")),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "product",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="storefront_gallery_images",
                        to="inventory.product",
                    ),
                ),
            ],
            options={
                "ordering": ["sort_order", "id"],
            },
        ),
    ]
