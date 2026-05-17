/** Turn Django HTML / debug pages into a short user-facing API error message. */
export function sanitizeApiErrorText(raw: string, status: number): string {
  const text = raw.trim()
  if (!text) return `HTTP ${status}`

  const looksLikeHtml =
    text.startsWith('<!DOCTYPE') ||
    text.startsWith('<html') ||
    text.includes('<html') ||
    text.includes('django.debug')

  if (looksLikeHtml || text.includes('DEBUG = True') || text.includes('DJANGO_DEBUG')) {
    if (/DisallowedHost/i.test(text)) {
      return 'Host not allowed by the server (check ALLOWED_HOSTS).'
    }
    if (status === 404) {
      return 'Not found.'
    }
    if (status === 403) {
      return 'Permission denied.'
    }
    if (status === 401) {
      return 'Not signed in or session expired.'
    }
    return 'Server error. If this continues, check that the backend is running and try again.'
  }

  if (text.length > 400) {
    return `${text.slice(0, 400)}…`
  }
  return text
}
