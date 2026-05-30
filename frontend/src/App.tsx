import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { isStorefrontMode } from './lib/storefrontConfig'
import { MainLayout } from './layout/MainLayout'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminShopsPage } from './pages/admin/AdminShopsPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { CashierPage } from './pages/CashierPage'
import { CompanyDebtsPage } from './pages/CompanyDebtsPage'
import { CustomerDebtsPage } from './pages/CustomerDebtsPage'
import { DebtsPage } from './pages/DebtsPage'
import { HomePage } from './pages/HomePage'
import { InventoryPage } from './pages/InventoryPage'
import { JardPage } from './pages/JardPage'
import { PosPage } from './pages/PosPage'
import { ProfitReportPage } from './pages/ProfitReportPage'
import { PurchasesPage } from './pages/PurchasesPage'
import { PurchaseReturnsPage } from './pages/PurchaseReturnsPage'
import { CategoriesManagePage } from './pages/CategoriesManagePage'
import { ResourceCrudPage } from './pages/ResourceCrudPage'
import { SalesListPage } from './pages/SalesListPage'
import { SalesReturnsPage } from './pages/SalesReturnsPage'
import { CatalogPage } from './pages/CatalogPage'
import { SettingsPage } from './pages/SettingsPage'
import { QrCodeSocialLandingPage } from './pages/QrCodeSocialLandingPage'
import { AdminQrSocialPage } from './pages/admin/AdminQrSocialPage'
import { MerchantOnlineOrdersPage } from './pages/merchant/MerchantOnlineOrdersPage'
import { MerchantOnlinePricingPage } from './pages/merchant/MerchantOnlinePricingPage'
import { MerchantOnlineShopPage } from './pages/merchant/MerchantOnlineShopPage'
import { MarketingCMSLayout } from './pages/marketing/MarketingCMSLayout'
import { MarketingContactInboxPage } from './pages/marketing/MarketingContactInboxPage'
import { MarketingContentPage } from './pages/marketing/MarketingContentPage'
import { MarketingLoginPage } from './pages/marketing/MarketingLoginPage'
import { MarketingOverviewPage } from './pages/marketing/MarketingOverviewPage'
import { MarketingProductsPage } from './pages/marketing/MarketingProductsPage'
import { MarketingSettingsPage } from './pages/marketing/MarketingSettingsPage'
import { MarketingSessionProvider } from './context/MarketingSessionContext'
import { StorefrontRoutes } from './pages/storefront/StorefrontRoutes'

const storefrontHost = isStorefrontMode()

function App() {
  if (storefrontHost) {
    return (
      <BrowserRouter>
        <StorefrontRoutes />
      </BrowserRouter>
    )
  }

  return (
    <BrowserRouter>
      <MarketingSessionProvider>
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
      </MarketingSessionProvider>
    </BrowserRouter>
  )
}

export default App
