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

/** Text block appended so the shop can open the pin on a map. */
export function coordsFooter(coords: GeoCoords, mapsUrl: string): string {
  return `\n📍 ${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}\n${mapsUrl}`
}

export async function resolveAddressFromDevice(lang: Lang): Promise<string> {
  const coords = await getCurrentCoords()
  const label = await reverseGeocodeAddress(coords, lang)
  const maps = googleMapsUrl(coords)
  const base = label || `${coords.lat.toFixed(6)}, ${coords.lon.toFixed(6)}`
  return `${base}${coordsFooter(coords, maps)}`
}
