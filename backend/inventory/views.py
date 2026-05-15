from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.models import User

from shops.scoping import get_shop_id_for_request, require_shop_id

from .dashboard_tools import (
    apply_customer_debt_payment_fifo,
    apply_supplier_debt_payment_fifo,
    company_outstanding_usd,
    customer_outstanding_balance_usd,
    employee_debt_by_user,
    suppliers_purchase_archive,
)
from .models import (
    Category,
    Company,
    Customer,
    EmployeeDebt,
    Expense,
    Product,
    Purchase,
    PurchaseLine,
    PurchaseReturn,
    PurchaseReturnLine,
    Sale,
    SaleLine,
    SaleReturnLine,
    Shareholder,
)
from .permissions import (
    IsShopOwnerOrCanPaySupplierDebt,
    IsShopOwnerOrCanRecordSalePayment,
    IsShopOwnerOrDjangoModelPermission,
    IsShopOwnerOrDjangoModelPermissionOrPosCustomerCreate,
    IsShopOwnerOrDjangoModelPermissionOrPosProductRead,
    IsShopOwnerOrPermission,
)
from .serializers import (
    CategorySerializer,
    CompanySerializer,
    CustomerSerializer,
    EmployeeDebtSerializer,
    ExpenseSerializer,
    ProductSerializer,
    PurchaseSerializer,
    PurchaseReturnCreateSerializer,
    SaleSerializer,
    SaleReturnCreateSerializer,
    ShareholderSerializer,
    latest_usd_to_iqd_for_shop,
)


class ShopScopedViewSet(viewsets.ModelViewSet):
    """All list/detail/create/update operations are limited to the active shop."""

    permission_classes = [IsAuthenticated, IsShopOwnerOrDjangoModelPermission]

    def get_queryset(self):
        qs = super().get_queryset()
        shop_id = get_shop_id_for_request(self.request)
        if shop_id is not None:
            return qs.filter(shop_id=shop_id)
        # Superusers must explicitly select a shop to avoid accidental cross-shop mixing.
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(shop_id=require_shop_id(self.request))


class OwnerScopedViewSet(ShopScopedViewSet):
    """Same scoping as ShopScopedViewSet; expense/debt views override codenames."""


class ProductPagination(PageNumberPagination):
    page_size = 24
    page_size_query_param = "page_size"
    max_page_size = 200


class CategoryViewSet(ShopScopedViewSet):
    queryset = Category.objects.select_related("shop").all()
    serializer_class = CategorySerializer


class ProductViewSet(ShopScopedViewSet):
    permission_classes = [IsAuthenticated, IsShopOwnerOrDjangoModelPermissionOrPosProductRead]
    queryset = Product.objects.select_related("category", "shop").all()
    serializer_class = ProductSerializer
    pagination_class = ProductPagination
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "sku", "barcode"]

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        for key in ("exclude_discontinued", "for_sale"):
            v = p.get(key)
            if v in ("1", "true", "True", "yes", "on"):
                return qs.filter(is_discontinued=False)
        return qs

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        shop_id = get_shop_id_for_request(self.request)
        if shop_id is None:
            return ctx
        rate = latest_usd_to_iqd_for_shop(shop_id)
        if rate is not None:
            ctx["usd_to_iqd_rate"] = rate
        return ctx

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        if hasattr(serializer, "fields") and "category" in serializer.fields:
            shop_id = get_shop_id_for_request(self.request)
            if shop_id is not None:
                serializer.fields["category"].queryset = Category.objects.filter(shop_id=shop_id)
            else:
                serializer.fields["category"].queryset = Category.objects.none()
        return serializer


class CompanyViewSet(OwnerScopedViewSet):
    queryset = Company.objects.select_related("shop").all()
    serializer_class = CompanySerializer


