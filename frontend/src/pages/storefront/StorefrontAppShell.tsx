import { StorefrontCatalogProvider } from './storefrontCatalogContext'
import { StorefrontErrorBoundary } from './StorefrontErrorBoundary'
import { StorefrontLayout } from './StorefrontLayout'
import { StorefrontPriceProvider } from './storefrontPriceContext'
import { StorefrontShopProvider, useStorefrontShop } from './StorefrontShopContext'
import { StorefrontThemeProvider } from './storefrontThemeContext'

function StorefrontInner() {
  const { shopId } = useStorefrontShop()
  return (
    <StorefrontThemeProvider shopId={shopId}>
      <StorefrontPriceProvider>
        <StorefrontCatalogProvider>
          <StorefrontLayout />
        </StorefrontCatalogProvider>
      </StorefrontPriceProvider>
    </StorefrontThemeProvider>
  )
}

export function StorefrontAppShell() {
  return (
    <StorefrontErrorBoundary>
      <StorefrontShopProvider>
        <StorefrontInner />
      </StorefrontShopProvider>
    </StorefrontErrorBoundary>
  )
}
