import { apiJson } from './api'

export type MerchantStorefrontSettings = {
  id: number
  shop: number
  catalog_title: string
  catalog_subtitle: string
  welcome_message: string
  logo_url: string | null
  accent_color: string
  banner_rotate_seconds: number
  storefront_host: string
  storefront_url: string
  updated_at: string
}

export async function uploadMerchantStorefrontLogo(file: File): Promise<MerchantStorefrontSettings> {
  const form = new FormData()
  form.append('logo', file)
  return apiJson<MerchantStorefrontSettings>('/api/merchant/storefront-settings/', {
    method: 'PATCH',
    shopScoped: true,
    body: form,
  })
}

export async function fetchMerchantStorefrontSettings(): Promise<MerchantStorefrontSettings> {
  return apiJson<MerchantStorefrontSettings>('/api/merchant/storefront-settings/', {
    shopScoped: true,
  })
}

export async function patchMerchantStorefrontSettings(
  body: Partial<
    Pick<
      MerchantStorefrontSettings,
      | 'catalog_title'
      | 'catalog_subtitle'
      | 'welcome_message'
      | 'accent_color'
      | 'banner_rotate_seconds'
    >
  >,
): Promise<MerchantStorefrontSettings> {
  return apiJson<MerchantStorefrontSettings>('/api/merchant/storefront-settings/', {
    method: 'PATCH',
    shopScoped: true,
    body: JSON.stringify(body),
  })
}