class CustomerViewSet(ShopScopedViewSet):
    permission_classes = [IsAuthenticated, IsShopOwnerOrDjangoModelPermissionOrPosCustomerCreate]
    queryset = Customer.objects.select_related("shop").all()
    serializer_class = CustomerSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "phone_1", "workplace", "address"]
    lookup_value_regex = r"[0-9]+"

    def get_queryset(self):
        return super().get_queryset()

    @action(detail=True, methods=["get"], url_path="balance")
    def balance(self, request, pk=None):
        """Outstanding debt for this customer (sum of unpaid portions of past sales)."""
        customer = self.get_object()
        bal = customer_outstanding_balance_usd(require_shop_id(request), customer.id)
        return Response({"outstanding_balance_usd": format(bal, "f")})

    @action(detail=False, methods=["get"], url_path="debt-summary")
    def debt_summary(self, request):
        """Customers with unpaid sale balances (for sidebar report)."""
        shop_id = require_shop_id(request)
        qs = self.get_queryset().filter(shop_id=shop_id).order_by("name")
        if not qs.exists():
            return Response(
                {
                    "results": [],
                    "total_outstanding_usd": format(Decimal("0"), "f"),
                    "total_outstanding_iqd": None,
                    "exchange_rate_usd_to_iqd": None,
                },
            )

        rate_raw = latest_usd_to_iqd_for_shop(shop_id)
        rate_dec = Decimal(str(rate_raw)) if rate_raw is not None else None
        if rate_dec is not None and rate_dec <= 0:
            rate_dec = None

        rows_raw: list[dict] = []
        for c in qs:
            bal = customer_outstanding_balance_usd(shop_id, c.id)
            if bal > 0:
                iqd_str: str | None = None
                if rate_dec is not None:
                    iqd_str = format((bal * rate_dec).quantize(Decimal("1")), "f")
                rows_raw.append(
                    {
                        "id": c.id,
                        "name": c.name,
                        "address": c.address or "",
                        "phone_1": c.phone_1 or "",
                        "phone_2": c.phone_2 or "",
                        "outstanding_balance_usd": format(bal, "f"),
                        "outstanding_balance_iqd": iqd_str,
                    },
                )
        rows_raw.sort(
            key=lambda r: Decimal(r["outstanding_balance_usd"]),
            reverse=True,
        )
        total = sum(
            (Decimal(r["outstanding_balance_usd"]) for r in rows_raw),
            Decimal("0"),
        )
        total_iqd: str | None = None
        if rate_dec is not None:
            total_iqd = format((total * rate_dec).quantize(Decimal("1")), "f")
        return Response(
            {
                "results": rows_raw,
                "total_outstanding_usd": format(total.quantize(Decimal("0.0001")), "f"),
                "total_outstanding_iqd": total_iqd,
                "exchange_rate_usd_to_iqd": format(rate_dec, "f") if rate_dec else None,
            },
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="collect-payment",
        permission_classes=[IsAuthenticated, IsShopOwnerOrCanRecordSalePayment],
    )
    def collect_payment(self, request, pk=None):
        """Apply a payment (USD and/or IQD at latest shop rate) toward unpaid sales, oldest first."""
        customer = self.get_object()
        shop_id = require_shop_id(request)

        def _parse_dec(val) -> Decimal:
            if val is None:
                return Decimal("0")
            s = str(val).strip().replace(",", "").replace("،", "")
            if not s:
                return Decimal("0")
            return Decimal(s)

        try:
            usd = _parse_dec(request.data.get("amount_paid_usd"))
            iqd = _parse_dec(request.data.get("amount_paid_iqd"))
        except Exception:
            return Response({"detail": "Invalid amount."}, status=400)

        if usd < 0 or iqd < 0:
            return Response({"detail": "Amounts cannot be negative."}, status=400)

        rate_raw = latest_usd_to_iqd_for_shop(shop_id)
        if rate_raw is None:
            return Response(
                {"detail": "Set today’s exchange rate (inventory) before recording payment."},
                status=400,
            )
        rate = Decimal(str(rate_raw))
        if rate <= 0:
            return Response(
                {"detail": "Exchange rate must be positive."},
                status=400,
            )

        paid_eq = (usd + (iqd / rate)).quantize(Decimal("0.0001"))
        if paid_eq <= 0:
            return Response({"detail": "Enter a payment amount."}, status=400)

        applied, overpaid = apply_customer_debt_payment_fifo(
            shop_id,
            customer.id,
            paid_eq,
        )
        new_bal = customer_outstanding_balance_usd(shop_id, customer.id)
        return Response(
            {
                "applied_usd_eq": format(applied, "f"),
                "overpaid_usd_eq": format(overpaid, "f"),
                "outstanding_balance_usd_after": format(new_bal, "f"),
            },
        )


