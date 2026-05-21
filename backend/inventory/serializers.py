from __future__ import annotations

from decimal import Decimal

from django.db import IntegrityError, transaction
from django.db.models import F, Max, Sum
from django.utils import timezone
from rest_framework import serializers
from rest_framework.fields import empty

from shops.models import Currency
from shops.scoping import require_shop_id

from shops.models import Shop

from .models import (
    Category,
    Company,
    Customer,
    EmployeeDebt,
    Expense,
    ExpenseCurrency,
    Product,
    Purchase,
    PurchaseLine,
    PurchaseReturn,
    PurchaseReturnLine,
    Sale,
    SaleLine,
    SaleReturn,
    SaleReturnLine,
    Shareholder,
    ShopDayOpeningCash,
    StorefrontOrder,
    StorefrontOrderItem,
    StorefrontOrderStatus,
)


def _usd_compact(value: Decimal | str | None) -> str:
    """Format USD amount without trailing zeros (e.g. 1.0000 → 1)."""
    if value is None:
        return "0"
    d = Decimal(str(value)).quantize(Decimal("0.0001"))
    s = format(d, "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def _inventory_loss_expense_name(product_name: str) -> str:
    return f"زەرەری کۆگا — {product_name}"


def _inventory_loss_note(
    *,
    discontinued: bool,
    qty: int,
    buy_price: Decimal,
    loss_amount: Decimal,
) -> str:
    buy_s = _usd_compact(buy_price)
    loss_s = _usd_compact(loss_amount)
    if discontinued:
        return (
            f"[AUTO_DISCONTINUE_LOSS] واز لە هێنانەوە: {qty} دانە × {buy_s} USD "
            f"(کۆی گشتی {loss_s} USD)"
        )
    return (
        f"[AUTO_INVENTORY_LOSS] کەمکردنەوەی دەستی کۆگا: {qty} دانە × {buy_s} USD "
        f"(کۆی گشتی {loss_s} USD)"
    )


class PublicProductSerializer(serializers.ModelSerializer):
    """Public storefront catalog — no buy price; exposes availability for UI."""

    sell_price = serializers.SerializerMethodField(read_only=True)
    online_base_price = serializers.SerializerMethodField(read_only=True)
    online_discount_percent = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        read_only=True,
    )
    online_discount_min_quantity = serializers.IntegerField(read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)
    category_id = serializers.IntegerField(read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    is_available = serializers.SerializerMethodField(read_only=True)
    unavailable_reason = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "sell_price",
            "online_base_price",
            "online_discount_percent",
            "online_discount_min_quantity",
            "barcode",
            "image",
            "image_url",
            "category_id",
            "category_name",
            "is_available",
            "unavailable_reason",
        ]
        read_only_fields = fields

    def get_sell_price(self, obj: Product) -> str:
        from inventory.online_pricing import effective_online_unit_price

        return str(effective_online_unit_price(obj, 1))

    def get_online_base_price(self, obj: Product) -> str:
        from inventory.online_pricing import online_base_price

        return str(online_base_price(obj).quantize(Decimal("0.0001")))

    def get_is_available(self, obj: Product) -> bool:
        if obj.is_discontinued or obj.is_unregistered_placeholder:
            return False
        return int(obj.current_stock_quantity or 0) > 0

    def get_unavailable_reason(self, obj: Product) -> str | None:
        if obj.is_discontinued:
            return "discontinued"
        if obj.is_unregistered_placeholder:
            return "unavailable"
        stock = int(obj.current_stock_quantity or 0)
        if stock <= 0:
            return "out_of_stock"
        return None

    def get_image_url(self, obj: Product) -> str | None:
        if not obj.image:
            return None
        try:
            request = self.context.get("request")
            url = obj.image.url
            if request:
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return None


class StorefrontOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = StorefrontOrderItem
        fields = ["id", "product", "product_name", "quantity", "unit_price"]
        read_only_fields = ["id", "product_name", "unit_price"]


class StorefrontOrderSerializer(serializers.ModelSerializer):
    items = StorefrontOrderItemSerializer(many=True)
    delivery_zone_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = StorefrontOrder
        fields = [
            "id",
            "shop",
            "customer_name",
            "customer_phone",
            "customer_address",
            "delivery_zone_id",
            "subtotal_amount",
            "delivery_fee",
            "delivery_zone_name",
            "total_amount",
            "status",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "subtotal_amount",
            "delivery_fee",
            "delivery_zone_name",
            "total_amount",
            "status",
            "created_at",
            "updated_at",
        ]

    def validate_shop(self, shop: Shop) -> Shop:
        if not shop.is_active:
            raise serializers.ValidationError("This shop is not accepting online orders.")
        if not shop.online_storefront_enabled:
            raise serializers.ValidationError("Online ordering is not enabled for this shop.")
        return shop

    def validate(self, attrs: dict) -> dict:
        items = attrs.get("items")
        if not items:
            raise serializers.ValidationError({"items": "At least one line item is required."})
        shop = attrs.get("shop")
        if shop is not None:
            from shops.models import StorefrontDeliveryZone
            from shops.storefront_delivery_utils import resolve_delivery_zone

            zone_id = attrs.pop("delivery_zone_id", None)
            has_zones = StorefrontDeliveryZone.objects.filter(
                shop_id=shop.pk,
                is_active=True,
            ).exists()
            if has_zones and zone_id is None:
                raise serializers.ValidationError(
                    {"delivery_zone_id": "Please select a delivery area."},
                )
            zone = resolve_delivery_zone(int(shop.pk), zone_id)
            if zone_id is not None and zone is None:
                raise serializers.ValidationError(
                    {"delivery_zone_id": "Invalid delivery area."},
                )
            attrs["_delivery_zone"] = zone
        return attrs

    def create(self, validated_data: dict) -> StorefrontOrder:
        items_data: list = validated_data.pop("items")
        validated_data.pop("delivery_zone_id", None)
        delivery_zone = validated_data.pop("_delivery_zone", None)
        shop = validated_data["shop"]
        shop_id = int(shop.pk)

        with transaction.atomic():
            subtotal = Decimal("0")
            line_blocks: list[dict] = []
            for row in items_data:
                product = row["product"]
                qty = int(row["quantity"])
                if product.shop_id != shop_id:
                    raise serializers.ValidationError(
                        {"items": "Each product must belong to the selected shop."},
                    )
                if product.is_discontinued:
                    raise serializers.ValidationError(
                        {"items": f"{product.name} is no longer available."},
                    )
                if product.is_unregistered_placeholder:
                    raise serializers.ValidationError(
                        {"items": f"{product.name} is not available for online ordering."},
                    )
                if qty > int(product.current_stock_quantity or 0):
                    raise serializers.ValidationError(
                        {
                            "items": (
                                f"Insufficient stock for {product.name} "
                                f"(requested {qty}, available {product.current_stock_quantity})."
                            ),
                        },
                    )
                from inventory.online_pricing import effective_online_unit_price

                unit_price = effective_online_unit_price(product, qty)
                line_total = (unit_price * Decimal(qty)).quantize(Decimal("0.0001"))
                subtotal += line_total
                line_blocks.append(
                    {
                        "product": product,
                        "quantity": qty,
                        "unit_price": unit_price,
                    },
                )

            subtotal = subtotal.quantize(Decimal("0.0001"))

            delivery_fee = Decimal("0")
            delivery_zone_name = ""
            if delivery_zone is not None:
                from shops.storefront_settings_utils import (
                    effective_delivery_fee_usd,
                    get_or_create_storefront_settings,
                )

                settings = get_or_create_storefront_settings(shop)
                zone_fee = Decimal(delivery_zone.delivery_fee_usd or 0)
                delivery_fee = effective_delivery_fee_usd(subtotal, zone_fee, settings)
                delivery_zone_name = (delivery_zone.name or "").strip()
            grand_total = (subtotal + delivery_fee).quantize(Decimal("0.0001"))

            order = StorefrontOrder.objects.create(
                **validated_data,
                subtotal_amount=subtotal,
                delivery_zone=delivery_zone,
                delivery_zone_name=delivery_zone_name,
                delivery_fee=delivery_fee,
                total_amount=grand_total,
                status=StorefrontOrderStatus.PENDING,
            )
            for block in line_blocks:
                StorefrontOrderItem.objects.create(order=order, **block)
                Product.objects.filter(pk=block["product"].pk).update(
                    current_stock_quantity=F("current_stock_quantity") - block["quantity"],
                )

        return order


