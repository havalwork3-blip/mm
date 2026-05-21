import { StorefrontCatalogProvider } from './storefrontCatalogContext'
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
    <StorefrontShopProvider>
      <StorefrontInner />
    </StorefrontShopProvider>
  )
}
