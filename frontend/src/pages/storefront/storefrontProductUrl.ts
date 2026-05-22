const PARAM = 'product'

export function readProductIdFromUrl(): number | null {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get(PARAM)
  if (!raw) return null
  const id = Number.parseInt(raw, 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

export function setProductUrlParam(productId: number | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (productId == null) url.searchParams.delete(PARAM)
  else url.searchParams.set(PARAM, String(productId))
  const next = `${url.pathname}${url.search}${url.hash}`
  window.history.replaceState(window.history.state, '', next)
}

export function buildProductShareUrl(productId: number): string {
  if (typeof window === 'undefined') return ''
  const url = new URL(window.location.href)
  url.searchParams.set(PARAM, String(productId))
  return url.toString()
}