class MerchantStorefrontOrderSerializer(serializers.ModelSerializer):
    items = StorefrontOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = StorefrontOrder
        fields = [
            "id",
            "shop",
            "customer_name",
            "customer_phone",
            "customer_address",
            "subtotal_amount",
            "delivery_fee",
            "delivery_zone_name",
            "total_amount",
            "status",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "shop",
            "customer_name",
            "customer_phone",
            "customer_address",
            "subtotal_amount",
            "delivery_fee",
            "delivery_zone_name",
            "total_amount",
            "items",
            "created_at",
            "updated_at",
        ]

    def validate_status(self, value: str) -> str:
        valid = {c.value for c in StorefrontOrderStatus}
        if value not in valid:
            raise serializers.ValidationError(f"Status must be one of: {', '.join(sorted(valid))}.")
        return value

    def update(self, instance: StorefrontOrder, validated_data: dict) -> StorefrontOrder:
        new_status = validated_data.get("status", instance.status)
        old_status = instance.status
        if new_status == old_status:
            return super().update(instance, validated_data)

        with transaction.atomic():
            order = StorefrontOrder.objects.select_for_update().get(pk=instance.pk)
            if (
                old_status != StorefrontOrderStatus.CANCELLED
                and new_status == StorefrontOrderStatus.CANCELLED
            ):
                for item in order.items.select_related("product"):
                    Product.objects.filter(pk=item.product_id).update(
                        current_stock_quantity=F("current_stock_quantity") + item.quantity,
                    )
            elif (
                old_status == StorefrontOrderStatus.CANCELLED
                and new_status != StorefrontOrderStatus.CANCELLED
            ):
                for item in order.items.select_related("product"):
                    prod = item.product
                    if int(item.quantity) > int(prod.current_stock_quantity or 0):
                        raise serializers.ValidationError(
                            {
                                "status": (
                                    f"Cannot restore order: insufficient stock for {prod.name}."
                                ),
                            },
                        )
                    Product.objects.filter(pk=item.product_id).update(
                        current_stock_quantity=F("current_stock_quantity") - item.quantity,
                    )
            order.status = new_status
            order.save(update_fields=["status", "updated_at"])
        return order


class OnlineProductPricingSerializer(serializers.ModelSerializer):
    """Merchant online storefront price + discount per product."""

    category_name = serializers.CharField(source="category.name", read_only=True)
    sale_price_retail = serializers.DecimalField(
        max_digits=18,
        decimal_places=4,
        read_only=True,
    )
    image_url = serializers.SerializerMethodField(read_only=True)
    effective_price = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "category_name",
            "sale_price_retail",
            "online_sale_price",
            "online_discount_percent",
            "online_discount_min_quantity",
            "current_stock_quantity",
            "is_discontinued",
            "image_url",
            "effective_price",
        ]
        read_only_fields = [
            "id",
            "name",
            "category_name",
            "sale_price_retail",
            "current_stock_quantity",
            "is_discontinued",
            "image_url",
            "effective_price",
        ]

    def get_image_url(self, obj: Product) -> str | None:
        if not obj.image:
            return None
        try:
            request = self.context.get("request")
            url = obj.image.url
            if request:
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return None

    def get_effective_price(self, obj: Product) -> str:
        from decimal import ROUND_HALF_UP, Decimal

        from inventory.online_pricing import effective_online_unit_price

        price = effective_online_unit_price(obj, 1)
        return str(price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))

    def validate_online_discount_percent(self, value: Decimal) -> Decimal:
        pct = Decimal(value)
        if pct < 0 or pct > 100:
            raise serializers.ValidationError("Discount must be between 0 and 100.")
        return pct

    def validate_online_discount_min_quantity(self, value: int) -> int:
        qty = int(value)
        if qty < 1:
            raise serializers.ValidationError("Minimum quantity must be at least 1.")
        return qty


class OnlineProductPricingPatchSerializer(serializers.Serializer):
    items = serializers.ListField(child=serializers.DictField(), required=False)
    bulk_discount = serializers.DictField(required=False)

    def validate_bulk_discount(self, value: dict | None) -> dict | None:
        if value is None:
            return None
        pct = value.get("online_discount_percent")
        min_qty = value.get("online_discount_min_quantity", 1)
        if pct is not None:
            p = Decimal(str(pct))
            if p < 0 or p > 100:
                raise serializers.ValidationError("Discount percent must be 0–100.")
        if int(min_qty) < 1:
            raise serializers.ValidationError("Minimum quantity must be at least 1.")
        return value


class CategorySerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False, allow_null=True)
    image_url = serializers.SerializerMethodField(read_only=True)
    name = serializers.CharField(read_only=True)

    class Meta:
        model = Category
        fields = ["id", "shop", "name", "name_ku", "name_ar", "name_en", "image", "image_url"]
        read_only_fields = ["id", "shop", "name", "image_url"]

    def validate_name_ku(self, value: str) -> str:
        cleaned = (value or "").strip()
        if not cleaned:
            raise serializers.ValidationError("Kurdish name is required.")
        return cleaned

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is None and not attrs.get("name_ku"):
            raise serializers.ValidationError({"name_ku": "Kurdish name is required."})
        return attrs

    def get_image_url(self, obj: Category) -> str | None:
        if not obj.image:
            return None
        try:
            request = self.context.get("request")
            url = obj.image.url
            if request:
                return request.build_absolute_uri(url)
            return url
        except Exception:
            return None


class ProductSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(required=False, allow_null=True)
    image_url = serializers.SerializerMethodField(read_only=True)
    prices_iqd = serializers.SerializerMethodField(read_only=True)
    shop_name = serializers.CharField(source="shop.name", read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "shop",
            "shop_name",
            "name",
            "is_unregistered_placeholder",
            "is_discontinued",
            "image",
            "image_url",
            "category",
            "sku",
            "barcode",
            "buy_price",
            "sale_price_retail",
            "sale_price_wholesale",
            "current_stock_quantity",
            "low_stock_threshold",
            "prices_iqd",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "shop",
            "shop_name",
            "is_unregistered_placeholder",
            "created_at",
            "updated_at",
            "image_url",
            "prices_iqd",
        ]

    def run_validation(self, data=empty):
        """Multipart sends '' for empty price fields; DecimalField rejects that (400)."""
        if data is not empty and hasattr(data, "copy"):
            data = data.copy()
            price_keys = ("buy_price", "sale_price_retail", "sale_price_wholesale")
            if hasattr(data, "getlist"):
                for key in price_keys:
                    vals = data.getlist(key)
                    if len(vals) == 0:
                        if not self.partial:
                            data.setlist(key, ["0"])
                        continue
                    v = vals[0]
                    if v is None or (isinstance(v, str) and not str(v).strip()):
                        data.setlist(key, ["0"])
            elif isinstance(data, dict):
                for key in price_keys:
                    if key not in data:
                        if not self.partial:
                            data[key] = "0"
                        continue
                    v = data[key]
                    if v is None or (isinstance(v, str) and not str(v).strip()):
                        data[key] = "0"
        return super().run_validation(data)

    def validate(self, attrs: dict) -> dict:
        # FormData sends "" for empty optional fields; empty string is not NULL and
        # breaks UniqueConstraint(shop, sku|barcode) — only one "" per shop allowed.
        for field in ("sku", "barcode"):
            if field not in attrs:
                continue
            val = attrs[field]
            if val is not None and (not str(val).strip()):
                attrs[field] = None
        # Prevent linking a product to a category from a different shop.
        category = attrs.get("category")
        if category is not None:
            request = self.context.get("request")
            shop_id = None
            if self.instance is not None:
                shop_id = int(self.instance.shop_id)
            elif request is not None:
                shop_id = require_shop_id(request)
            if shop_id is not None and int(category.shop_id) != int(shop_id):
                raise serializers.ValidationError(
                    {"category": "Category must belong to your shop."},
                )
        return attrs

    def get_image_url(self, obj: Product) -> str | None:
        if not obj.image:
            return None
        request = self.context.get("request")
        url = obj.image.url
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_prices_iqd(self, obj: Product) -> dict[str, str] | None:
        rate = self.context.get("usd_to_iqd_rate")
        if rate is None:
            return None
        out = obj.get_prices_iqd(rate)
        return {k: format(v, "f") for k, v in out.items()}

    def create(self, validated_data: dict) -> Product:
        raw_buy_price = ""
        if hasattr(self, "initial_data") and self.initial_data is not None:
            raw_buy_price = str(self.initial_data.get("buy_price", "") or "").strip()
        # If buy price was not provided at all, mark product as not fully registered.
        if not raw_buy_price:
            validated_data["is_unregistered_placeholder"] = True
        return super().create(validated_data)

    def _record_inventory_loss_expense(
        self,
        *,
        shop_id: int,
        product_name: str,
        loss_amount: Decimal,
        note: str,
    ) -> None:
        if loss_amount <= 0:
            return
        Expense.objects.create(
            shop_id=shop_id,
            name=_inventory_loss_expense_name(product_name),
            amount=loss_amount,
            currency=ExpenseCurrency.USD,
            note=note,
            occurred_on=timezone.localdate(),
            exchange_rate_usd_to_iqd=None,
        )

    def update(self, instance: Product, validated_data: dict) -> Product:
        prev_stock = int(instance.current_stock_quantity or 0)
        was_discontinued = bool(instance.is_discontinued)
        next_discontinued = bool(validated_data.get("is_discontinued", instance.is_discontinued))
        discontinued_now = not was_discontinued and next_discontinued
        restored_from_discontinued = was_discontinued and not next_discontinued
        # Restored products must restart from zero stock by business rule.
        if restored_from_discontinued:
            validated_data["current_stock_quantity"] = 0
        # Stop-carrying: remaining stock is written off at buy price (qty × buy_price).
        elif discontinued_now and prev_stock > 0:
            validated_data["current_stock_quantity"] = 0
        # Once a placeholder product is manually edited in inventory, treat it as fully registered.
        if instance.is_unregistered_placeholder:
            validated_data["is_unregistered_placeholder"] = False
        with transaction.atomic():
            updated = super().update(instance, validated_data)
            next_stock = int(updated.current_stock_quantity or 0)
            delta = next_stock - prev_stock
            # Inventory manual stock increase should appear in purchase history.
            if delta > 0:
                rate_raw = latest_usd_to_iqd_for_shop(updated.shop_id)
                rate = Decimal(str(rate_raw)) if rate_raw is not None else Decimal("1")
                if rate <= 0:
                    rate = Decimal("1")
                purchase = Purchase.objects.create(
                    shop_id=updated.shop_id,
                    company=None,
                    occurred_at=timezone.now(),
                    exchange_rate_usd_to_iqd=rate,
                    discount_received_usd=Decimal("0"),
                    amount_paid_usd=Decimal("0"),
                    invoice_number="",
                    note=f"[AUTO_STOCK_INCREASE] Product edited in inventory (+{delta})",
                    currency=Purchase.PurchaseCurrency.USD,
                    payment_type=Purchase.PurchasePaymentType.CASH,
                )
                PurchaseLine.objects.create(
                    purchase=purchase,
                    product=updated,
                    quantity=delta,
                    unit_cost_usd=updated.buy_price,
                    damaged_quantity=0,
                )
            # Manual stock decrease / stop-carrying write-off → inventory loss (expense).
            elif delta < 0 and not restored_from_discontinued:
                loss_qty = abs(delta)
                loss_amount = (Decimal(loss_qty) * Decimal(updated.buy_price or 0)).quantize(
                    Decimal("0.0001"),
                )
                note = _inventory_loss_note(
                    discontinued=discontinued_now,
                    qty=loss_qty,
                    buy_price=Decimal(updated.buy_price or 0),
                    loss_amount=loss_amount,
                )
                self._record_inventory_loss_expense(
                    shop_id=updated.shop_id,
                    product_name=updated.name,
                    loss_amount=loss_amount,
                    note=note,
                )
        return updated


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = ["id", "shop", "name", "phone_1", "phone_2", "note"]
        read_only_fields = ["id", "shop"]


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = [
            "id",
            "shop",
            "name",
            "workplace",
            "address",
            "phone_1",
            "phone_2",
            "requires_attention",
            "note",
        ]
        read_only_fields = ["id", "shop"]


class ExpenseSerializer(serializers.ModelSerializer):
    amount_usd = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Expense
        fields = [
            "id",
            "shop",
            "name",
            "amount",
            "currency",
            "note",
            "occurred_on",
            "exchange_rate_usd_to_iqd",
            "amount_usd",
            "created_at",
        ]
        read_only_fields = ["id", "shop", "amount_usd", "created_at"]

    def get_amount_usd(self, obj: Expense) -> str:
        return format(obj.amount_usd(), "f")

    def validate(self, attrs: dict) -> dict:
        cur = attrs.get("currency", getattr(self.instance, "currency", ExpenseCurrency.USD))
        rate = attrs.get(
            "exchange_rate_usd_to_iqd",
            getattr(self.instance, "exchange_rate_usd_to_iqd", None),
        )
        if cur == ExpenseCurrency.IQD and (rate is None or rate <= 0):
            # Use the latest system USD->IQD rate automatically when the UI does not send one.
            request = self.context.get("request")
            shop_id = require_shop_id(request) if request is not None else None
            latest_rate = latest_usd_to_iqd_for_shop(shop_id) if shop_id is not None else None
            if latest_rate is None or latest_rate <= 0:
                raise serializers.ValidationError(
                    {"exchange_rate_usd_to_iqd": "No valid USD→IQD rate found. Set today's rate first."},
                )
            attrs["exchange_rate_usd_to_iqd"] = latest_rate
        if cur == ExpenseCurrency.USD:
            attrs["exchange_rate_usd_to_iqd"] = None
        return attrs


class PurchaseLineNestedSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        required=False,
        allow_null=True,
    )
    product_name = serializers.CharField(source="product.name", read_only=True)
    manual_name = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        write_only=True,
    )
    returned_quantity = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = PurchaseLine
        fields = [
            "id",
            "product",
            "manual_name",
            "product_name",
            "quantity",
            "unit_cost_usd",
            "damaged_quantity",
            "returned_quantity",
        ]
        read_only_fields = ["id", "product_name", "returned_quantity"]

    def validate(self, attrs: dict) -> dict:
        qty = int(attrs.get("quantity", 0) or 0)
        damaged = int(attrs.get("damaged_quantity", 0) or 0)
        product = attrs.get("product")
        manual_name = str(attrs.get("manual_name", "") or "").strip()
        if product is None and not manual_name:
            raise serializers.ValidationError(
                {"manual_name": "Provide a product or a manual line name."},
            )
        if product is not None and manual_name:
            raise serializers.ValidationError(
                {"manual_name": "Use either product or manual_name, not both."},
            )
        attrs["manual_name"] = manual_name
        if damaged > qty:
            raise serializers.ValidationError(
                {"damaged_quantity": "Damaged quantity cannot exceed quantity."},
            )
        return attrs

    def get_returned_quantity(self, obj: PurchaseLine) -> int:
        # Uses prefetched return_lines from PurchaseViewSet queryset when available.
        return sum(int(row.quantity) for row in obj.return_lines.all())


