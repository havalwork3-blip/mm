import type { Lang } from '../i18n/strings'

export type GeoCoords = { lat: number; lon: number }

function nominatimLang(lang: Lang): string {
  if (lang === 'ku') return 'ckb,ar,en'
  if (lang === 'ar') return 'ar,en'
  return 'en'
}

export function getCurrentCoords(): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('unsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('denied'))
        else if (err.code === err.TIMEOUT) reject(new Error('timeout'))
        else reject(new Error('unavailable'))
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 120000 },
    )
  })
}

export async function reverseGeocodeAddress(
  coords: GeoCoords,
  lang: Lang,
): Promise<string | null> {
  const { lat, lon } = coords
  const acceptLang = nominatimLang(lang)
  const params = new URLSearchParams({
    format: 'json',
    lat: String(lat),
    lon: String(lon),
    'accept-language': acceptLang,
  })
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Language': acceptLang,
        },
      },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { display_name?: string }
    const name = (data.display_name || '').trim()
    return name || null
  } catch {
    return null
  }
}

export function googleMapsUrl(coords: GeoCoords): string {
  return `https://www.google.com/maps?q=${coords.lat},${coords.lon}`
}

/** Parse coordinates saved in order address (Google Maps link or pin line). */
export function parseCoordsFromAddress(text: string): GeoCoords | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const maps = trimmed.match(
    /https:\/\/www\.google\.com\/maps\?q=([-\d.]+),([-\d.]+)/i,
  )
  if (maps) {
    const lat = Number.parseFloat(maps[1])
    const lon = Number.parseFloat(maps[2])
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon }
  }

  const pin = trimmed.match(/📍\s*([-\d.]+),\s*([-\d.]+)/)
  if (pin) {
    const lat = Number.parseFloat(pin[1])
    const lon = Number.parseFloat(pin[2])
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon }
  }

  return null
}

export async function buildAddressFromCoords(
  coords: GeoCoords,
  lang: Lang,
  label?: string | null,
): Promise<string> {
  const maps = googleMapsUrl(coords)
  const resolved = label ?? (await reverseGeocodeAddress(coords, lang))
  const base = resolved || `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`
  return `${base}${coordsFooter(coords, maps)}`
}

/** Text block appended so the shop can open the pin on a map. */
export function coordsFooter(coords: GeoCoords, mapsUrl: string): string {
  return `\n📍 ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}\n${mapsUrl}`
}

export async function resolveAddressFromDevice(lang: Lang): Promise<string> {
  const coords = await getCurrentCoords()
  const label = await reverseGeocodeAddress(coords, lang)
  return buildAddressFromCoords(coords, lang, label)
}
