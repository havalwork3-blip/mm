import type { StorefrontSocialLink } from '../api/storefrontApi'

export const STOREFRONT_SOCIAL_PLATFORMS = [
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'twitter',
  'telegram',
  'whatsapp',
  'snapchat',
  'website',
] as const

export type StorefrontSocialPlatform = (typeof STOREFRONT_SOCIAL_PLATFORMS)[number]

export function socialPlatformLabel(
  platform: string,
  labels: Record<StorefrontSocialPlatform, string>,
): string {
  const key = platform as StorefrontSocialPlatform
  return labels[key] ?? platform
}

export function normalizeSocialLinks(raw: unknown): StorefrontSocialLink[] {
  if (!Array.isArray(raw)) return []
  const out: StorefrontSocialLink[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const platform = String((item as StorefrontSocialLink).platform ?? '').trim().toLowerCase()
    const url = String((item as StorefrontSocialLink).url ?? '').trim()
    if (!platform || !url.startsWith('http')) continue
    if (!STOREFRONT_SOCIAL_PLATFORMS.includes(platform as StorefrontSocialPlatform)) continue
    out.push({ platform, url })
  }
  return out
}
