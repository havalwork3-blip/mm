export type ShopRow = {
  id: number
  name: string
  slug: string
  settings: Record<string, unknown>
  is_active: boolean
  online_storefront_enabled: boolean
  storefront_host: string
}

/** GET /api/public/qr-landing/ — global public page (single QR for all shops). */
export type PublicQrPresetLink = {
  kind: 'preset'
  id: string
  label: string
  url: string
}

export type PublicQrCustomLink = {
  kind: 'custom'
  id: number
  label: string
  url: string
  bg_color: string
  logo_url: string | null
}

export type PublicQrLandingResponse = {
  headline: string
  tagline: string
  accent_color: string
  logo_url: string | null
  phone: string
  preset_links: PublicQrPresetLink[]
  custom_links: PublicQrCustomLink[]
}

/** GET/PATCH /api/admin/qr-landing/ */
export type QrLandingPresetRow = {
  id: string
  url: string
  enabled: boolean
}

export type QrLandingCustomLinkRow = {
  id: number
  sort_order: number
  label: string
  url: string
  enabled: boolean
  bg_color: string
  logo: string | null
  logo_url: string | null
}

export type QrLandingAdminResponse = {
  headline: string
  tagline: string
  accent_color: string
  phone: string
  primary_logo_url: string | null
  preset_links: QrLandingPresetRow[]
  custom_links: QrLandingCustomLinkRow[]
  updated_at: string | null
}

export type ShareholderRow = {
  id: number
  shop: number
  name: string
  share_percentage: string
}

export type CashierSummaryResponse = {
  opening_cash_usd: string
  sales_cash_in_usd: string
  expenses_usd: string
  employee_debt_cash_effect_usd: string
  current_cash_usd: string
  total_stock_value_usd: string
  total_capital_usd: string
  total_debts_exposure_usd: string
  company_payments_usd: string
  customer_receipts_usd: string
  supplier_debt_usd: string
  customer_debt_usd: string
  /** Gross goods value on purchases in date range */
  purchases_goods_usd: string
  /** Invoiced sales total in date range */
  sales_invoiced_usd: string
  /** Remaining employee debt (all time) */
  employee_debt_outstanding_usd: string
  /** Latest saved IQD per 1 USD; empty if unset */
  usd_to_iqd: string
  /** Sum of sale line unit prices in period (before invoice discount) */
  period_sum_sale_prices_usd: string
  /** Sale revenue − COGS − customer discounts + supplier discounts; before operating expenses */
  period_gross_trade_profit_usd: string
  period_customer_discounts_usd: string
  period_supplier_discounts_received_usd: string
  period_net_profit_usd: string
  date_from?: string
  date_to?: string
}

export type CashierLedgerEntryKind =
  | 'opening_cash'
  | 'expense'
  | 'employee_debt'
  | 'sale_payment'
  | 'sale_return'
  | 'purchase_payment'

export type CashierLedgerEntry = {
  kind: CashierLedgerEntryKind
  id: number
  occurred_on: string
  occurred_at: string | null
  amount_usd: string
  direction: 'in' | 'out' | 'balance'
  label: string
  debt_type?: string
}

export type CashierLedgerResponse = {
  date_from: string
  date_to: string
  entries: CashierLedgerEntry[]
}

export type EmployeeDebtRow = {
  id: number
  shop: number
  employee: number
  employee_email: string
  amount: string
  debt_type: string
  occurred_on: string
  note: string
  created_at: string
}

export type SummaryEmployee = {
  employee_id: number
  email: string
  remaining_debt_usd: string
}

/** Single permission row from GET /api/users/:id/ (catalog). */
export type PermissionRow = {
  id: number
  codename: string
  name: string
  app_label: string
  model: string
}

/** Shop-scoped users from GET /api/users/ */
export type ShopUserRow = {
  id: number
  email: string
  shop: number | null
  shop_name?: string
  role: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
  last_login: string | null
  /** Effective permissions as app_label.codename (from auth backend). */
  user_permissions?: string[]
}

