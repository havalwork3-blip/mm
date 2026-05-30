from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("marketing", "0003_marketingproductcategory_marketingproductcard"),
    ]

    operations = [
        migrations.AddField(
            model_name="marketingsitecontent",
            name="brand_name",
            field=models.CharField(blank=True, default="MM IRAQ", max_length=120),
        ),
        migrations.AddField(
            model_name="marketingsitecontent",
            name="brand_logo",
            field=models.ImageField(blank=True, null=True, upload_to="marketing-brand/"),
        ),
    ]