class ExpenseViewSet(OwnerScopedViewSet):
    queryset = Expense.objects.select_related("shop").all()
    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {
        "GET": ("view_expense",),
        "POST": ("add_expense",),
        "PUT": ("change_expense",),
        "PATCH": ("change_expense",),
        "DELETE": ("delete_expense",),
    }

    def get_queryset(self):
        qs = super().get_queryset()
        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()
        if date_from:
            qs = qs.filter(occurred_on__gte=date_from)
        if date_to:
            qs = qs.filter(occurred_on__lte=date_to)
        return qs.order_by("-occurred_on", "-id")


class PurchaseViewSet(OwnerScopedViewSet):
    queryset = (
        Purchase.objects.select_related("company", "shop")
        .prefetch_related(
            Prefetch(
                "lines",
                queryset=PurchaseLine.objects.select_related(
                    "product",
                    "product__shop",
                    "product__category",
                ).prefetch_related("return_lines"),
            ),
            "returns__lines__purchase_line",
        )
        .all()
    )
    serializer_class = PurchaseSerializer
    http_method_names = ["get", "post", "patch", "head", "options"]
    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {
        "GET": ("view_purchase",),
        "POST": ("add_purchase",),
        # Correcting auto-generated inventory stock-increase rows (same idea as fixing stock).
        "PATCH": ("change_purchase", "change_product"),
    }

    def get_queryset(self):
        qs = super().get_queryset()
        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()
        if date_from:
            qs = qs.filter(occurred_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(occurred_at__date__lte=date_to)

        raw_company = (self.request.query_params.get("company") or "").strip()
        if raw_company:
            try:
                cid = int(raw_company)
            except (TypeError, ValueError):
                return qs.none()
            shop_id = get_shop_id_for_request(self.request)
            if shop_id is not None and not Company.objects.filter(pk=cid, shop_id=shop_id).exists():
                return qs.none()
            qs = qs.filter(company_id=cid)

        company_name = (self.request.query_params.get("company_name") or "").strip()
        if company_name:
            qs = qs.filter(company__name__icontains=company_name)

        invoice = (self.request.query_params.get("invoice") or "").strip()
        if invoice:
            qs = qs.filter(invoice_number__icontains=invoice)

        product_name = (self.request.query_params.get("product_name") or "").strip()
        if product_name:
            qs = qs.filter(lines__product__name__icontains=product_name).distinct()

        return qs.order_by("-occurred_at", "-id")

    @action(detail=False, methods=["get"], url_path="company-outstanding")
    def company_outstanding(self, request):
        """Outstanding USD owed to a supplier before recording a new purchase."""
        shop_id = require_shop_id(request)
        raw = request.query_params.get("company_id")
        if raw is None or str(raw).strip() == "":
            return Response({"outstanding_usd": format(Decimal("0"), "f")})
        try:
            cid = int(raw)
        except (TypeError, ValueError) as exc:
            raise ValidationError({"company_id": "Invalid company id."}) from exc
        bal = company_outstanding_usd(shop_id, cid)
        return Response({"outstanding_usd": format(bal, "f")})

    @action(detail=False, methods=["get"], url_path="supplier-archive")
    def supplier_archive(self, request):
        """Archive: all suppliers the shop has purchased from, with totals."""
        shop_id = require_shop_id(request)
        return Response(suppliers_purchase_archive(shop_id))

    @action(
        detail=False,
        methods=["post"],
        url_path="pay-supplier",
        permission_classes=[IsAuthenticated, IsShopOwnerOrCanPaySupplierDebt],
    )
    def pay_supplier(self, request):
        """Apply USD/IQD (at latest shop rate) toward unpaid purchases for one supplier, oldest first."""
        shop_id = require_shop_id(request)

        def _parse_dec(val) -> Decimal:
            if val is None:
                return Decimal("0")
            s = str(val).strip().replace(",", "").replace("،", "")
            if not s:
                return Decimal("0")
            return Decimal(s)

        raw_cid = request.data.get("company_id")
        try:
            cid = int(raw_cid)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid company_id."}, status=400)

        if not Company.objects.filter(pk=cid, shop_id=shop_id).exists():
            return Response({"detail": "Supplier not found for this shop."}, status=400)

        try:
            usd = _parse_dec(request.data.get("amount_paid_usd"))
            iqd = _parse_dec(request.data.get("amount_paid_iqd"))
        except Exception:
            return Response({"detail": "Invalid amount."}, status=400)

        if usd < 0 or iqd < 0:
            return Response({"detail": "Amounts cannot be negative."}, status=400)

        rate_raw = latest_usd_to_iqd_for_shop(shop_id)
        if rate_raw is None:
            return Response(
                {"detail": "Set today’s exchange rate (inventory) before recording payment."},
                status=400,
            )
        rate = Decimal(str(rate_raw))
        if rate <= 0:
            return Response({"detail": "Exchange rate must be positive."}, status=400)

        paid_eq = (usd + (iqd / rate)).quantize(Decimal("0.0001"))
        if paid_eq <= 0:
            return Response({"detail": "Enter a payment amount."}, status=400)

        applied, overpaid = apply_supplier_debt_payment_fifo(shop_id, cid, paid_eq)
        new_bal = company_outstanding_usd(shop_id, cid)
        return Response(
            {
                "applied_usd_eq": format(applied, "f"),
                "overpaid_usd_eq": format(overpaid, "f"),
                "outstanding_usd_after": format(new_bal, "f"),
            },
        )

    @action(detail=False, methods=["post"], url_path="return-products")
    def return_products(self, request):
        """Return purchased products back to supplier and decrease stock."""
        ser = PurchaseReturnCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        out = ser.save()
        return Response(out, status=201)

    @action(detail=False, methods=["get"], url_path="returns-history")
    def returns_history(self, request):
        """Flat list of purchase-return lines for history/filter UIs."""
        shop_id = require_shop_id(request)
        rows = (
            PurchaseReturnLine.objects.filter(purchase_return__shop_id=shop_id)
            .select_related(
                "purchase_return",
                "purchase_return__company",
                "purchase_return__purchase",
                "purchase_line",
                "purchase_line__product",
            )
            .order_by("-purchase_return__occurred_at", "-id")
        )

        company_name = (request.query_params.get("company_name") or "").strip()
        invoice = (request.query_params.get("invoice") or "").strip()
        product_name = (request.query_params.get("product_name") or "").strip()
        date_from = (request.query_params.get("date_from") or "").strip()
        date_to = (request.query_params.get("date_to") or "").strip()

        if company_name:
            rows = rows.filter(purchase_return__company__name__icontains=company_name)
        if invoice:
            rows = rows.filter(purchase_return__purchase__invoice_number__icontains=invoice)
        if product_name:
            rows = rows.filter(purchase_line__product__name__icontains=product_name)
        if date_from:
            rows = rows.filter(purchase_return__occurred_at__date__gte=date_from)
        if date_to:
            rows = rows.filter(purchase_return__occurred_at__date__lte=date_to)

        out: list[dict] = []
        for row in rows:
            product_name_out = row.purchase_line.product.name if row.purchase_line.product_id else ""
            out.append(
                {
                    "id": row.id,
                    "purchase_return_id": row.purchase_return_id,
                    "purchase_id": row.purchase_return.purchase_id,
                    "purchase_invoice_number": row.purchase_return.purchase.invoice_number or "",
                    "company_name": row.purchase_return.company.name
                    if row.purchase_return.company_id
                    else "",
                    "product_name": product_name_out,
                    "quantity": int(row.quantity),
                    "unit_cost_usd": format(Decimal(row.unit_cost_usd), "f"),
                    "occurred_at": row.purchase_return.occurred_at.isoformat(),
                    "note": row.purchase_return.note or "",
                },
            )
        return Response({"results": out})

    @action(
        detail=False,
        methods=["patch"],
        url_path=r"purchase-return-lines/(?P<line_id>[0-9]+)",
    )
    def patch_purchase_return_line(self, request, line_id=None):
        """Correct return timestamp, note, or stored unit cost for one return line (same shop)."""
        shop_id = require_shop_id(request)
        try:
            lid = int(line_id)
        except (TypeError, ValueError):
            return Response({"detail": "Invalid line id."}, status=400)

        if not isinstance(request.data, dict):
            return Response({"detail": "Invalid JSON body."}, status=400)
        if not any(k in request.data for k in ("occurred_at", "note", "unit_cost_usd")):
            return Response({"detail": "No fields to update."}, status=400)

        with transaction.atomic():
            line = (
                PurchaseReturnLine.objects.select_for_update(of=("self",))
                .filter(pk=lid, purchase_return__shop_id=shop_id)
                .select_related(
                    "purchase_return",
                    "purchase_return__company",
                    "purchase_return__purchase",
                    "purchase_line",
                    "purchase_line__product",
                )
                .first()
            )
            if line is None:
                return Response({"detail": "Return line not found."}, status=404)

            pr = PurchaseReturn.objects.select_for_update().get(pk=line.purchase_return_id)

            pr_updates: dict = {}
            if "note" in request.data:
                pr_updates["note"] = str(request.data.get("note") or "").strip()
            if "occurred_at" in request.data:
                raw_at = str(request.data.get("occurred_at") or "").strip()
                dt = parse_datetime(raw_at)
                if dt is None:
                    return Response({"detail": "Invalid occurred_at."}, status=400)
                if timezone.is_naive(dt):
                    dt = timezone.make_aware(dt, timezone.get_current_timezone())
                pr_updates["occurred_at"] = dt

            if pr_updates:
                PurchaseReturn.objects.filter(pk=pr.pk).update(**pr_updates)

            if "unit_cost_usd" in request.data:
                raw_uc = str(request.data.get("unit_cost_usd") or "").strip().replace(",", "").replace("،", "")
                try:
                    uc = Decimal(raw_uc)
                except Exception as exc:
                    raise ValidationError({"unit_cost_usd": "Invalid amount."}) from exc
                if uc < 0:
                    return Response({"detail": "unit_cost_usd cannot be negative."}, status=400)
                line.unit_cost_usd = uc.quantize(Decimal("0.0001"))
                line.save(update_fields=["unit_cost_usd"])

        fresh = (
            PurchaseReturnLine.objects.filter(pk=lid, purchase_return__shop_id=shop_id)
            .select_related(
                "purchase_return",
                "purchase_return__company",
                "purchase_return__purchase",
                "purchase_line",
                "purchase_line__product",
            )
            .first()
        )
        if fresh is None:
            return Response({"detail": "Return line not found."}, status=404)
        pr_f = fresh.purchase_return
        product_name_out = (
            fresh.purchase_line.product.name if fresh.purchase_line.product_id else ""
        )
        out = {
            "id": fresh.id,
            "purchase_return_id": fresh.purchase_return_id,
            "purchase_id": pr_f.purchase_id,
            "purchase_invoice_number": pr_f.purchase.invoice_number or "",
            "company_name": pr_f.company.name if pr_f.company_id else "",
            "product_name": product_name_out,
            "quantity": int(fresh.quantity),
            "unit_cost_usd": format(Decimal(fresh.unit_cost_usd), "f"),
            "occurred_at": pr_f.occurred_at.isoformat(),
            "note": pr_f.note or "",
        }
        return Response(out)


class SaleViewSet(ShopScopedViewSet):
    """Receipt editors may use the same sale endpoints as owners (see receipt_editor_allowed)."""

    receipt_editor_allowed = True
    queryset = (
        Sale.objects.select_related("customer", "shop")
        .prefetch_related(
            Prefetch(
                "lines",
                queryset=SaleLine.objects.select_related(
                    "product",
                    "product__shop",
                    "product__category",
                ).prefetch_related("return_lines"),
            ),
            "returns__lines__sale_line",
        )
        .all()
    )
    serializer_class = SaleSerializer
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {
        # Cashiers who can record sales should also be able to review them.
        "GET": ("view_sale", "add_sale"),
        "POST": ("add_sale",),
        # Same people who record sales often need to correct lines/payments before returns exist.
        "PUT": ("change_sale", "add_sale"),
        "PATCH": ("change_sale", "add_sale"),
    }

    def get_queryset(self):
        qs = super().get_queryset()
        search = (self.request.query_params.get("search") or "").strip()
        product_name = (self.request.query_params.get("product_name") or "").strip()
        customer_name = (self.request.query_params.get("customer_name") or "").strip()
        receipt_number = (self.request.query_params.get("receipt_number") or "").strip()
        date_from = (self.request.query_params.get("date_from") or "").strip()
        date_to = (self.request.query_params.get("date_to") or "").strip()
        if date_from:
            qs = qs.filter(occurred_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(occurred_at__date__lte=date_to)
        if product_name:
            qs = qs.filter(
                Q(lines__product__name__icontains=product_name)
                | Q(lines__manual_name__icontains=product_name),
            ).distinct()
        if customer_name:
            qs = qs.filter(customer__name__icontains=customer_name)
        if receipt_number:
            try:
                val = int(receipt_number)
                qs = qs.filter(Q(receipt_number=val) | Q(id=val))
            except (TypeError, ValueError):
                return qs.none()
        if search:
            qs = qs.filter(
                Q(customer__name__icontains=search)
                | Q(lines__product__name__icontains=search)
                | Q(lines__manual_name__icontains=search)
                | Q(note__icontains=search),
            ).distinct()
        raw_cust = (self.request.query_params.get("customer") or "").strip()
        if raw_cust:
            try:
                cust_id = int(raw_cust)
            except (TypeError, ValueError):
                return qs.none()
            shop_id = get_shop_id_for_request(self.request)
            if shop_id is not None and not Customer.objects.filter(pk=cust_id, shop_id=shop_id).exists():
                return qs.none()
            qs = qs.filter(customer_id=cust_id)
        return qs.order_by("-occurred_at", "-id")

    @action(detail=False, methods=["post"], url_path="return-products")
    def return_products(self, request):
        """Return sold products back to stock using original sale line prices."""
        ser = SaleReturnCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        out = ser.save()
        return Response(out, status=201)

    @action(detail=False, methods=["get"], url_path="returns-history")
    def returns_history(self, request):
        """Flat list of returned sale lines for audit/history UIs."""
        shop_id = require_shop_id(request)
        rows = (
            SaleReturnLine.objects.filter(sale_return__shop_id=shop_id)
            .select_related("sale_return", "sale_line", "sale_line__product")
            .order_by("-sale_return__occurred_at", "-id")
        )
        out: list[dict] = []
        for row in rows:
            line_name = ""
            if row.sale_line.product_id and row.sale_line.product is not None:
                line_name = row.sale_line.product.name
            elif row.sale_line.manual_name:
                line_name = row.sale_line.manual_name
            out.append(
                {
                    "id": row.id,
                    "sale_id": row.sale_return.sale_id,
                    "sale_return_id": row.sale_return_id,
                    "product_name": line_name,
                    "quantity": int(row.quantity),
                    "unit_price_usd": format(Decimal(row.unit_price_usd), "f"),
                    "occurred_at": row.sale_return.occurred_at.isoformat(),
                },
            )
        return Response({"results": out})


class ShareholderViewSet(OwnerScopedViewSet):
    queryset = Shareholder.objects.select_related("shop").all()
    serializer_class = ShareholderSerializer
    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {
        "GET": ("view_shareholder",),
        "POST": ("add_shareholder",),
        "PUT": ("change_shareholder",),
        "PATCH": ("change_shareholder",),
        "DELETE": ("delete_shareholder",),
    }


class EmployeeDebtViewSet(OwnerScopedViewSet):
    queryset = EmployeeDebt.objects.select_related("employee", "shop").all()
    serializer_class = EmployeeDebtSerializer
    permission_classes = [IsAuthenticated, IsShopOwnerOrPermission]
    permission_codenames_by_method = {
        "GET": ("view_employeedebt",),
        "POST": ("add_employeedebt",),
        "PUT": ("change_employeedebt",),
        "PATCH": ("change_employeedebt",),
        "DELETE": ("delete_employeedebt",),
    }

    def get_serializer(self, *args, **kwargs):
        serializer = super().get_serializer(*args, **kwargs)
        if hasattr(serializer, "fields") and "employee" in serializer.fields:
            shop_id = get_shop_id_for_request(self.request)
            if shop_id is not None:
                serializer.fields["employee"].queryset = User.objects.filter(shop_id=shop_id)
            else:
                serializer.fields["employee"].queryset = User.objects.none()
        return serializer

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        shop_id = require_shop_id(request)
        return Response({"employees": employee_debt_by_user(shop_id)})
