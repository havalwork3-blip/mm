import type { StorefrontSocialLink } from '../api/storefrontApi'
import { apiJson } from './api'
import type { StorefrontFaqItem } from '../api/storefrontApi'

export type MerchantStorefrontSettings = {
  id: number
  shop: number
  catalog_title: string
  catalog_subtitle: string
  welcome_message: string
  logo_url: string | null
  accent_color: string
  banner_rotate_seconds: number
  price_display_default: 'usd' | 'iqd' | 'both'
  contact_phone: string
  contact_whatsapp: string
  contact_email: string
  about_title: string
  about_body: string
  faq_items: StorefrontFaqItem[]
  shop_address: string
  location_url: string
  location_image_url: string | null
  social_links: StorefrontSocialLink[]
  delivery_free_min_usd: string | null
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

export async function uploadMerchantStorefrontLocationImage(
  file: File,
): Promise<MerchantStorefrontSettings> {
  const form = new FormData()
  form.append('location_image', file)
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

export type MerchantStorefrontSettingsPatch = Partial<
  Pick<
    MerchantStorefrontSettings,
    | 'catalog_title'
    | 'catalog_subtitle'
    | 'welcome_message'
    | 'accent_color'
    | 'banner_rotate_seconds'
    | 'price_display_default'
    | 'contact_phone'
    | 'contact_whatsapp'
    | 'contact_email'
    | 'about_title'
    | 'about_body'
    | 'faq_items'
    | 'shop_address'
    | 'location_url'
    | 'social_links'
    | 'delivery_free_min_usd'
  >
>

export async function patchMerchantStorefrontSettings(
  body: MerchantStorefrontSettingsPatch,
): Promise<MerchantStorefrontSettings> {
  return apiJson<MerchantStorefrontSettings>('/api/merchant/storefront-settings/', {
    method: 'PATCH',
    shopScoped: true,
    body: JSON.stringify(body),
  })
}
