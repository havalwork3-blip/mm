import { stripMapsUrlFromAddress } from './storefrontOrderReceipt'

export type ParsedOrderAddress = {
  /** Address text for display (no maps URL / pin line). */
  displayText: string
  mapsUrl: string | null
  coordsText: string | null
  /** Best string to copy (maps link, then coords, then plain address). */
  copyText: string
}

export function parseOrderAddressLocation(raw: string): ParsedOrderAddress {
  const source = (raw || '').trim()
  const mapsMatch = source.match(/https?:\/\/(?:www\.)?google\.com\/maps[^\s]*/i)
  const mapsUrl = mapsMatch?.[0]?.trim() ?? null

  const pinMatch = source.match(/📍\s*([-\d.]+)\s*,\s*([-\d.]+)/)
  const coordMatch = source.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/)
  let coordsText: string | null = null
  if (pinMatch) {
    coordsText = `${pinMatch[1]}, ${pinMatch[2]}`
  } else if (coordMatch) {
    coordsText = `${coordMatch[1]}, ${coordMatch[2]}`
  }

  const displayText = stripMapsUrlFromAddress(source)
  const copyText = mapsUrl || coordsText || displayText

  return { displayText, mapsUrl, coordsText, copyText }
}
