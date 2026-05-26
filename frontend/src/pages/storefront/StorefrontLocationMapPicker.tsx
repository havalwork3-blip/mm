import L from 'leaflet'
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
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
  locating: string
  locationUnavailable: string
}

type Props = {
  coords: GeoCoords | null
  onCoordsChange: (coords: GeoCoords, resolvedLabel?: string | null) => void
  accent: string
  disabled?: boolean
  labels: Labels
}

export function StorefrontLocationMapPicker({
  coords,
  onCoordsChange,
  accent,
  disabled = false,
  labels,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const resolvingRef = useRef(false)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  const [localCoords, setLocalCoords] = useState<GeoCoords | null>(coords)
  const [resolving, setResolving] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [hasPin, setHasPin] = useState(Boolean(coords))

  const applyCoords = useCallback(async (next: GeoCoords) => {
    if (resolvingRef.current) return
    resolvingRef.current = true
    setResolving(true)
    setMapError(null)
    try {
      const label = await reverseGeocodeAddress(next, 'en')
      onCoordsChange(next, label)
      setLocalCoords(next)
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
  }, [labels.locationUnavailable, onCoordsChange])

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    const initial = coords ?? DEFAULT_CENTER
    const zoom = coords ? PIN_ZOOM : DEFAULT_ZOOM

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

    if (coords) {
      const marker = L.marker([coords.lat, coords.lon], { draggable: !disabledRef.current })
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
    if (!coords) return
    setLocalCoords(coords)
    setHasPin(true)
    const map = mapRef.current
    if (!map) return
    if (markerRef.current) {
      markerRef.current.setLatLng([coords.lat, coords.lon])
    } else {
      const marker = L.marker([coords.lat, coords.lon], { draggable: !disabledRef.current })
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        void applyCoords({ lat: pos.lat, lon: pos.lng })
      })
      marker.addTo(map)
      markerRef.current = marker
    }
    map.setView([coords.lat, coords.lon], PIN_ZOOM, { animate: false })
  }, [coords, applyCoords])

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
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/60 border-t-white" aria-hidden />
              {labels.locating}
            </span>
          </div>
        ) : null}
      </div>

      {mapError ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {mapError}
        </p>
      ) : null}

      {localCoords && hasPin ? (
        <p className="text-[11px] font-medium tabular-nums text-slate-500" dir="ltr">
          {localCoords.lat.toFixed(5)}, {localCoords.lon.toFixed(5)}
        </p>
      ) : null}
    </div>
  )
}
