import QRCode from 'qrcode'

import { formatDecimalTrim } from './formatMoney'
import { formatSaleReceiptNumber } from './shopReceiptNumbers'
import type { ReceiptSettingsRow, SaleListRow } from '../types/api'

export type ReceiptSummary = {
  subtotalUsd: number
  discountUsd: number
  finalUsd: number
  finalIqd: number | null
  paidUsdEq: number
  balanceUsd: number
}

function parseDec(s: string): number {
  const n = parseFloat(s)
  return Number.isNaN(n) ? 0 : n
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** HTML-escape a string for use in double-quoted attribute values. */
function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/'/g, '&#39;')
}

const RECEIPT_QR_MAX_LEN = 2000
const RECEIPT_QR_CAPTION_MAX = 500
const BLANK_RECEIPT_ROWS = 15

/**
 * QR image (PNG data URL) + optional caption; all generated locally.
 */
export async function buildReceiptQrBlock(
  receiptSettings: ReceiptSettingsRow | null | undefined,
): Promise<string> {
  const raw = (receiptSettings?.receipt_qr_url ?? '').trim()
  if (!raw || raw.length > RECEIPT_QR_MAX_LEN) return ''
  let caption = (receiptSettings?.receipt_qr_caption ?? '').trim()
  if (caption.length > RECEIPT_QR_CAPTION_MAX) {
    caption = caption.slice(0, RECEIPT_QR_CAPTION_MAX)
  }
  try {
    const dataUrl = await QRCode.toDataURL(raw, {
      width: 96,
      margin: 0,
      errorCorrectionLevel: 'M',
    })
    const captionHtml = caption
      ? `<div class="receipt-qr__caption-wrap">
          <p class="receipt-qr__caption">${escapeHtml(caption).replace(/\n/g, '<br/>')}</p>
        </div>`
      : ''
    return `<div class="receipt-qr">
      ${captionHtml}
      <a href="${escapeHtmlAttr(raw)}" target="_blank" rel="noopener noreferrer" class="receipt-qr__link">
        <img class="receipt-qr__img" src="${dataUrl}" alt="" />
      </a>
    </div>`
  } catch {
    return ''
  }
}

/** USD / USD-equivalent on receipt: up to 2 decimals, no trailing zeros or lone dot. */
function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return formatDecimalTrim(n, 2)
}

/** IQD on receipt: whole dinars only (no fractional part after the decimal). */
function fmtIqd(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return formatDecimalTrim(n, 0)
}

export function computeReceiptSummaryFromSale(sale: SaleListRow): ReceiptSummary {
  const subtotalUsd = sale.lines.reduce((acc, ln) => {
    const q = Number(ln.quantity)
    const p = parseFloat(String(ln.unit_price_usd))
    if (Number.isNaN(q) || Number.isNaN(p)) return acc
    return acc + q * p
  }, 0)
  const discountUsd = parseFloat(String(sale.invoice_discount_usd)) || 0
  const finalUsd = Math.max(0, subtotalUsd - discountUsd)
  const rate = parseFloat(String(sale.exchange_rate_usd_to_iqd))
  const finalIqd = Number.isFinite(rate) && rate > 0 ? finalUsd * rate : null
  const paidUsd = parseFloat(String(sale.amount_paid_usd)) || 0
  const paidIqd = parseFloat(String(sale.amount_paid_iqd)) || 0
  const paidUsdEq =
    Number.isFinite(rate) && rate > 0 ? paidUsd + paidIqd / rate : paidUsd
  const balanceUsd = finalUsd - paidUsdEq
  return {
    subtotalUsd,
    discountUsd,
    finalUsd,
    finalIqd,
    paidUsdEq,
    balanceUsd,
  }
}

function returnedQtyLabel(lines: SaleListRow['lines']): string {
  const parts = lines
    .filter((ln) => Number(ln.returned_quantity ?? 0) > 0)
    .map((ln) => {
      const name = String(ln.product_name || ln.manual_name || '').trim()
      if (!name) return ''
      return `${name} ×${Number(ln.returned_quantity ?? 0)}`
    })
    .filter(Boolean)
  return parts.join(' · ')
}