class PurchaseSerializer(serializers.ModelSerializer):
    lines = PurchaseLineNestedSerializer(many=True)
    company_name = serializers.SerializerMethodField()
    lines_summary = serializers.SerializerMethodField()
    lines_product_names = serializers.SerializerMethodField()
    goods_total_usd = serializers.SerializerMethodField()
    remaining_balance_usd = serializers.SerializerMethodField()
    total_units = serializers.SerializerMethodField()
    has_returns = serializers.SerializerMethodField()

    class Meta:
        model = Purchase
        fields = [
            "id",
            "shop",
            "company",
            "company_name",
            "occurred_at",
            "exchange_rate_usd_to_iqd",
            "discount_received_usd",
            "amount_paid_usd",
            "invoice_number",
            "note",
            "currency",
            "payment_type",
            "lines",
            "lines_summary",
            "lines_product_names",
            "goods_total_usd",
            "remaining_balance_usd",
            "total_units",
            "has_returns",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "shop",
            "created_at",
            "company_name",
            "lines_summary",
            "lines_product_names",
            "goods_total_usd",
            "remaining_balance_usd",
            "total_units",
        ]

    def get_company_name(self, obj: Purchase) -> str:
        return obj.company.name if obj.company_id else ""

    def get_lines_summary(self, obj: Purchase) -> str:
        lines = list(obj.lines.all())
        if not lines:
            return ""
        if len(lines) == 1:
            return lines[0].product.name
        return f"{lines[0].product.name} +{len(lines) - 1}"

    def _purchase_goods_total_usd(self, obj: Purchase) -> Decimal:
        line_sum = Decimal("0")
        for ln in obj.lines.all():
            line_sum += Decimal(ln.quantity) * Decimal(ln.unit_cost_usd)
        net = line_sum - Decimal(obj.discount_received_usd)
        if net < 0:
            net = Decimal("0")
        return net.quantize(Decimal("0.0001"))

    def get_goods_total_usd(self, obj: Purchase) -> str:
        return format(self._purchase_goods_total_usd(obj), "f")

    def get_remaining_balance_usd(self, obj: Purchase) -> str:
        net = self._purchase_goods_total_usd(obj)
        paid = Decimal(obj.amount_paid_usd)
        remaining = (net - paid).quantize(Decimal("0.0001"))
        if remaining < 0:
            remaining = Decimal("0")
        return format(remaining, "f")

    def get_lines_product_names(self, obj: Purchase) -> str:
        parts: list[str] = []
        for ln in obj.lines.all():
            name = ln.product.name if ln.product_id else ""
            if not name:
                continue
            parts.append(f"{name} ×{ln.quantity}")
        return " · ".join(parts)

    def get_total_units(self, obj: Purchase) -> int:
        return sum(int(ln.quantity) for ln in obj.lines.all())

    def get_has_returns(self, obj: Purchase) -> bool:
        return obj.returns.exists()

    def _next_invoice_number(self, shop_id: int) -> str:
        max_num = 0
        for inv in Purchase.objects.filter(shop_id=shop_id).values_list("invoice_number", flat=True):
            raw = str(inv or "").strip()
            if raw.isdigit():
                max_num = max(max_num, int(raw))
        return str(max_num + 1)

    def validate(self, attrs: dict) -> dict:
        lines = attrs.get("lines", empty)
        creating = self.instance is None
        if creating:
            if lines is empty or not lines:
                raise serializers.ValidationError({"lines": "At least one line item is required."})
        elif lines is not empty and isinstance(lines, list) and len(lines) == 0:
            raise serializers.ValidationError({"lines": "At least one line item is required."})

        if creating:
            inv = str(attrs.get("invoice_number", "") or "").strip()
        else:
            inv_src = (
                attrs["invoice_number"]
                if "invoice_number" in attrs
                else getattr(self.instance, "invoice_number", "")
            )
            inv = str(inv_src or "").strip()
        if inv != "" and not inv.isdigit():
            raise serializers.ValidationError(
                {"invoice_number": "Receipt number must contain digits only."},
            )
        if inv != "":
            shop_id = require_shop_id(self.context["request"])
            dup_qs = Purchase.objects.filter(shop_id=shop_id, invoice_number=inv)
            if self.instance is not None:
                dup_qs = dup_qs.exclude(pk=self.instance.pk)
            if dup_qs.exists():
                raise serializers.ValidationError(
                    {"invoice_number": "This receipt number already exists in your shop."},
                )

        if self.instance is not None and "[AUTO_STOCK_INCREASE]" in str(self.instance.note or ""):
            if "note" in attrs and attrs.get("note") is not None:
                new_note = str(attrs.get("note") or "")
                if "[AUTO_STOCK_INCREASE]" not in new_note:
                    raise serializers.ValidationError(
                        {"note": "Keep the [AUTO_STOCK_INCREASE] marker in this note."},
                    )

        if self.instance is not None and "company" in attrs and attrs.get("company") is not None:
            if attrs["company"].shop_id != self.instance.shop_id:
                raise serializers.ValidationError(
                    {"company": "Supplier must belong to your shop."},
                )
        return attrs

    def create(self, validated_data: dict) -> Purchase:
        lines_data: list = validated_data.pop("lines")
        request = self.context["request"]
        shop_id = validated_data.get("shop_id") or require_shop_id(request)
        validated_data["shop_id"] = shop_id

        company = validated_data.get("company")
        if company is not None and company.shop_id != shop_id:
            raise serializers.ValidationError(
                {"company": "Supplier must belong to your shop."},
            )
        manual_invoice = str(validated_data.get("invoice_number", "") or "").strip()

        for attempt in range(3):
            if not str(validated_data.get("invoice_number", "") or "").strip():
                validated_data["invoice_number"] = self._next_invoice_number(shop_id)
            try:
                with transaction.atomic():
                    purchase = Purchase.objects.create(**validated_data)
                    fallback_category = (
                        Category.objects.filter(shop_id=shop_id).order_by("id").first()
                    )
                    if fallback_category is None:
                        fallback_category = Category.objects.create(
                            shop_id=shop_id,
                            name="General",
                        )
                    for line in lines_data:
                        product = line.get("product")
                        manual_name = str(line.pop("manual_name", "") or "").strip()
                        if product is not None:
                            if product.shop_id != shop_id:
                                raise serializers.ValidationError(
                                    {"lines": "Each product must belong to your shop."},
                                )
                        elif manual_name:
                            product = (
                                Product.objects.select_for_update()
                                .filter(shop_id=shop_id, name__iexact=manual_name)
                                .first()
                            )
                            if product is None:
                                product = Product.objects.create(
                                    shop_id=shop_id,
                                    name=manual_name,
                                    is_unregistered_placeholder=True,
                                    category=fallback_category,
                                    buy_price=Decimal(str(line["unit_cost_usd"])),
                                    sale_price_retail=Decimal(str(line["unit_cost_usd"])),
                                    sale_price_wholesale=Decimal(str(line["unit_cost_usd"])),
                                    current_stock_quantity=0,
                                )
                        else:
                            raise serializers.ValidationError(
                                {"lines": "Each line must include a product or manual_name."},
                            )
                        qty = int(line["quantity"])
                        damaged = int(line.get("damaged_quantity", 0) or 0)
                        if damaged > qty:
                            raise serializers.ValidationError(
                                {
                                    "lines": (
                                        f"Damaged quantity cannot exceed quantity for {product.name}."
                                    ),
                                },
                            )
                        add_to_stock = qty - damaged
                        PurchaseLine.objects.create(
                            purchase=purchase,
                            product=product,
                            quantity=qty,
                            unit_cost_usd=line["unit_cost_usd"],
                            damaged_quantity=damaged,
                        )
                        if add_to_stock > 0:
                            Product.objects.filter(pk=product.pk).update(
                                current_stock_quantity=F("current_stock_quantity") + add_to_stock,
                            )
                return purchase
            except IntegrityError:
                if manual_invoice or attempt >= 2:
                    raise serializers.ValidationError(
                        {
                            "invoice_number": (
                                "This receipt number already exists in your shop."
                                if manual_invoice
                                else "Could not allocate purchase receipt number. Please retry."
                            ),
                        },
                    ) from None
                validated_data["invoice_number"] = ""
        raise serializers.ValidationError(
            {"detail": "Could not allocate purchase receipt number. Please retry."},
        )

    def _resolve_purchase_line_blocks_for_shop(self, shop_id: int, lines_data: list) -> list[dict]:
        """Resolve validated nested line dicts to rows with Product instances (may create placeholders)."""
        fallback_category = (
            Category.objects.filter(shop_id=shop_id).order_by("id").first()
        )
        if fallback_category is None:
            fallback_category = Category.objects.create(
                shop_id=shop_id,
                name="General",
            )
        resolved: list[dict] = []
        for raw in lines_data:
            line = dict(raw)
            product = line.get("product")
            manual_name = str(line.pop("manual_name", "") or "").strip()
            if product is not None:
                if product.shop_id != shop_id:
                    raise serializers.ValidationError(
                        {"lines": "Each product must belong to your shop."},
                    )
            elif manual_name:
                product = (
                    Product.objects.select_for_update()
                    .filter(shop_id=shop_id, name__iexact=manual_name)
                    .first()
                )
                if product is None:
                    product = Product.objects.create(
                        shop_id=shop_id,
                        name=manual_name,
                        is_unregistered_placeholder=True,
                        category=fallback_category,
                        buy_price=Decimal(str(line["unit_cost_usd"])),
                        sale_price_retail=Decimal(str(line["unit_cost_usd"])),
                        sale_price_wholesale=Decimal(str(line["unit_cost_usd"])),
                        current_stock_quantity=0,
                    )
            else:
                raise serializers.ValidationError(
                    {"lines": "Each line must include a product or manual_name."},
                )
            qty = int(line["quantity"])
            damaged = int(line.get("damaged_quantity", 0) or 0)
            if damaged > qty:
                raise serializers.ValidationError(
                    {
                        "lines": (
                            f"Damaged quantity cannot exceed quantity for {product.name}."
                        ),
                    },
                )
            resolved.append(
                {
                    "product": product,
                    "quantity": qty,
                    "unit_cost_usd": line["unit_cost_usd"],
                    "damaged_quantity": damaged,
                },
            )
        return resolved

    def update(self, instance: Purchase, validated_data: dict) -> Purchase:
        if instance.returns.exists():
            raise serializers.ValidationError(
                {
                    "non_field_errors": [
                        "Cannot edit a purchase that has supplier returns recorded.",
                    ],
                },
            )

        is_auto = "[AUTO_STOCK_INCREASE]" in str(instance.note or "")
        lines_data: list | None = validated_data.pop("lines", None)

        with transaction.atomic():
            purchase_locked = Purchase.objects.select_for_update().get(pk=instance.pk)
            old_lines = list(
                PurchaseLine.objects.select_for_update()
                .filter(purchase=purchase_locked)
                .select_related("product"),
            )
            old_effects: dict[int, int] = {}
            for ln in old_lines:
                add = int(ln.quantity) - int(ln.damaged_quantity or 0)
                if add:
                    old_effects[ln.product_id] = old_effects.get(ln.product_id, 0) + add

            resolved_lines: list[dict] | None = None
            if lines_data is not None:
                shop_id = purchase_locked.shop_id
                if is_auto:
                    resolved_lines = []
                    for block in lines_data:
                        prod = block.get("product")
                        if prod is None:
                            raise serializers.ValidationError(
                                {"lines": "Each line must include a product."},
                            )
                        if prod.shop_id != shop_id:
                            raise serializers.ValidationError(
                                {"lines": "Each product must belong to your shop."},
                            )
                        qty = int(block["quantity"])
                        damaged = int(block.get("damaged_quantity", 0) or 0)
                        if damaged > qty:
                            raise serializers.ValidationError(
                                {"lines": "Damaged quantity cannot exceed quantity."},
                            )
                        resolved_lines.append(
                            {
                                "product": prod,
                                "quantity": qty,
                                "unit_cost_usd": block["unit_cost_usd"],
                                "damaged_quantity": damaged,
                            },
                        )
                else:
                    resolved_lines = self._resolve_purchase_line_blocks_for_shop(
                        shop_id,
                        [dict(b) for b in lines_data],
                    )

            pids_to_lock: set[int] = set(old_effects)
            if resolved_lines is not None:
                for row in resolved_lines:
                    pids_to_lock.add(row["product"].pk)
            for pid in sorted(pids_to_lock):
                Product.objects.select_for_update().get(pk=pid, shop_id=purchase_locked.shop_id)

            updated = super().update(purchase_locked, validated_data)

            if resolved_lines is None:
                return updated

            shop_id = updated.shop_id
            new_effects: dict[int, int] = {}
            for row in resolved_lines:
                net = int(row["quantity"]) - int(row["damaged_quantity"] or 0)
                if net:
                    pid = row["product"].pk
                    new_effects[pid] = new_effects.get(pid, 0) + net

            all_pids = set(old_effects) | set(new_effects)
            for pid in all_pids:
                delta = new_effects.get(pid, 0) - old_effects.get(pid, 0)
                if delta == 0:
                    continue
                prod_row = Product.objects.select_for_update().get(pk=pid, shop_id=shop_id)
                if int(prod_row.current_stock_quantity) + delta < 0:
                    raise serializers.ValidationError(
                        {
                            "lines": (
                                f"Resulting stock for {prod_row.name} would be negative "
                                f"({int(prod_row.current_stock_quantity) + delta})."
                            ),
                        },
                    )
            for pid in all_pids:
                delta = new_effects.get(pid, 0) - old_effects.get(pid, 0)
                if delta:
                    Product.objects.filter(pk=pid).update(
                        current_stock_quantity=F("current_stock_quantity") + delta,
                    )

            PurchaseLine.objects.filter(purchase_id=updated.pk).delete()
            for row in resolved_lines:
                PurchaseLine.objects.create(
                    purchase=updated,
                    product=row["product"],
                    quantity=int(row["quantity"]),
                    unit_cost_usd=row["unit_cost_usd"],
                    damaged_quantity=int(row.get("damaged_quantity", 0) or 0),
                )

        return updated


