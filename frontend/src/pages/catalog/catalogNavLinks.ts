import type { CatalogSectionId } from './catalogSectionIds'

/** In-app routes shown as quick actions under each catalog section. */
export type CatalogNavLink = { to: string; labelKey: string; superuserOnly?: boolean }

export const CATALOG_NAV_LINKS: Partial<Record<CatalogSectionId, CatalogNavLink[]>> = {
  bigPicture: [{ to: '/', labelKey: 'nav.dashboard' }],
  dashboard: [{ to: '/', labelKey: 'nav.dashboard' }],
  sales: [
    { to: '/pos', labelKey: 'nav.pos' },
    { to: '/jard', labelKey: 'nav.jard' },
    { to: '/sales-returns', labelKey: 'nav.salesReturns' },
  ],
  inventory: [{ to: '/inventory', labelKey: 'nav.inventory' }],
  purchasing: [
    { to: '/manage/companies', labelKey: 'nav.companies' },
    { to: '/manage/purchases', labelKey: 'nav.purchases' },
    { to: '/manage/purchase-returns', labelKey: 'nav.purchaseReturns' },
  ],
  customers: [
    { to: '/manage/customers', labelKey: 'nav.customers' },
    { to: '/customer-debts', labelKey: 'nav.customerDebts' },
    { to: '/company-debts', labelKey: 'nav.companyDebts' },
  ],
  finance: [
    { to: '/manage/expenses', labelKey: 'nav.expenses' },
    { to: '/manage/shareholders', labelKey: 'nav.shareholders' },
    { to: '/profit', labelKey: 'nav.profit' },
  ],
  cash: [
    { to: '/manage/opening-cash', labelKey: 'nav.openingCash' },
    { to: '/cashier', labelKey: 'nav.cashier' },
  ],
  debts: [{ to: '/debts', labelKey: 'nav.debts' }],
  settings: [{ to: '/settings', labelKey: 'nav.settings' }],
  admin: [
    { to: '/admin/shops', labelKey: 'admin.shops', superuserOnly: true },
    { to: '/admin/users', labelKey: 'admin.users', superuserOnly: true },
    { to: '/admin/qr-social', labelKey: 'admin.qrSocial', superuserOnly: true },
  ],
  access: [{ to: '/admin/users', labelKey: 'admin.users', superuserOnly: true }],
}