export async function buildReceiptHtml(args: {
  sale: Record<string, unknown>
  sum: ReceiptSummary
  receiptSettings: ReceiptSettingsRow | null
  customerNameDisplay: string
  blankMode?: boolean
  /** Larger type & sheet width when shown in an on-screen iframe (modal preview). */
  forScreenPreview?: boolean
}): Promise<string> {
  const { sale, sum, receiptSettings, customerNameDisplay, blankMode = false, forScreenPreview } = args
  if (!sale || !sum) return ''
  const receiptQrBlock = await buildReceiptQrBlock(receiptSettings)

    // Keep browser receipts consistent and readable: always render A4 layout.
    const useA4 = true
    const rateVal = Number(sale.exchange_rate_usd_to_iqd ?? 0)
    const showIqdOnPdf = receiptSettings?.show_iqd_on_pdf !== false
    const paidIqdRaw = parseDec(String(sale.amount_paid_iqd ?? '0'))
    const finalIqdText =
      showIqdOnPdf && Number.isFinite(rateVal) && rateVal > 0 && sum.finalIqd !== null
        ? fmtIqd(sum.finalIqd)
        : ''
    const balanceIqdText =
      showIqdOnPdf && Number.isFinite(rateVal) && rateVal > 0
        ? fmtIqd(sum.balanceUsd * rateVal)
        : ''
    const paidIqdText = showIqdOnPdf ? fmtIqd(paidIqdRaw) : ''

    const rawLines = blankMode
      ? Array.from({ length: BLANK_RECEIPT_ROWS }, (_, idx) => ({
          id: -(idx + 1),
          product: null,
          manual_name: '',
          product_name: '\u00A0',
          quantity: 0,
          unit_price_usd: '0',
          unit_buy_price_usd: '0',
          returned_quantity: 0,
        }))
      : ((sale.lines as Array<Record<string, unknown>>) ?? []).slice()
    const lines = rawLines
      .map((ln, idx) => {
        const name = escapeHtml(
          String(
            ln.product_name ??
              ln.manual_name ??
              `#${String(ln.product ?? '')}`,
          ),
        )
        const qty = Number(ln.quantity ?? 0)
        const price = String(ln.unit_price_usd ?? '0')
        const priceDisplay = formatDecimalTrim(price, 4)
        const total = fmtUsd(qty * parseDec(price))
        const retQty = Number(ln.returned_quantity ?? 0)
        const returnedHint = retQty > 0 ? `<br/><small style="color:#047857;font-weight:700">گەڕاوە: ${retQty}</small>` : ''
        return `<tr>
        <td class="cell-idx"><span class="cell-pad">${idx + 1}</span></td>
        <td class="col-name"><span class="cell-pad cell-name-text">${name}${returnedHint}</span></td>
        <td class="num cell-qty"><span class="cell-pad">${blankMode ? '' : qty}</span></td>
        <td class="num cell-price"><span class="cell-pad">${blankMode ? '' : escapeHtml(priceDisplay)}</span></td>
        <td class="num cell-line-total"><span class="cell-pad">${blankMode ? '' : total}</span></td>
      </tr>`
      })
      .join('')
    const returnedSummary = returnedQtyLabel((sale.lines as SaleListRow['lines']) ?? [])

    const logo = receiptSettings?.logo_url
      ? `<img src="${receiptSettings.logo_url}" alt="" class="logo-img" />`
      : '<div class="logo-placeholder" aria-hidden="true">M&amp;M</div>'
    const shopEn = escapeHtml(receiptSettings?.shop_name_en || '')
    const shopKu = escapeHtml(receiptSettings?.shop_name_ku || '')
    const sub = escapeHtml(
      receiptSettings?.sub_title || 'بۆ بازرگانی مۆبایل و پێداویستییەکانی',
    )
    const footer = escapeHtml(
      receiptSettings?.footer_note || 'هەڵە و سەهوو دەگەڕێتەوە بۆ هەردوولا',
    )
    const shopAddress = escapeHtml((receiptSettings?.address ?? '').trim())
    const sigShopNameBlock =
      shopKu || shopEn
        ? `<div class="sig-shop-name">
          ${shopKu ? `<div class="sig-shop-name__ku">${shopKu}</div>` : ''}
          ${shopEn ? `<div class="sig-shop-name__en">${shopEn}</div>` : ''}
        </div>`
        : ''
    const customerPhone = escapeHtml(String(sale.customer_phone ?? ''))
    const customerAddress = escapeHtml(String(sale.customer_address ?? ''))
    const customerNameDisp = escapeHtml(customerNameDisplay || '')
    const previousDebt = blankMode ? '' : fmtUsd(parseDec(String(sale.previous_debt_usd ?? '0')))
    const showCustomerBalance = receiptSettings?.show_customer_balance ?? true
    const rawInvoiceId = formatSaleReceiptNumber(sale.receipt_number)
    const invoiceNumeric = Number.parseInt(rawInvoiceId, 10)
    const invoiceDisplay = Number.isFinite(invoiceNumeric) && invoiceNumeric > 0
      ? invoiceNumeric.toLocaleString('en-US')
      : rawInvoiceId || ''
    const occurredAt = sale.occurred_at ? new Date(String(sale.occurred_at)) : null
    const occurred = blankMode ? '' : occurredAt ? occurredAt.toLocaleString() : ''
    const dueDate = occurredAt
      ? new Date(occurredAt.getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
      : ''

    const debtBlock = showCustomerBalance
      ? `<div class="tot-row"><span>قەرزی کۆن (USD)</span><span class="num">${previousDebt}</span></div>`
      : ''

    const a4Styles = `
        @page { size: A4 portrait; margin: 8mm; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          color: #0f172a;
          background: #f1f5f9;
          font-family: 'Segoe UI', Tahoma, Arial, 'Noto Sans Arabic', sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .sheet {
          width: 100%;
          max-width: 195mm;
          margin: 0 auto;
          padding: 8px 0;
          min-height: 281mm;
          display: flex;
        }
        .receipt {
          width: 100%;
          border: 0;
          border-radius: 14px;
          overflow: hidden;
          background: #fff;
          font-size: 11px;
          line-height: 1.35;
          box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
          direction: rtl;
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }
        .invoice-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 16px 18px;
          background: #fff;
          color: #0f172a;
          border-bottom: 1px solid #e5e7eb;
        }
        .invoice-hero__brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .invoice-hero__badge { text-align: end; min-width: 220px; }
        .invoice-hero__badge-ku {
          margin: 0;
          font-size: 34px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: 0.02em;
          color: #f59e0b;
        }
        .invoice-hero__badge-en {
          margin: 2px 0 0;
          font-size: 12px;
          color: #334155;
          font-weight: 600;
        }
        .invoice-hero__badge-id {
          margin: 4px 0 0;
          font-size: 12px;
          color: #334155;
          font-weight: 700;
        }
        .logo-img,
        .logo-placeholder {
          width: 96px;
          height: 96px;
          border-radius: 18px;
          border: 0;
          flex-shrink: 0;
          box-shadow: none;
        }
        .logo-img { object-fit: cover; }
        .logo-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          color: #334155;
          font-size: 18px;
          font-weight: 800;
        }
        .receipt-titles h1 {
          margin: 0;
          font-size: 22px;
          line-height: 1.05;
          color: #0f172a;
          font-weight: 900;
        }
        .receipt-titles .en {
          margin: 3px 0 0;
          font-size: 11px;
          color: #475569;
          font-weight: 600;
        }
        .receipt-titles .tag {
          margin: 3px 0 0;
          font-size: 10px;
          color: #64748b;
        }
        .receipt-titles .shop-addr {
          margin: 8px 0 0;
          font-size: 10px;
          line-height: 1.45;
          color: #334155;
          font-weight: 600;
          white-space: pre-wrap;
        }
        .receipt-body { padding: 16px 18px 18px; flex: 1; }
        .receipt-header,
        .receipt-address,
        .receipt-meta,
        .section-title,
        .receipt-table-wrap,
        .receipt-totals,
        .receipt-extra,
        .receipt-bottom { margin-inline: 0; }
        .receipt-header { padding-top: 10px; }
        .receipt-contact {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          font-size: 10px;
          color: #334155;
          font-weight: 500;
        }
        .receipt-address {
          margin-top: 8px;
          padding: 9px 10px;
          border: 1px solid #dbe3ef;
          border-radius: 8px;
          font-size: 10px;
          color: #475569;
        }
        .receipt-meta {
          margin-top: 14px;
          margin-bottom: 10px;
          padding: 12px;
          border: 1px solid #dbe3ef;
          border-radius: 10px;
          background: #f8fafc;
          color: #111827;
        }
        .meta-line {
          display: grid;
          gap: 14px;
          align-items: start;
        }
        .meta-line:not(.meta-line--with-qr) {
          grid-template-columns: 1fr 1fr;
        }
        .meta-line--with-qr {
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
        }
        .meta-line__qr {
          grid-column: 2;
          justify-self: center;
          align-self: center;
        }
        .meta-line__qr .receipt-qr {
          margin: 0 auto;
          text-align: center;
          width: fit-content;
          max-width: 110px;
        }
        .meta-item { white-space: nowrap; font-size: 10px; }
        .party-card {
          border: 0;
          border-radius: 0;
          padding: 0;
          background: transparent;
          min-height: 0;
        }
        .party-card--customer {
          grid-column: 1;
          justify-self: start;
          text-align: left;
          direction: ltr;
        }
        .party-card--meta {
          grid-column: 2;
          justify-self: end;
          text-align: right;
          direction: rtl;
        }
        .meta-line--with-qr .party-card--meta {
          grid-column: 3;
        }
        .party-card h3 {
          margin: 0 0 6px;
          font-size: 11px;
          color: #1f2937;
          letter-spacing: 0.02em;
        }
        .party-card p {
          margin: 0 0 2px;
          font-size: 10px;
          color: #475569;
        }
        .meta-item strong {
          color: #6b7280;
          font-weight: 600;
          margin-inline-end: 6px;
        }
        .invoice-dates {
          text-align: end;
          margin-top: 8px;
        }
        .invoice-dates .label {
          color: #6b7280;
          font-size: 10px;
        }
        .section-title {
          margin-top: 6px;
          margin-bottom: 4px;
          font-size: 10px;
          font-weight: 700;
          color: #6b7280;
          letter-spacing: 0.04em;
        }
        .receipt-table-wrap {
          border: 1px solid #dbe3ef;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        table.receipt-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        .receipt-table col.col-idx { width: 7%; }
        .receipt-table col.col-name { width: 45%; }
        .receipt-table col.col-qty { width: 12%; }
        .receipt-table col.col-price { width: 18%; }
        .receipt-table col.col-total { width: 18%; }
        .receipt-table th,
        .receipt-table td { border: 1px solid #e5e7eb; padding: 0; }
        .receipt-table th {
          background: #e2e8f0;
          color: #1f2937;
          font-size: 10px;
          font-weight: 700;
        }
        .receipt-table th .th-inner { display: block; padding: 7px 6px; }
        .cell-pad { display: block; padding: 6px; }
        .receipt-table .col-name { text-align: start; }
        .receipt-table .num { text-align: end; font-variant-numeric: tabular-nums; }
        .cell-idx { text-align: center; color: #475569; }
        .receipt-extra {
          margin-bottom: 10px;
          color: #334155;
          font-size: 10px;
          padding: 8px 10px;
          border-radius: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .receipt-extra__line {
          margin: 0;
          line-height: 1.5;
        }
        .receipt-extra__line + .receipt-extra__line {
          margin-top: 6px;
          padding-top: 6px;
          border-top: 1px dashed #cbd5e1;
        }
        .receipt-totals {
          margin-bottom: 10px;
          margin-left: auto;
          width: min(54%, 320px);
          border: 1px solid #dbe3ef;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 1px 0 #f3f4f6 inset;
        }
        .receipt-totals .tot-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          padding: 6px 10px;
          border-bottom: 1px solid #e5e7eb;
          background: #fff;
          font-size: 10px;
        }
        .receipt-totals .tot-row:last-child { border-bottom: 0; }
        .receipt-totals .num {
          font-variant-numeric: tabular-nums;
          font-weight: 700;
          text-align: end;
          min-width: 96px;
        }
        .tot-row--strong {
          background: #fff !important;
          border-top: 1px solid #e5e7eb;
        }
        .tot-row--strong .num {
          color: #f59e0b !important;
          font-size: 28px;
          line-height: 1.1;
          font-weight: 900;
        }
        .tot-row--muted { background: #f9fafb !important; }
        .tot-row--balance { background: #f8fafc !important; }
        .tot-row--balance .num { color: #b91c1c; }
        .receipt-bottom {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 16px;
        }
        /* Compact QR: one edge, minimal ink — see thermal/blank for sizes */
        .receipt-qr {
          margin: 4px 0 8px;
          text-align: start;
          width: fit-content;
          max-width: 110px;
        }
        .receipt-qr__caption-wrap {
          margin: 0 0 3px;
        }
        .receipt-qr__caption {
          margin: 0;
          font-size: 9px;
          line-height: 1.25;
          color: #334155;
          font-weight: 600;
        }
        .receipt-qr__link {
          display: inline-block;
          line-height: 0;
          vertical-align: top;
        }
        .receipt-qr__img {
          display: block;
          width: 88px;
          height: 88px;
          margin: 0;
          border: 0;
          padding: 0;
          background: transparent;
        }
        .sig {
          display: block;
          min-width: 200px;
          text-align: end;
          color: #6b7280;
          font-size: 10px;
        }
        .sig-shop-name {
          margin-bottom: 8px;
          color: #0f172a;
        }
        .sig-shop-name__ku {
          font-size: 16px;
          font-weight: 900;
          line-height: 1.2;
        }
        .sig-shop-name__en {
          margin-top: 2px;
          font-size: 12px;
          font-weight: 700;
          color: #334155;
        }
        .sig .line {
          border-top: 1px solid #9ca3af;
          width: 140px;
          margin-inline-start: auto;
          margin-bottom: 4px;
        }
        .receipt-footer {
          margin: 0;
          padding: 8px 14px;
          text-align: center;
          font-size: 10px;
          font-weight: 600;
          color: #0f172a;
          background: #e2e8f0;
          border-top: 1px solid #cbd5e1;
        }
    `

    const thermalStyles = `
        @page { size: 80mm auto; margin: 3mm; }
        * { box-sizing: border-box; }
        html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: system-ui, sans-serif; margin: 0; color: #111; background: #fff; }
        .sheet { width: 100%; max-width: 72mm; margin: 0 auto; }
        .receipt { width: 100%; border: 1px solid #334155; border-radius: 2px; font-size: 10px; line-height: 1.35; overflow: hidden; }
        .invoice-hero { display: flex; flex-direction: column; background: #312e81; color: #fff; }
        .invoice-hero__brand { display: flex; align-items: center; gap: 8px; padding: 8px; }
        .invoice-hero__badge { padding: 6px; text-align: center; border-top: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.15); }
        .invoice-hero__badge-ku { margin: 0; font-size: 11px; font-weight: 800; }
        .invoice-hero__badge-en { margin: 2px 0 0; font-size: 7px; opacity: 0.85; letter-spacing: 0.06em; }
        .logo-img { width: 40px; height: 40px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.35); }
        .logo-placeholder { width: 40px; height: 40px; border-radius: 8px; background: rgba(255,255,255,0.15); color: #fff; font-size: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; }
        .receipt-titles h1 { margin: 0; font-size: 12px; font-weight: 800; }
        .receipt-titles .en { margin: 0; font-size: 9px; color: #e0e7ff; }
        .receipt-titles .tag { margin: 2px 0 0; font-size: 8px; color: #c7d2fe; }
        .receipt-titles .shop-addr { margin: 4px 0 0; font-size: 7px; line-height: 1.35; color: #e0e7ff; font-weight: 600; white-space: pre-wrap; }
        .receipt-header { padding: 6px 8px; background: #f8fafc; border-bottom: 1px solid #cbd5e1; }
        .receipt-contact { font-size: 8px; color: #334155; line-height: 1.5; }
        .receipt-address { margin: 6px 8px; padding: 6px; font-size: 8px; border: 1px dashed #94a3b8; border-radius: 4px; }
        .receipt-meta { margin: 8px; }
        .meta-line {
          display: grid;
          gap: 6px;
          align-items: start;
        }
        .meta-line:not(.meta-line--with-qr) {
          grid-template-columns: 1fr 1fr;
        }
        .meta-line--with-qr {
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
        }
        .meta-line__qr {
          grid-column: 2;
          justify-self: center;
          align-self: center;
        }
        .meta-line__qr .receipt-qr {
          margin: 0 auto;
          text-align: center;
          width: fit-content;
          max-width: 52mm;
        }
        .party-card--meta {
          grid-column: 2;
        }
        .meta-line--with-qr .party-card--meta {
          grid-column: 3;
        }
        .meta-card { padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 4px; border-inline-start: 3px solid #6366f1; background: #fff; }
        .meta-label { font-size: 7px; font-weight: 700; color: #64748b; margin-bottom: 2px; }
        .meta-value { font-size: 9px; font-weight: 700; word-break: break-word; }
        .section-title { margin: 0 8px 4px; font-size: 7px; font-weight: 800; letter-spacing: 0.06em; color: #64748b; }
        .receipt-table-wrap { margin: 0 8px 8px; border: 1px solid #334155; border-radius: 2px; overflow: hidden; }
        table.receipt-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 8px; }
        .receipt-table col.col-idx { width: 8%; }
        .receipt-table col.col-name { width: 34%; }
        .receipt-table col.col-qty { width: 12%; }
        .receipt-table col.col-price { width: 22%; }
        .receipt-table col.col-total { width: 24%; }
        .receipt-table thead { background: #1e293b; color: #fff; }
        .receipt-table th { border: 1px solid #0f172a; padding: 0; font-size: 7px; font-weight: 800; }
        .receipt-table th .th-inner { display: block; padding: 5px 2px; }
        .receipt-table td { border: 1px solid #cbd5e1; padding: 0; }
        .cell-pad { padding: 4px 2px; font-size: 8px; }
        .receipt-table tbody tr:nth-child(odd) td { background: #f8fafc; }
        .receipt-table .col-name { text-align: start; }
        .cell-name-text { font-weight: 600; }
        .receipt-table .num { text-align: end; font-variant-numeric: tabular-nums; font-weight: 600; }
        .cell-idx {
          text-align: center;
          color: #64748b;
          font-weight: 700;
          direction: ltr;
          unicode-bidi: isolate;
        }
        .cell-idx .cell-pad {
          display: block;
          min-height: 22px; 
          line-height: 2.5;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0;
        }
        .receipt-totals { margin: 0 8px 8px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; }
        .receipt-totals .tot-row { display: flex; justify-content: space-between; padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 9px; background: #fff; }
        .receipt-totals .tot-row:last-child { border-bottom: 0; }
        .receipt-totals .num { font-variant-numeric: tabular-nums; font-weight: 700; min-width: 4.5rem; text-align: end; }
        .tot-row--strong { background: #eef2ff !important; font-weight: 800; }
        .tot-row--strong .num { font-size: 10px; color: #1e1b4b; }
        .tot-row--balance .num { color: #b91c1c; }
        .tot-row--muted { background: #f8fafc !important; }
        .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 0 8px 8px; }
        .sig .box { padding: 12px 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 8px; font-weight: 600; color: #64748b; text-align: center; }
        .sig .box::before {
          content: '';
          display: block;
          width: 80%;
          margin: 0 auto 8px;
          border-top: 1px dashed #94a3b8;
        }
        .receipt-footer { padding: 8px; font-size: 8px; font-weight: 600; text-align: center; color: #4338ca; background: #f5f3ff; border-top: 1px solid #c4b5fd; }
        .receipt-qr { margin: 2px 8px 6px; text-align: start; width: fit-content; max-width: 52mm; }
        .receipt-qr__caption-wrap { margin: 0 0 2px; }
        .receipt-qr__caption { margin: 0; font-size: 7px; line-height: 1.25; color: #334155; font-weight: 600; }
        .receipt-qr__link { display: inline-block; line-height: 0; vertical-align: top; }
        .receipt-qr__img { display: block; width: 72px; height: 72px; margin: 0; border: 0; padding: 0; background: transparent; }
    `

    const styles = useA4 ? a4Styles : thermalStyles

    const blankModeCss = blankMode
      ? `<style>
    @media print, screen {
      .sheet {
        min-height: auto !important;
        padding: 0 !important;
      }
      body {
        background: #fff !important;
      }
      .receipt {
        min-height: auto !important;
      }
      .receipt-body {
        flex: 0 0 auto !important;
        padding: 10px 12px 12px !important;
      }
      .invoice-hero {
        padding: 10px 12px !important;
      }
      .invoice-hero__badge-ku {
        font-size: 26px !important;
      }
      .logo-img,
      .logo-placeholder {
        width: 78px !important;
        height: 78px !important;
      }
      .receipt-titles h1 {
        font-size: 18px !important;
      }
      .receipt-titles .shop-addr,
      .receipt-titles .tag,
      .receipt-meta,
      .party-card h3,
      .party-card p,
      .section-title,
      table.receipt-table,
      .receipt-extra,
      .receipt-totals .tot-row,
      .sig,
      .receipt-footer {
        font-size: 9px !important;
      }
      .receipt-meta {
        margin-top: 8px !important;
        margin-bottom: 8px !important;
        padding: 8px !important;
      }
      .section-title {
        margin-top: 4px !important;
        margin-bottom: 3px !important;
      }
      .receipt-table-wrap {
        margin-bottom: 8px !important;
      }
      .receipt-table th .th-inner {
        padding: 5px 4px !important;
      }
      .receipt-table {
        border-collapse: separate !important;
        border-spacing: 0 !important;
      }
      .receipt-table tbody tr td {
        height: 32px !important;
        vertical-align: middle !important;
        border-bottom: 1px solid #cbd5e1 !important;
        border-inline-end: 1px solid #cbd5e1 !important;
      }
      .receipt-table tbody tr td:first-child {
        border-inline-start: 1px solid #cbd5e1 !important;
      }
      .receipt-table tbody tr:first-child td {
        border-top: 1px solid #cbd5e1 !important;
      }
      .cell-pad {
        padding: 4px !important;
      }
      .cell-idx .cell-pad {
        line-height: 1 !important;
        padding-top: 2px !important;
        padding-bottom: 2px !important;
        font-variant-numeric: tabular-nums !important;
        white-space: nowrap !important;
      }
      .receipt-extra {
        margin-bottom: 8px !important;
        padding: 6px 8px !important;
      }
      .receipt-totals {
        margin-bottom: 8px !important;
        width: min(50%, 280px) !important;
      }
      .receipt-totals .tot-row {
        padding: 5px 8px !important;
      }
      .receipt-bottom {
        margin-bottom: 6px !important;
      }
      .sig {
        min-width: 150px !important;
      }
      .sig .line {
        width: 110px !important;
      }
      .receipt-footer {
        padding: 6px 10px !important;
      }
    }
  </style>`
      : ''

    const screenPreviewCss = forScreenPreview
      ? `<style>
    @media screen {
      html { font-size: 18px; }
      body { background: #cbd5e1 !important; padding: 12px !important; }
      .sheet {
        max-width: min(100%, 52rem) !important;
        width: 100% !important;
        min-height: auto !important;
        margin: 0 auto !important;
      }
      .receipt { font-size: 1.05rem !important; line-height: 1.5 !important; }
      table.receipt-table { font-size: 0.95rem !important; }
      .receipt-totals .tot-row { font-size: 0.95rem !important; }
      .meta-value { font-size: 1rem !important; }
    }
  </style>`
      : ''

    return `<!doctype html><html dir="rtl" lang="ku"><head><meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>${styles}</style>${blankModeCss}${screenPreviewCss}</head><body>
      <div class="sheet">
      <div class="receipt receipt--${useA4 ? 'a4' : 'thermal'}">
        <div class="invoice-hero">
          <div class="invoice-hero__brand">
            ${logo}
            <div class="receipt-titles">
              <p class="tag">${sub}</p>
              ${shopAddress ? `<p class="shop-addr" dir="auto">${shopAddress}</p>` : ''}
            </div>
          </div>
          <div class="invoice-hero__badge">
            <p class="invoice-hero__badge-ku">INVOICE</p>
            <p class="invoice-hero__badge-en">پسوولەی فرۆشتن</p>
            <p class="invoice-hero__badge-id">[ ژمارە: ${invoiceDisplay} ]</p>
          </div>
        </div>
        <div class="receipt-body">
        <div class="receipt-meta">
          <div class="meta-line${receiptQrBlock ? ' meta-line--with-qr' : ''}">
            <div class="party-card party-card--customer">
              <h3>زانیاری کریار</h3>
              <p><strong>بۆ بەرزێز ${customerNameDisp}</strong></p>
              <p>ژمارەی مۆبایل ${customerPhone}</p>
              <p>ناونیشان ${customerAddress}</p>
            </div>
            ${receiptQrBlock ? `<div class="meta-line__qr">${receiptQrBlock}</div>` : ''}
            <div class="party-card party-card--meta">
              <h3>زانیاری پسوولە</h3>
              <p><strong>ژمارەی پسوولە:</strong> ${invoiceDisplay}</p>
              <p><strong>بەرواری پسوولە:</strong> ${escapeHtml(occurred)}</p>
              <p><strong>دوا بەرواری پارەدان:</strong> ${escapeHtml(blankMode ? '' : dueDate)}</p>
            </div>
          </div>
        </div>
        <p class="section-title">وردەکاری کاڵاکان</p>
        <div class="receipt-table-wrap">
          <table class="receipt-table">
            <colgroup>
              <col class="col-idx" />
              <col class="col-name" />
              <col class="col-qty" />
              <col class="col-price" />
              <col class="col-total" />
            </colgroup>
            <thead><tr>
              <th scope="col"><span class="th-inner">#</span></th>
              <th scope="col"><span class="th-inner">کاڵا</span></th>
              <th scope="col"><span class="th-inner">دانە</span></th>
              <th scope="col"><span class="th-inner">نرخ (USD)</span></th>
              <th scope="col"><span class="th-inner">کۆ (USD)</span></th>
            </tr></thead>
            <tbody>${lines}</tbody>
          </table>
        </div>
        ${
          sale.note || returnedSummary
            ? `<div class="receipt-extra">
          ${sale.note ? `<p class="receipt-extra__line"><strong>تێبینی:</strong> ${escapeHtml(String(sale.note))}</p>` : ''}
          ${returnedSummary ? `<p class="receipt-extra__line"><strong>کاڵای گەڕاوە:</strong> ${escapeHtml(returnedSummary)}</p>` : ''}
        </div>`
            : ''
        }
        <div class="receipt-totals">
          <div class="tot-row"><span>داشکاندن (USD)</span><span class="num">${blankMode ? '' : fmtUsd(sum.discountUsd)}</span></div>
          <div class="tot-row"><span>کۆی پارەی وەرگیراو (USD)</span><span class="num">${blankMode ? '' : fmtUsd(sum.paidUsdEq)}</span></div>
          ${showIqdOnPdf ? `<div class="tot-row tot-row--muted"><span>کۆی پارەی وەرگیراو (IQD)</span><span class="num">${blankMode ? '' : paidIqdText}</span></div>` : ''}
          ${debtBlock}
          <div class="tot-row tot-row--balance"><span>پارەی ماوە (USD)</span><span class="num">${blankMode ? '' : fmtUsd(sum.balanceUsd)}</span></div>
          ${showIqdOnPdf ? `<div class="tot-row tot-row--muted"><span>پارەی ماوە (IQD)</span><span class="num">${blankMode ? '' : balanceIqdText}</span></div>` : ''}
          ${showIqdOnPdf ? `<div class="tot-row tot-row--muted"><span>کۆی گشتی پسوولە (IQD)</span><span class="num">${blankMode ? '' : finalIqdText}</span></div>` : ''}
          <div class="tot-row tot-row--strong"><span>کۆی گشتی پسوولە (USD)</span><span class="num">${blankMode ? '' : fmtUsd(sum.finalUsd)}</span></div>
        </div>
        <div class="receipt-bottom">
          <div></div>
          <div class="sig">
            ${sigShopNameBlock}
            <div class="line"></div>
            <div>واژووی بەرپرسی فرۆشتن</div>
          </div>
        </div>
        </div>
        <footer class="receipt-footer">${footer}</footer>
      </div>
      </div></body></html>`
}

export function printReceiptHtml(html: string): void {
  if (!html) return
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentWindow?.document
  if (!doc || !iframe.contentWindow) return
  doc.open()
  doc.write(html)
  doc.close()
  window.setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    window.setTimeout(() => document.body.removeChild(iframe), 500)
  }, 80)
}

