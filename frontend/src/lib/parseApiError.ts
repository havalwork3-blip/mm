/** Flatten Django REST Framework error JSON into a user-visible message. */
export function parseApiErrorBody(j: Record<string, unknown>, fallback: string): string {
  if (j.detail !== undefined) {
    const d = j.detail
    if (typeof d === 'string') return d
    if (Array.isArray(d)) return d.map(String).join(' ')
    return String(d)
  }
  const parts: string[] = []
  for (const [k, v] of Object.entries(j)) {
    if (k === 'detail') continue
    if (Array.isArray(v)) {
      parts.push(`${k}: ${v.map(String).join(', ')}`)
    } else if (typeof v === 'object' && v !== null) {
      parts.push(`${k}: ${JSON.stringify(v)}`)
    } else if (v != null) {
      parts.push(`${k}: ${String(v)}`)
    }
  }
  return parts.length ? parts.join(' · ') : fallback
}
