import type { PermissionRow } from '../types/api'

/** Logical areas aligned with the shop sidebar / super-admin UX. */
export type PermissionCategoryId =
  | 'dashboard'
  | 'sales'
  | 'inventory'
  | 'purchasing'
  | 'customers'
  | 'finance'
  | 'profit_report'
  | 'jard'
  | 'cash'
  | 'cashier'
  | 'staff_debts'
  | 'system'
  | 'qr_social'
  | 'other'

export type PermissionCategoryDef = {
  id: PermissionCategoryId
  /** i18n key for section title (reuse nav where possible). */
  labelKey: string
}

export const PERMISSION_CATEGORY_ORDER: PermissionCategoryDef[] = [
  { id: 'dashboard', labelKey: 'nav.dashboard' },
  { id: 'sales', labelKey: 'nav.salesSection' },
  { id: 'inventory', labelKey: 'nav.inventorySection' },
  { id: 'purchasing', labelKey: 'nav.purchasingSection' },
  { id: 'customers', labelKey: 'nav.customersSection' },
  { id: 'finance', labelKey: 'nav.financeSection' },
  { id: 'profit_report', labelKey: 'nav.profit' },
  { id: 'jard', labelKey: 'nav.jard' },
  { id: 'cash', labelKey: 'nav.cashSection' },
  { id: 'cashier', labelKey: 'nav.cashier' },
  { id: 'staff_debts', labelKey: 'nav.staffDebtsSection' },
  { id: 'system', labelKey: 'nav.settings' },
  { id: 'qr_social', labelKey: 'admin.qrSocial' },
  { id: 'other', labelKey: 'admin.permCategory.other' },
]

const INVENTORY = 'inventory'
const SHOPS = 'shops'
const ACCOUNTS = 'accounts'
const AUTH = 'auth'
const ADMIN = 'admin'
const CT = 'contenttypes'
const SESS = 'sessions'

/** Map `app_label.model` (lowercase) to a UI category. */
const MODEL_CATEGORY = new Map<string, PermissionCategoryId>([
  [`${SHOPS}.currency`, 'dashboard'],
  [`${INVENTORY}.sale`, 'sales'],
  [`${INVENTORY}.saleline`, 'sales'],
  [`${INVENTORY}.salereturn`, 'sales'],
  [`${INVENTORY}.salereturnline`, 'sales'],
  [`${INVENTORY}.product`, 'inventory'],
  [`${INVENTORY}.category`, 'inventory'],
  [`${INVENTORY}.company`, 'purchasing'],
  [`${INVENTORY}.purchase`, 'purchasing'],
  [`${INVENTORY}.purchaseline`, 'purchasing'],
  [`${INVENTORY}.purchasereturn`, 'purchasing'],
  [`${INVENTORY}.purchasereturnline`, 'purchasing'],
  [`${INVENTORY}.customer`, 'customers'],
  [`${INVENTORY}.expense`, 'finance'],
  [`${INVENTORY}.shareholder`, 'finance'],
  [`${INVENTORY}.shopdayopeningcash`, 'cashier'],
  [`${INVENTORY}.employeedebt`, 'staff_debts'],
  [`${SHOPS}.shop`, 'system'],
  [`${SHOPS}.receiptsettings`, 'system'],
  [`${SHOPS}.shopsettings`, 'system'],
  [`${SHOPS}.qrlandingsettings`, 'qr_social'],
  [`${SHOPS}.qrlandingcustomlink`, 'qr_social'],
  [`${ACCOUNTS}.user`, 'system'],
  [`${AUTH}.group`, 'system'],
  [`${AUTH}.permission`, 'system'],
  [`${ADMIN}.logentry`, 'system'],
  [`${CT}.contenttype`, 'system'],
  [`${SESS}.session`, 'system'],
])

export function permissionCategoryKey(p: PermissionRow): string {
  return `${p.app_label}.${p.model}`.toLowerCase()
}

export function getPermissionCategoryId(p: PermissionRow): PermissionCategoryId {
  if (p.app_label === SHOPS && p.model === 'shop' && p.codename === 'view_profitreport') {
    return 'profit_report'
  }
  if (p.app_label === SHOPS && p.model === 'shop' && p.codename === 'view_cashier') {
    return 'cashier'
  }
  if (p.app_label === SHOPS && p.model === 'shop' && p.codename === 'view_jard_financials') {
    return 'jard'
  }
  return MODEL_CATEGORY.get(permissionCategoryKey(p)) ?? 'other'
}

export function sortPermissionsForDisplay(
  rows: PermissionRow[],
  labelFn: (p: PermissionRow) => string,
): PermissionRow[] {
  return [...rows].sort((a, b) => {
    const la = labelFn(a).toLocaleLowerCase()
    const lb = labelFn(b).toLocaleLowerCase()
    if (la !== lb) return la.localeCompare(lb)
    return a.id - b.id
  })
}

/**
 * Within the "Sales" permission category, split receipt-editing (POS / sales list
 * "edit receipt") from other sale/return permissions. Rows should already be sales-category.
 */
export function splitSalesPermissions(rows: PermissionRow[]): {
  receiptEdit: PermissionRow[]
  other: PermissionRow[]
} {
  const receiptEdit: PermissionRow[] = []
  const other: PermissionRow[] = []
  for (const p of rows) {
    const isReceiptEdit =
      (p.app_label === INVENTORY && p.model === 'sale' && p.codename === 'change_sale') ||
      (p.app_label === INVENTORY && p.model === 'saleline' && p.codename === 'change_saleline')
    if (isReceiptEdit) receiptEdit.push(p)
    else other.push(p)
  }
  return { receiptEdit, other }
}