class SaleLineNestedSerializer(serializers.ModelSerializer):
    unit_buy_price_usd = serializers.DecimalField(
        max_digits=18,
        decimal_places=4,
        read_only=True,
    )
    product_name = serializers.SerializerMethodField(read_only=True)
    returned_quantity = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = SaleLine
        fields = [
            "id",
            "product",
            "manual_name",
            "product_name",
            "quantity",
            "unit_price_usd",
            "unit_buy_price_usd",
            "returned_quantity",
        ]
        read_only_fields = ["id", "unit_buy_price_usd", "product_name", "returned_quantity"]

    def get_product_name(self, obj: SaleLine) -> str:
        if obj.product_id and obj.product is not None:
            return obj.product.name
        return obj.manual_name or ""

    def validate(self, attrs: dict) -> dict:
        product = attrs.get("product")
        manual_name = str(attrs.get("manual_name", "") or "").strip()
        if product is None and not manual_name:
            raise serializers.ValidationError(
                {"manual_name": "Provide a product or a manual line name."},
            )
        if product is not None and manual_name:
            raise serializers.ValidationError(
                {"manual_name": "Use either product or manual_name, not both."},
            )
        attrs["manual_name"] = manual_name
        return attrs

    def get_returned_quantity(self, obj: SaleLine) -> int:
        # Uses prefetched return_lines from SaleViewSet queryset when available.
        return sum(int(row.quantity) for row in obj.return_lines.all())