export async function buildBlankReceiptHtml(args: {
  receiptSettings: ReceiptSettingsRow | null
  lineCount?: number
  /** IQD per 1 USD — same as live sales; IQD totals / rate line match sale receipts when set. */
  exchangeRateUsdToIqd?: number | null
}): Promise<string> {
  const { receiptSettings, exchangeRateUsdToIqd } = args
  const safeLineCount = BLANK_RECEIPT_ROWS
  const rateStr =
    exchangeRateUsdToIqd != null &&
    Number.isFinite(exchangeRateUsdToIqd) &&
    exchangeRateUsdToIqd > 0
      ? String(exchangeRateUsdToIqd)
      : '0'

  const nowIso = new Date().toISOString()
  const lines: SaleListRow['lines'] = Array.from({ length: safeLineCount }, (_, idx) => ({
    id: -(idx + 1),
    product: null,
    manual_name: '',
    product_name: '\u00A0',
    quantity: 0,
    unit_price_usd: '0',
    unit_buy_price_usd: '0',
    returned_quantity: 0,
  }))

  const sale: Record<string, unknown> = {
    occurred_at: nowIso,
    exchange_rate_usd_to_iqd: rateStr,
    invoice_discount_usd: '0',
    amount_paid_iqd: '0',
    amount_paid_usd: '0',
    note: '',
    customer_phone: '',
    customer_address: '',
    previous_debt_usd: '0',
    lines,
  }

  const sum = computeReceiptSummaryFromSale(sale as SaleListRow)

  return buildReceiptHtml({
    sale,
    sum,
    receiptSettings,
    customerNameDisplay: '',
    blankMode: true,
  })
}
