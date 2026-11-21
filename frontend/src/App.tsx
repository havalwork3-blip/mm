import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { PageBoundary } from './components/PageBoundary'
import { lazyPage, prefetchAllPages } from './lib/lazyPage'
import { isStorefrontMode } from './lib/storefrontConfig'
import { MainLayout } from './layout/MainLayout'
import { MarketingSessionProvider } from './context/MarketingSessionContext'

// Pages are split into their own files and loaded on demand: the first load stays small
// (previously the whole system was one ~3 MB script).
const AdminLayout = lazyPage(() => import('./pages/admin/AdminLayout'), 'AdminLayout')
const AdminShopsPage = lazyPage(() => import('./pages/admin/AdminShopsPage'), 'AdminShopsPage')
const AdminUsersPage = lazyPage(() => import('./pages/admin/AdminUsersPage'), 'AdminUsersPage')
const CashierPage = lazyPage(() => import('./pages/CashierPage'), 'CashierPage')
const CompanyDebtsPage = lazyPage(() => import('./pages/CompanyDebtsPage'), 'CompanyDebtsPage')
const CustomerDebtsPage = lazyPage(() => import('./pages/CustomerDebtsPage'), 'CustomerDebtsPage')
const DebtsPage = lazyPage(() => import('./pages/DebtsPage'), 'DebtsPage')
const HomePage = lazyPage(() => import('./pages/HomePage'), 'HomePage')
const InventoryPage = lazyPage(() => import('./pages/InventoryPage'), 'InventoryPage')
const JardPage = lazyPage(() => import('./pages/JardPage'), 'JardPage')
const PosPage = lazyPage(() => import('./pages/PosPage'), 'PosPage')
const ProfitReportPage = lazyPage(() => import('./pages/ProfitReportPage'), 'ProfitReportPage')
const PurchasesPage = lazyPage(() => import('./pages/PurchasesPage'), 'PurchasesPage')
const PurchaseReturnsPage = lazyPage(() => import('./pages/PurchaseReturnsPage'), 'PurchaseReturnsPage')
const CategoriesManagePage = lazyPage(() => import('./pages/CategoriesManagePage'), 'CategoriesManagePage')
const ResourceCrudPage = lazyPage(() => import('./pages/ResourceCrudPage'), 'ResourceCrudPage')
const SalesListPage = lazyPage(() => import('./pages/SalesListPage'), 'SalesListPage')
const SalesReturnsPage = lazyPage(() => import('./pages/SalesReturnsPage'), 'SalesReturnsPage')
const CatalogPage = lazyPage(() => import('./pages/CatalogPage'), 'CatalogPage')
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage')
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'), 'ProfilePage')
const QrCodeSocialLandingPage = lazyPage(() => import('./pages/QrCodeSocialLandingPage'), 'QrCodeSocialLandingPage')
const AdminQrSocialPage = lazyPage(() => import('./pages/admin/AdminQrSocialPage'), 'AdminQrSocialPage')
const MerchantOnlineOrdersPage = lazyPage(() => import('./pages/merchant/MerchantOnlineOrdersPage'), 'MerchantOnlineOrdersPage')
const MerchantOnlinePricingPage = lazyPage(() => import('./pages/merchant/MerchantOnlinePricingPage'), 'MerchantOnlinePricingPage')
const MerchantOnlineShopPage = lazyPage(() => import('./pages/merchant/MerchantOnlineShopPage'), 'MerchantOnlineShopPage')
const MarketingCMSLayout = lazyPage(() => import('./pages/marketing/MarketingCMSLayout'), 'MarketingCMSLayout')
const MarketingContactInboxPage = lazyPage(() => import('./pages/marketing/MarketingContactInboxPage'), 'MarketingContactInboxPage')
const MarketingContentPage = lazyPage(() => import('./pages/marketing/MarketingContentPage'), 'MarketingContentPage')
const MarketingLoginPage = lazyPage(() => import('./pages/marketing/MarketingLoginPage'), 'MarketingLoginPage')
const MarketingOverviewPage = lazyPage(() => import('./pages/marketing/MarketingOverviewPage'), 'MarketingOverviewPage')
const MarketingProductsPage = lazyPage(() => import('./pages/marketing/MarketingProductsPage'), 'MarketingProductsPage')
const MarketingSettingsPage = lazyPage(() => import('./pages/marketing/MarketingSettingsPage'), 'MarketingSettingsPage')
const StorefrontRoutes = lazyPage(() => import('./pages/storefront/StorefrontRoutes'), 'StorefrontRoutes')

const storefrontHost = isStorefrontMode()

function App() {
  useEffect(() => {
    // Dashboard only: fetch the other pages in the background so later navigation
    // (also while offline) is instant. Storefront visitors never download dashboard code.
    if (!storefrontHost) prefetchAllPages()
  }, [])

  if (storefrontHost) {
    return (
      <BrowserRouter>
        <PageBoundary>
          <StorefrontRoutes />
        </PageBoundary>
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <MarketingSessionProvider>
        <PageBoundary>
        <Routes>
          <Route path="/site-cms/login" element={<MarketingLoginPage />} />
          <Route path="/site-cms" element={<MarketingCMSLayout />}>
            <Route index element={<MarketingOverviewPage />} />
            <Route path="content/:section" element={<MarketingContentPage />} />
            <Route path="products" element={<MarketingProductsPage />} />
            <Route path="inbox" element={<MarketingContactInboxPage />} />
            <Route path="settings" element={<MarketingSettingsPage />} />
          </Route>
          <Route path="/qr-code" element={<QrCodeSocialLandingPage />} />
        <Route path="/store/*" element={<StorefrontRoutes />} />
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/jard" element={<JardPage />} />
          <Route path="/pos" element={<PosPage />} />
          <Route path="/profit" element={<ProfitReportPage />} />
          <Route path="/sales" element={<SalesListPage />} />
          <Route path="/sales-returns" element={<SalesReturnsPage />} />
          <Route path="/online-shop" element={<MerchantOnlineShopPage />} />
          <Route path="/online-orders" element={<MerchantOnlineOrdersPage />} />
          <Route path="/online-pricing" element={<MerchantOnlinePricingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/cashier" element={<CashierPage />} />
          <Route path="/debts" element={<DebtsPage />} />
          <Route path="/customer-debts" element={<CustomerDebtsPage />} />
          <Route path="/company-debts" element={<CompanyDebtsPage />} />
          <Route path="/manage/purchases" element={<PurchasesPage />} />
          <Route path="/manage/purchase-returns" element={<PurchaseReturnsPage />} />
          <Route path="/manage/categories" element={<CategoriesManagePage />} />
          <Route path="/manage/:resource" element={<ResourceCrudPage />} />
          {/* Superuser UI — must not use `/admin/*` (reserved for Django admin in nginx). */}
          <Route path="/system" element={<AdminLayout />}>
            <Route index element={<Navigate to="/system/shops" replace />} />
            <Route path="shops" element={<AdminShopsPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="qr-social" element={<AdminQrSocialPage />} />
          </Route>
          <Route path="/admin" element={<Navigate to="/system/shops" replace />} />
          <Route path="/admin/shops" element={<Navigate to="/system/shops" replace />} />
          <Route path="/admin/users" element={<Navigate to="/system/users" replace />} />
          <Route path="/admin/qr-social" element={<Navigate to="/system/qr-social" replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </PageBoundary>
      </MarketingSessionProvider>
    </BrowserRouter>
  )
}

export default App
