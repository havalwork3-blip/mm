import { Navigate, Route, Routes } from 'react-router-dom'

import './storefront.css'
import { isStorefrontMode } from '../../lib/storefrontConfig'
import { StorefrontCatalog } from './StorefrontCatalog'
import { StorefrontCatalogProvider } from './storefrontCatalogContext'
import {
  StorefrontAboutPage,
  StorefrontContactPage,
  StorefrontFaqPage,
  StorefrontLocationPage,
} from './StorefrontInfoPages'
import { StorefrontAppShell } from './StorefrontAppShell'

/** Public customer storefront — no login required. */
export function StorefrontRoutes() {
  const home = isStorefrontMode() ? '/' : '/store'
  return (
    <Routes>
      <Route
        element={<StorefrontAppShell />}
      >
        <Route index element={<StorefrontCatalog />} />
        <Route path="contact" element={<StorefrontContactPage />} />
        <Route path="about" element={<StorefrontAboutPage />} />
        <Route path="faq" element={<StorefrontFaqPage />} />
        <Route path="location" element={<StorefrontLocationPage />} />
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  )
}
