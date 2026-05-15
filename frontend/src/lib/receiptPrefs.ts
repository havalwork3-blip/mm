import type { ReceiptSettingsRow } from '../types/api'

const SHOW_IQD_ON_PDF_KEY_PREFIX = 'receipt_show_iqd_on_pdf_'

function getKey(shopId: number) {
  return `${SHOW_IQD_ON_PDF_KEY_PREFIX}${shopId}`
}

export function getShowIqdOnPdf(shopId: number): boolean {
  try {
    const raw = localStorage.getItem(getKey(shopId))
    if (raw === null) return true
    return raw === 'true'
  } catch {
    return true
  }
}

export function setShowIqdOnPdf(shopId: number, enabled: boolean): void {
  try {
    localStorage.setItem(getKey(shopId), enabled ? 'true' : 'false')
  } catch {
    // ignore storage errors
  }
}

export function withReceiptPrefs(settings: ReceiptSettingsRow): ReceiptSettingsRow {
  return {
    ...settings,
    show_iqd_on_pdf: getShowIqdOnPdf(settings.shop),
  }
}
