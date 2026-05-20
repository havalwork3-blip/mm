import { Navigate, Route, Routes } from 'react-router-dom'

import { isStorefrontMode } from '../../lib/storefrontConfig'
import { StorefrontCatalog } from './StorefrontCatalog'
import { StorefrontLayout } from './StorefrontLayout'
import { StorefrontShopProvider } from './StorefrontShopContext'

/** Public customer storefront — no login required. */
export function StorefrontRoutes() {
  const home = isStorefrontMode() ? '/' : '/store'
  return (
    <Routes>
      <Route
        element={
          <StorefrontShopProvider>
            <StorefrontLayout />
          </StorefrontShopProvider>
        }
      >
        <Route index element={<StorefrontCatalog />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}