/** GET /api/users/:id/ — includes full permission catalog + selection (superuser retrieve). */
export type UserDetail = ShopUserRow & {
  all_permissions: PermissionRow[]
  user_permission_ids: number[]
}

export type Me = {
  id: number
  email: string
  shop: number | null
  /** Resolved shop display name when the user has a shop (from API). */
  shop_name?: string
  /** True when the active shop has online storefront enabled (superuser: selected shop). */
  online_storefront_enabled?: boolean
  role: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
  date_joined: string
  last_login: string | null
  /** Effective permissions as app_label.codename (from auth backend). */
  user_permissions: string[]
}

export type CurrencyRow = {
  id: number
  shop: number
  date: string
  usd_to_iqd: string
  created_at: string
}

export type ReceiptSettingsRow = {
  id: number
  shop: number
  logo: string | null
  logo_url: string | null
  shop_name_en: string
  shop_name_ku: string
  sub_title: string
  address: string
  /** Encoded in receipt QR; generated in-app, no third-party API. */
  receipt_qr_url?: string
  /** Shown above the QR on the printed receipt (shop-defined). */
  receipt_qr_caption?: string
  phone_number: string
  email: string
  footer_note: string
  direct_print: boolean
  show_customer_balance: boolean
  show_item_images: boolean
  show_iqd_on_pdf?: boolean
  receipt_format: 'A4' | '80MM'
  updated_at: string
}

export type ShopSettingsRow = {
  id: number
  shop: number
  primary_color: string
  background_color?: string
  dark_background_color?: string
  accent_color?: string
  sidebar_color?: string
  surface_color?: string
  surface_color_dark?: string
  success_color?: string
  warning_color?: string
  danger_color?: string
  default_mode: 'light' | 'dark' | 'system'
  low_stock_threshold: number
  base_currency: 'USD' | 'IQD'
  complete_sale_shortcut: string
  updated_at: string
}

export type ProductRow = {
  id: number
  shop: number
  shop_name?: string
  name: string
  is_unregistered_placeholder?: boolean
  /** When true, product is no longer restocked; hidden from POS (unless re-enabled in inventory). */
  is_discontinued?: boolean
  image: string | null
  image_url: string | null
  category: number
  sku: string | null
  barcode: string | null
  buy_price: string
  sale_price_retail: string
  sale_price_wholesale: string
  current_stock_quantity: number
  low_stock_threshold: number | null
  prices_iqd: { retail_iqd: string; wholesale_iqd: string } | null
  created_at: string
  updated_at: string
}