class SaleSerializer(serializers.ModelSerializer):
    lines = SaleLineNestedSerializer(many=True)
    customer_phone = serializers.SerializerMethodField(read_only=True)
    customer_name = serializers.SerializerMethodField(read_only=True)
    customer_address = serializers.SerializerMethodField(read_only=True)
    previous_debt_usd = serializers.SerializerMethodField(read_only=True)
    has_returns = serializers.SerializerMethodField(read_only=True)
    returned_total_usd = serializers.SerializerMethodField(read_only=True)
    return_lines_summary = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Sale
        fields = [
            "id",
            "shop",
            "receipt_number",
            "customer",
            "occurred_at",
            "exchange_rate_usd_to_iqd",
            "invoice_discount_usd",
            "amount_paid_iqd",
            "amount_paid_usd",
            "note",
            "customer_phone",
            "customer_name",
            "customer_address",
            "previous_debt_usd",
            "has_returns",
            "returned_total_usd",
            "return_lines_summary",
            "lines",
            "created_at",
        ]
        read_only_fields = ["id", "shop", "receipt_number", "created_at"]

    def get_customer_phone(self, obj: Sale) -> str:
        c = obj.customer
        if not c:
            return ""
        return c.phone_1 or c.phone_2 or ""

    def get_customer_name(self, obj: Sale) -> str:
        c = obj.customer
        return c.name if c else ""

    def get_customer_address(self, obj: Sale) -> str:
        c = obj.customer
        if not c:
            return ""
        return c.address or ""

    def get_previous_debt_usd(self, obj: Sale) -> str:
        c = obj.customer
        if not c:
            return format(Decimal("0"), "f")
        total = Decimal("0")
        qs = (
            Sale.objects.filter(shop_id=obj.shop_id, customer_id=c.id)
            .exclude(pk=obj.pk)
            .prefetch_related("lines__return_lines")
        )
        for sale in qs:
            line_sum = Decimal("0")
            for ln in sale.lines.all():
                returned_qty = sum(int(row.quantity) for row in ln.return_lines.all())
                net_qty = max(0, int(ln.quantity) - returned_qty)
                line_sum += Decimal(net_qty) * Decimal(ln.unit_price_usd)
            final_usd = line_sum - Decimal(sale.invoice_discount_usd)
            if final_usd < 0:
                final_usd = Decimal("0")
            rate = Decimal(sale.exchange_rate_usd_to_iqd)
            if rate <= 0:
                continue
            paid = Decimal(sale.amount_paid_usd) + (Decimal(sale.amount_paid_iqd) / rate)
            bal = final_usd - paid
            if bal > 0:
                total += bal.quantize(Decimal("0.0001"))
        return format(total.quantize(Decimal("0.0001")), "f")

    def get_has_returns(self, obj: Sale) -> bool:
        return obj.returns.exists()

    def get_returned_total_usd(self, obj: Sale) -> str:
        total = Decimal("0")
        for ret in obj.returns.all():
            for ln in ret.lines.all():
                total += (Decimal(ln.quantity) * Decimal(ln.unit_price_usd)).quantize(Decimal("0.0001"))
        return format(total.quantize(Decimal("0.0001")), "f")

    def get_return_lines_summary(self, obj: Sale) -> str:
        returned: dict[int, int] = {}
        line_map = {ln.id: ln for ln in obj.lines.all()}
        for ret in obj.returns.all():
            for rln in ret.lines.all():
                sid = int(rln.sale_line_id)
                returned[sid] = returned.get(sid, 0) + int(rln.quantity)
        parts: list[str] = []
        for sid, qty in returned.items():
            if qty <= 0:
                continue
            line = line_map.get(sid)
            if line is None:
                continue
            name = line.product.name if line.product_id and line.product is not None else (line.manual_name or "")
            if not name:
                continue
            parts.append(f"{name} ×{qty}")
        return " · ".join(parts)

    def _validate_discount_against_lines(
        self,
        lines_data: list,
        discount: Decimal,
    ) -> None:
        if discount < 0:
            raise serializers.ValidationError(
                {"invoice_discount_usd": "Discount cannot be negative."},
            )
        subtotal = Decimal("0")
        for line in lines_data:
            subtotal += Decimal(line["quantity"]) * Decimal(str(line["unit_price_usd"]))
        if discount > subtotal:
            raise serializers.ValidationError(
                {"invoice_discount_usd": "Discount cannot exceed line subtotal."},
            )

    def _write_sale_lines(self, sale: Sale, shop_id: int, lines_data: list) -> None:
        fallback_category = (
            Category.objects.filter(shop_id=shop_id).order_by("id").first()
        )
        if fallback_category is None:
            fallback_category = Category.objects.create(
                shop_id=shop_id,
                name="General",
            )
        for line in lines_data:
            qty = line["quantity"]
            product = line.get("product")
            manual_name = str(line.get("manual_name", "") or "").strip()
            buy_snap = Decimal("0")
            if product is not None:
                if product.shop_id != shop_id:
                    raise serializers.ValidationError(
                        {"lines": "Each product must belong to your shop."},
                    )
                prod = (
                    Product.objects.select_for_update()
                    .filter(pk=product.pk, shop_id=shop_id)
                    .first()
                )
                if prod is None:
                    raise serializers.ValidationError(
                        {"lines": f"Product not found: {product.name}."},
                    )
                buy_snap = prod.buy_price
            elif not manual_name:
                raise serializers.ValidationError(
                    {"lines": "Each line must include a product or manual_name."},
                )
            else:
                existing_manual_product = (
                    Product.objects.select_for_update()
                    .filter(shop_id=shop_id, name__iexact=manual_name)
                    .first()
                )
                if existing_manual_product is None:
                    existing_manual_product = Product.objects.create(
                        shop_id=shop_id,
                        name=manual_name,
                        is_unregistered_placeholder=True,
                        category=fallback_category,
                        buy_price=Decimal("0"),
                        sale_price_retail=Decimal(str(line["unit_price_usd"])),
                        sale_price_wholesale=Decimal(str(line["unit_price_usd"])),
                        current_stock_quantity=0,
                    )
                product = existing_manual_product
                manual_name = ""
                buy_snap = product.buy_price
            SaleLine.objects.create(
                sale=sale,
                product=product,
                manual_name=manual_name,
                quantity=qty,
                unit_price_usd=line["unit_price_usd"],
                unit_buy_price_usd=buy_snap,
            )
            if product is not None:
                Product.objects.filter(pk=product.pk).update(
                    current_stock_quantity=F("current_stock_quantity") - qty,
                )

    def _next_receipt_number(self, shop_id: int) -> int:
        latest = (
            Sale.objects.filter(shop_id=shop_id).aggregate(max_receipt=Max("receipt_number"))["max_receipt"]
            or 0
        )
        return int(latest) + 1

    def create(self, validated_data: dict) -> Sale:
        lines_data: list = validated_data.pop("lines")
        request = self.context["request"]
        shop_id = validated_data.get("shop_id") or require_shop_id(request)
        validated_data["shop_id"] = shop_id
        customer = validated_data.get("customer")
        if customer is not None and customer.shop_id != shop_id:
            raise serializers.ValidationError({"customer": "Customer must belong to your shop."})

        discount = validated_data.get("invoice_discount_usd") or Decimal("0")
        self._validate_discount_against_lines(lines_data, discount)

        for _ in range(3):
            try:
                with transaction.atomic():
                    validated_data["receipt_number"] = self._next_receipt_number(shop_id)
                    sale = Sale.objects.create(**validated_data)
                    self._write_sale_lines(sale, shop_id, lines_data)
                return sale
            except IntegrityError:
                continue
        raise serializers.ValidationError({"detail": "Could not allocate receipt number. Please retry."})

    def update(self, instance: Sale, validated_data: dict) -> Sale:
        if instance.returns.exists():
            raise serializers.ValidationError(
                {
                    "detail": (
                        "Cannot edit a sale that has product returns recorded; "
                        "reverse returns first or adjust stock separately."
                    ),
                },
            )
        lines_data = validated_data.pop("lines", None)
        validated_data.pop("shop", None)

        if lines_data is None:
            allowed_heads = frozenset(
                {"occurred_at", "amount_paid_usd", "amount_paid_iqd", "note"},
            )
            if not validated_data:
                raise serializers.ValidationError({"detail": "No fields to update."})
            extra = set(validated_data.keys()) - allowed_heads
            if extra:
                raise serializers.ValidationError(
                    {
                        "detail": (
                            "Updating a sale without `lines` only allows: "
                            f"{sorted(allowed_heads)}. Unexpected: {sorted(extra)}"
                        ),
                    },
                )

            shop_id = int(instance.shop_id)
            with transaction.atomic():
                locked = (
                    Sale.objects.select_for_update()
                    .filter(pk=instance.pk, shop_id=shop_id)
                    .first()
                )
                if locked is None:
                    raise serializers.ValidationError({"detail": "Sale not found for this shop."})
                if locked.returns.exists():
                    raise serializers.ValidationError(
                        {
                            "detail": "Cannot edit a sale that has product returns recorded.",
                        },
                    )
                for pay_key in ("amount_paid_usd", "amount_paid_iqd"):
                    if pay_key in validated_data and validated_data[pay_key] < 0:
                        raise serializers.ValidationError(
                            {pay_key: "Payment amount cannot be negative."},
                        )
                for attr, value in validated_data.items():
                    setattr(locked, attr, value)
                locked.save()
            return locked

        shop_id = int(instance.shop_id)

        customer = validated_data.get("customer", empty)
        if customer is not empty and customer is not None and customer.shop_id != shop_id:
            raise serializers.ValidationError({"customer": "Customer must belong to your shop."})

        discount = validated_data.get("invoice_discount_usd") or Decimal("0")
        self._validate_discount_against_lines(lines_data, discount)

        with transaction.atomic():
            locked = (
                Sale.objects.select_for_update()
                .filter(pk=instance.pk, shop_id=shop_id)
                .first()
            )
            if locked is None:
                raise serializers.ValidationError({"detail": "Sale not found for this shop."})
            if locked.returns.exists():
                raise serializers.ValidationError(
                    {"detail": "Cannot edit a sale that has product returns recorded."},
                )

            old_lines = list(
                SaleLine.objects.filter(sale_id=locked.pk).select_related("product"),
            )
            for ol in old_lines:
                if ol.product_id:
                    Product.objects.filter(pk=ol.product_id).update(
                        current_stock_quantity=F("current_stock_quantity") + ol.quantity,
                    )
            SaleLine.objects.filter(sale_id=locked.pk).delete()

            for attr, value in validated_data.items():
                setattr(locked, attr, value)
            locked.save()
            self._write_sale_lines(locked, shop_id, lines_data)

        return locked


class ShareholderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Shareholder
        fields = ["id", "shop", "name", "share_percentage", "capital_contribution_usd"]
        read_only_fields = ["id", "shop"]


class EmployeeDebtSerializer(serializers.ModelSerializer):
    employee_email = serializers.EmailField(source="employee.email", read_only=True)

    class Meta:
        model = EmployeeDebt
        fields = [
            "id",
            "shop",
            "employee",
            "employee_email",
            "amount",
            "debt_type",
            "occurred_on",
            "note",
            "created_at",
        ]
        read_only_fields = ["id", "shop", "employee_email", "created_at"]

    def validate_employee(self, value):
        request = self.context["request"]
        shop_id = require_shop_id(request)
        if value.shop_id != shop_id:
            raise serializers.ValidationError("Employee must belong to your shop.")
        return value


class ShopDayOpeningCashSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopDayOpeningCash
        fields = ["id", "shop", "for_date", "opening_cash_usd"]
        read_only_fields = ["id", "shop"]


def latest_usd_to_iqd_for_shop(shop_id: int) -> Decimal | None:
    row = (
        Currency.objects.filter(shop_id=shop_id)
        .order_by("-date", "-id")
        .values_list("usd_to_iqd", flat=True)
        .first()
    )
    return row


