import { Crosshair, Loader2 } from 'lucide-react'
import L from 'leaflet'
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { Lang } from '../../i18n/strings'
import {
  buildAddressFromCoords,
  getCurrentCoords,
  parseCoordsFromAddress,
  reverseGeocodeAddress,
  type GeoCoords,
} from '../../lib/geolocation'
import { accentAlpha } from './storefrontTheme'

import 'leaflet/dist/leaflet.css'

const DEFAULT_CENTER: GeoCoords = { lat: 36.1911, lon: 44.0092 }
const DEFAULT_ZOOM = 13
const PIN_ZOOM = 16

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: iconUrl,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
})

type Labels = {
  mapPickHint: string
  mapDragHint: string
  useGps: string
  locating: string
  locationDenied: string
  locationTimeout: string
  locationUnsupported: string
  locationUnavailable: string
}

type Props = {
  address: string
  onAddressChange: (value: string) => void
  lang: Lang
  accent: string
  disabled?: boolean
  labels: Labels
}

function locationErrorMessage(labels: Labels, code: string): string {
  if (code === 'denied') return labels.locationDenied
  if (code === 'timeout') return labels.locationTimeout
  if (code === 'unsupported') return labels.locationUnsupported
  return labels.locationUnavailable
}

export function StorefrontLocationMapPicker({
  address,
  onAddressChange,
  lang,
  accent,
  disabled = false,
  labels,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const resolvingRef = useRef(false)
  const langRef = useRef(lang)
  const disabledRef = useRef(disabled)
  const onAddressChangeRef = useRef(onAddressChange)
  langRef.current = lang
  disabledRef.current = disabled
  onAddressChangeRef.current = onAddressChange

  const [coords, setCoords] = useState<GeoCoords | null>(() => parseCoordsFromAddress(address))
  const [resolving, setResolving] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [hasPin, setHasPin] = useState(() => parseCoordsFromAddress(address) != null)

  const applyCoords = useCallback(async (next: GeoCoords) => {
    if (resolvingRef.current) return
    resolvingRef.current = true
    setResolving(true)
    setMapError(null)
    try {
      const label = await reverseGeocodeAddress(next, langRef.current)
      const text = await buildAddressFromCoords(next, langRef.current, label)
      onAddressChangeRef.current(text)
      setCoords(next)
      setHasPin(true)
      const map = mapRef.current
      if (map) {
        map.setView([next.lat, next.lon], Math.max(map.getZoom(), PIN_ZOOM), { animate: true })
        if (markerRef.current) {
          markerRef.current.setLatLng([next.lat, next.lon])
        } else {
          const marker = L.marker([next.lat, next.lon], { draggable: !disabledRef.current })
          marker.on('dragend', () => {
            const pos = marker.getLatLng()
            void applyCoords({ lat: pos.lat, lon: pos.lng })
          })
          marker.addTo(map)
          markerRef.current = marker
        }
      }
    } catch {
      setMapError(labels.locationUnavailable)
    } finally {
      resolvingRef.current = false
      setResolving(false)
    }
  }, [labels.locationUnavailable])

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    const parsed = parseCoordsFromAddress(address)
    const initial = parsed ?? DEFAULT_CENTER
    const zoom = parsed ? PIN_ZOOM : DEFAULT_ZOOM

    const map = L.map(el, {
      center: [initial.lat, initial.lon],
      zoom,
      zoomControl: true,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    map.on('click', (e) => {
      if (disabledRef.current || resolvingRef.current) return
      void applyCoords({ lat: e.latlng.lat, lon: e.latlng.lng })
    })

    mapRef.current = map

    if (parsed) {
      const marker = L.marker([parsed.lat, parsed.lon], { draggable: !disabledRef.current })
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        void applyCoords({ lat: pos.lat, lon: pos.lng })
      })
      marker.addTo(map)
      markerRef.current = marker
    }

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map mounts once
  }, [])

  useEffect(() => {
    const parsed = parseCoordsFromAddress(address)
    if (!parsed) return
    setCoords(parsed)
    setHasPin(true)
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) {
      markerRef.current.setLatLng([parsed.lat, parsed.lon])
    } else {
      const marker = L.marker([parsed.lat, parsed.lon], { draggable: !disabledRef.current })
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        void applyCoords({ lat: pos.lat, lon: pos.lng })
      })
      marker.addTo(map)
      markerRef.current = marker
    }
    map.setView([parsed.lat, parsed.lon], PIN_ZOOM, { animate: false })
  }, [address, applyCoords])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map) return
    if (disabled) {
      map.dragging.disable()
      map.touchZoom.disable()
      map.doubleClickZoom.disable()
      map.scrollWheelZoom.disable()
      marker?.dragging?.disable()
    } else {
      map.dragging.enable()
      map.touchZoom.enable()
      map.doubleClickZoom.enable()
      map.scrollWheelZoom.enable()
      marker?.dragging?.enable()
    }
  }, [disabled])

  async function handleGps() {
    if (disabled || resolving) return
    setMapError(null)
    setResolving(true)
    try {
      const next = await getCurrentCoords()
      await applyCoords(next)
    } catch (e) {
      const code = e instanceof Error ? e.message : 'unavailable'
      setMapError(locationErrorMessage(labels, code))
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="sf-location-map-picker space-y-2">
      <p className="text-xs font-medium text-slate-500">
        {hasPin ? labels.mapDragHint : labels.mapPickHint}
      </p>

      <div
        className="sf-location-map-frame relative overflow-hidden rounded-2xl ring-1 ring-slate-200/90"
        style={{ boxShadow: `0 4px 20px ${accentAlpha(accent, 0.12)}` }}
      >
        <div ref={containerRef} className="sf-location-map h-[220px] w-full sm:h-[260px] lg:h-[280px]" />

        {resolving ? (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
            <span
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-md"
              style={{ backgroundColor: accent }}
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {labels.locating}
            </span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleGps()}
          disabled={disabled || resolving}
          className="absolute end-3 top-3 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-md ring-1 ring-slate-200/90 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ color: accent }}
          title={labels.useGps}
          aria-label={labels.useGps}
        >
          <Crosshair className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {mapError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {mapError}
        </p>
      ) : null}

      {coords && hasPin ? (
        <p className="text-[11px] font-medium tabular-nums text-slate-500" dir="ltr">
          {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
        </p>
      ) : null}
    </div>
  )
}
