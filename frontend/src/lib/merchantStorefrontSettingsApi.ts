import type { StorefrontHomeCollectionTitles, StorefrontSocialLink } from '../api/storefrontApi'
import { apiJson } from './api'
import type { StorefrontFaqItem } from '../api/storefrontApi'

export type TelegramRecipient = {
  chat_id: string
  label: string
  connected_at?: string
}

export type MerchantStorefrontSettings = {
  id: number
  shop: number
  catalog_title: string
  catalog_subtitle: string
  header_show_shop_name: boolean
  home_categories_title: string
  home_highlights_title: string
  home_collection_titles: StorefrontHomeCollectionTitles
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
  telegram_notify_enabled: boolean
  telegram_bot_token_masked: string
  telegram_link_code: string
  telegram_recipients: TelegramRecipient[]
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
    | 'header_show_shop_name'
    | 'home_categories_title'
    | 'home_highlights_title'
    | 'home_collection_titles'
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
    | 'telegram_notify_enabled'
    | 'telegram_recipients'
  > & {
    telegram_bot_token?: string
    telegram_regenerate_link?: boolean
  }
>

export async function postMerchantTelegramTest(): Promise<{ sent: number; total: number }> {
  return apiJson<{ sent: number; total: number }>(
    '/api/merchant/storefront-settings/telegram-test/',
    {
      method: 'POST',
      shopScoped: true,
    },
  )
}

export async function patchMerchantStorefrontSettings(
  body: MerchantStorefrontSettingsPatch,
): Promise<MerchantStorefrontSettings> {
  return apiJson<MerchantStorefrontSettings>('/api/merchant/storefront-settings/', {
    method: 'PATCH',
    shopScoped: true,
    body: JSON.stringify(body),
  })
}