class SaleReturnLineInputSerializer(serializers.Serializer):
    sale_line_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class SaleReturnCreateSerializer(serializers.Serializer):
    sale_id = serializers.IntegerField(min_value=1)
    note = serializers.CharField(required=False, allow_blank=True, default="")
    lines = SaleReturnLineInputSerializer(many=True)

    def validate(self, attrs: dict) -> dict:
        if not attrs.get("lines"):
            raise serializers.ValidationError({"lines": "At least one return line is required."})
        return attrs

    def create(self, validated_data: dict) -> dict:
        request = self.context["request"]
        shop_id = require_shop_id(request)
        sale_id = int(validated_data["sale_id"])
        note = str(validated_data.get("note", "") or "").strip()
        lines_data = validated_data["lines"]

        sale = (
            Sale.objects.filter(pk=sale_id, shop_id=shop_id)
            .select_related("customer")
            .first()
        )
        if sale is None:
            raise serializers.ValidationError({"sale_id": "Sale not found for this shop."})

        sale_lines_map: dict[int, SaleLine] = {
            ln.id: ln
            for ln in SaleLine.objects.filter(sale_id=sale.id).select_related("product")
        }
        if not sale_lines_map:
            raise serializers.ValidationError({"sale_id": "Sale has no lines."})

        # Count previously returned quantity per sale line.
        already_returned: dict[int, int] = {}
        for row in (
            SaleReturnLine.objects.filter(sale_line_id__in=sale_lines_map.keys())
            .values("sale_line_id")
            .annotate(total=Sum("quantity"))
        ):
            line_id = int(row["sale_line_id"])
            total = int(row.get("total") or 0)
            already_returned[line_id] = total

        requested_by_line: dict[int, int] = {}
        for ln in lines_data:
            line_id = int(ln["sale_line_id"])
            qty = int(ln["quantity"])
            if line_id not in sale_lines_map:
                raise serializers.ValidationError(
                    {"lines": f"sale_line_id {line_id} does not belong to this sale."},
                )
            requested_by_line[line_id] = requested_by_line.get(line_id, 0) + qty

        for line_id, req_qty in requested_by_line.items():
            original_qty = int(sale_lines_map[line_id].quantity)
            prev_qty = int(already_returned.get(line_id, 0))
            if prev_qty + req_qty > original_qty:
                raise serializers.ValidationError(
                    {
                        "lines": (
                            f"Return quantity exceeds sold quantity for line {line_id} "
                            f"(sold={original_qty}, already_returned={prev_qty})."
                        ),
                    },
                )

        with transaction.atomic():
            sale_return = SaleReturn.objects.create(
                shop_id=shop_id,
                sale=sale,
                customer=sale.customer,
                note=note,
            )
            total_refund = Decimal("0")
            for line_id, req_qty in requested_by_line.items():
                src_line = sale_lines_map[line_id]
                unit_price = Decimal(src_line.unit_price_usd)
                SaleReturnLine.objects.create(
                    sale_return=sale_return,
                    sale_line=src_line,
                    product=src_line.product,
                    quantity=req_qty,
                    unit_price_usd=unit_price,
                )
                if src_line.product_id:
                    Product.objects.filter(pk=src_line.product_id).update(
                        current_stock_quantity=F("current_stock_quantity") + req_qty,
                    )
                total_refund += (Decimal(req_qty) * unit_price).quantize(Decimal("0.0001"))

        return {
            "id": sale_return.id,
            "sale_id": sale.id,
            "occurred_at": sale_return.occurred_at.isoformat(),
            "total_refund_usd": format(total_refund.quantize(Decimal("0.0001")), "f"),
            "lines_count": len(requested_by_line),
        }


class PurchaseReturnLineInputSerializer(serializers.Serializer):
    purchase_line_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class PurchaseReturnCreateSerializer(serializers.Serializer):
    purchase_id = serializers.IntegerField(min_value=1)
    note = serializers.CharField(required=False, allow_blank=True, default="")
    lines = PurchaseReturnLineInputSerializer(many=True)

    def validate(self, attrs: dict) -> dict:
        if not attrs.get("lines"):
            raise serializers.ValidationError({"lines": "At least one return line is required."})
        return attrs

    def create(self, validated_data: dict) -> dict:
        request = self.context["request"]
        shop_id = require_shop_id(request)
        purchase_id = int(validated_data["purchase_id"])
        note = str(validated_data.get("note", "") or "").strip()
        lines_data = validated_data["lines"]

        purchase = (
            Purchase.objects.filter(pk=purchase_id, shop_id=shop_id)
            .select_related("company")
            .first()
        )
        if purchase is None:
            raise serializers.ValidationError({"purchase_id": "Purchase not found for this shop."})

        purchase_lines_map: dict[int, PurchaseLine] = {
            ln.id: ln
            for ln in PurchaseLine.objects.filter(purchase_id=purchase.id).select_related("product")
        }
        if not purchase_lines_map:
            raise serializers.ValidationError({"purchase_id": "Purchase has no lines."})

        already_returned: dict[int, int] = {}
        for row in (
            PurchaseReturnLine.objects.filter(purchase_line_id__in=purchase_lines_map.keys())
            .values("purchase_line_id")
            .annotate(total=Sum("quantity"))
        ):
            line_id = int(row["purchase_line_id"])
            total = int(row.get("total") or 0)
            already_returned[line_id] = total

        requested_by_line: dict[int, int] = {}
        for ln in lines_data:
            line_id = int(ln["purchase_line_id"])
            qty = int(ln["quantity"])
            if line_id not in purchase_lines_map:
                raise serializers.ValidationError(
                    {"lines": f"purchase_line_id {line_id} does not belong to this purchase."},
                )
            requested_by_line[line_id] = requested_by_line.get(line_id, 0) + qty

        for line_id, req_qty in requested_by_line.items():
            original_qty = int(purchase_lines_map[line_id].quantity)
            prev_qty = int(already_returned.get(line_id, 0))
            if prev_qty + req_qty > original_qty:
                raise serializers.ValidationError(
                    {
                        "lines": (
                            f"Return quantity exceeds purchased quantity for line {line_id} "
                            f"(purchased={original_qty}, already_returned={prev_qty})."
                        ),
                    },
                )

        with transaction.atomic():
            purchase_return = PurchaseReturn.objects.create(
                shop_id=shop_id,
                purchase=purchase,
                company=purchase.company,
                note=note,
            )
            total_return = Decimal("0")
            for line_id, req_qty in requested_by_line.items():
                src_line = purchase_lines_map[line_id]
                unit_cost = Decimal(src_line.unit_cost_usd)
                PurchaseReturnLine.objects.create(
                    purchase_return=purchase_return,
                    purchase_line=src_line,
                    product=src_line.product,
                    quantity=req_qty,
                    unit_cost_usd=unit_cost,
                )
                if src_line.product_id:
                    Product.objects.filter(pk=src_line.product_id).update(
                        current_stock_quantity=F("current_stock_quantity") - req_qty,
                    )
                total_return += (Decimal(req_qty) * unit_cost).quantize(Decimal("0.0001"))

        return {
            "id": purchase_return.id,
            "purchase_id": purchase.id,
            "occurred_at": purchase_return.occurred_at.isoformat(),
            "total_return_usd": format(total_return.quantize(Decimal("0.0001")), "f"),
            "lines_count": len(requested_by_line),
        }