export type Paginated<T> = {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export type StorefrontOrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'

export type MerchantStorefrontOrderItemRow = {
  id: number
  product: number
  product_name: string
  quantity: number
  unit_price: string
}

export type MerchantStorefrontOrderRow = {
  id: number
  shop: number
  customer_name: string
  customer_phone: string
  customer_address: string
  total_amount: string
  status: StorefrontOrderStatus
  items: MerchantStorefrontOrderItemRow[]
  created_at: string
  updated_at: string
}

export type CustomerRow = {
  id: number
  shop: number
  name: string
  workplace: string
  address: string
  phone_1: string
  phone_2: string
  requires_attention: boolean
  note: string
}

/** GET /api/customers/debt-summary/ */
export type CustomerDebtRow = {
  id: number
  name: string
  address: string
  phone_1: string
  phone_2?: string
  outstanding_balance_usd: string
  outstanding_balance_iqd: string | null
}

export type CustomerDebtSummaryResponse = {
  results: CustomerDebtRow[]
  total_outstanding_usd: string
  total_outstanding_iqd: string | null
  exchange_rate_usd_to_iqd: string | null
}

/** POST /api/customers/:id/collect-payment/ */
export type CustomerCollectPaymentResponse = {
  applied_usd_eq: string
  overpaid_usd_eq: string
  outstanding_balance_usd_after: string
}

/** Line as returned on GET /api/sales/ */
export type SaleLineRow = {
  id: number
  product: number | null
  manual_name: string
  product_name: string
  quantity: number
  unit_price_usd: string
  unit_buy_price_usd: string
  returned_quantity?: number
}

/** Sale row from GET /api/sales/ */
export type SaleListRow = {
  id: number
  shop: number
  receipt_number: number
  customer: number | null
  occurred_at: string
  exchange_rate_usd_to_iqd: string
  invoice_discount_usd: string
  amount_paid_iqd: string
  amount_paid_usd: string
  note: string
  customer_phone: string
  customer_name: string
  customer_address: string
  previous_debt_usd: string
  has_returns?: boolean
  returned_total_usd?: string
  return_lines_summary?: string
  lines: SaleLineRow[]
  created_at: string
}

export type SaleReturnResponse = {
  id: number
  sale_id: number
  occurred_at: string
  total_refund_usd: string
  lines_count: number
}

export type DashboardStats = {
  date_from: string
  date_to: string
  net_profit_usd: string
  total_expenses_usd: string
  /** Stock write-offs (manual decrease + stop-carrying), subset of expenses. */
  total_inventory_loss_usd?: string
  total_sales_usd: string
  total_discounts_usd: string
  debtor_customers_count: number
  total_returned_products_qty: number
  total_returned_products_usd: string
  period_receivables_usd: string
  period_cash_drawer_usd: string
  period_cash_in_usd?: string
  period_cash_out_usd?: string
  current_cash_usd: string
  total_receivables_usd: string
  total_payables_usd: string
  total_stock_value_usd: string
  chart: { profit_usd: string; expenses_usd: string }
  top_selling_products: Array<{
    product_id: number | null
    product_name: string
    total_qty: number
    total_sales_usd: string
  }>
}

/** GET /api/admin/stats/ (superuser, global) */
export type AdminGlobalStats = {
  date_from: string
  date_to: string
  total_shops: number
  total_active_shops: number
  total_active_users: number
  global_profit_usd: string
  global_discounts_usd: string
  global_stock_value_usd: string
  global_sales_usd?: string
  global_expenses_usd?: string
  top_shops?: Array<{
    shop_id: number
    shop_name: string
    is_active: boolean
    sales_usd: string
    total_sold_usd?: string
    profit_usd: string
    expenses_usd: string
    discounts_usd: string
    returned_products_usd?: string
    period_receivables_usd?: string
    period_cash_drawer_usd?: string
    stock_value_usd: string
  }>
}

export type ProfitReportResponse = {
  date_from: string
  date_to: string
  global_multi_shop?: boolean
  /** Latest saved Currency.usd_to_iqd for the shop; empty if unset. */
  usd_to_iqd?: string
  profit_distribution: {
    shareholder_id: number
    name: string
    share_percentage: string
    /** Partner capital recorded on the shareholder (USD). */
    capital_contribution_usd: string
    profit_share_usd: string
    /** capital + profit_share for this period (informational). */
    position_after_period_usd: string
  }[]
  totals: {
    sum_sale_line_prices_usd: string
    sum_sale_line_buy_prices_usd: string
    total_customer_discounts_usd: string
    total_expenses_usd: string
    /** Inventory loss / write-off (USD), included in total_expenses_usd. */
    total_inventory_loss_usd?: string
    total_company_discounts_received_usd: string
    net_profit_usd: string
  }
  lines: {
    product_id: number
    product_name: string
    quantity_sold: string
    unit_buy_price_usd: string
    total_buy_price_usd: string
    unit_sale_price_usd: string
    total_sale_price_usd: string
    net_profit_usd: string
    shop_id?: number
    shop_name?: string
  }[]
}

export type JardRow = {
  product_id: number
  product_name: string
  product_image_url?: string | null
  category_id: number | null
  category_name: string
  remaining_qty: number
  sold_qty?: number
  unit_buy_price_usd?: string
  remaining_value_usd?: string
  sold_value_usd?: string
}

export type JardReportResponse = {
  results: JardRow[]
  show_financials?: boolean
}
