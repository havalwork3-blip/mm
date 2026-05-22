import { printReceiptHtml } from './receiptHtml'
import type { MerchantStorefrontOrderRow } from '../types/api'

export type StorefrontOrderReceiptLabels = {
  title: string
  orderNo: string
  date: string
  customer: string
  phone: string
  address: string
  status: string
  deliveryArea: string
  subtotal: string
  delivery: string
  total: string
  product: string
  qty: string
  unitPrice: string
  lineTotal: string
  items: string
}

export type StorefrontOrderReceiptShopInfo = {
  logoUrl?: string | null
  shopName?: string
  shopNameKu?: string
  subTitle?: string
  shopAddress?: string
  footerNote?: string
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Remove maps URLs, lat/lng pairs, and extra whitespace from address. */
export function stripMapsUrlFromAddress(address: string): string {
  return address
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\d{1,3}\.\d+\s*,\s*\d{1,3}\.\d+/g, '')
    .replace(/[📍📌🗺️]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function formatUsd(raw: string | undefined | null): string {
  if (raw == null || String(raw).trim() === '') return '0'
  const n = Number.parseFloat(String(raw).replace(/,/g, ''))
  if (!Number.isFinite(n)) return '0'
  return n.toFixed(2).replace(/\.?0+$/, '') || '0'
}

function lineTotal(qty: number, unitPrice: string): string {
  const u = Number.parseFloat(unitPrice)
  if (!Number.isFinite(u)) return '0'
  return formatUsd(String(qty * u))
}

/** A4 sales-receipt layout (same structure as POS receiptHtml). */
const A4_RECEIPT_STYLES = `
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
  }
  .receipt {
    width: 100%;
    border: 0;
    border-radius: 14px;
    overflow: hidden;
    background: #fff;
    font-size: 10px;
    line-height: 1.35;
    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
    direction: rtl;
  }
  .invoice-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 14px 16px;
    background: #fff;
    color: #0f172a;
    border-bottom: 1px solid #e5e7eb;
    page-break-after: avoid;
    break-after: avoid-page;
  }
  .invoice-hero__brand { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
  .invoice-hero__badge { text-align: end; flex-shrink: 0; min-width: 180px; }
  .invoice-hero__badge-ku {
    margin: 0;
    font-size: 28px;
    line-height: 1;
    font-weight: 900;
    letter-spacing: 0.02em;
    color: #f59e0b;
  }
  .invoice-hero__badge-en {
    margin: 2px 0 0;
    font-size: 11px;
    color: #334155;
    font-weight: 600;
  }
  .invoice-hero__badge-id {
    margin: 4px 0 0;
    font-size: 11px;
    color: #334155;
    font-weight: 700;
  }
  .logo-img,
  .logo-placeholder {
    width: 72px;
    height: 72px;
    border-radius: 14px;
    border: 0;
    flex-shrink: 0;
  }
  .logo-img { object-fit: contain; }
  .logo-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f3f4f6;
    color: #334155;
    font-size: 16px;
    font-weight: 800;
  }
  .receipt-titles h1 {
    margin: 0;
    font-size: 18px;
    line-height: 1.1;
    color: #0f172a;
    font-weight: 900;
  }
  .receipt-titles .tag {
    margin: 3px 0 0;
    font-size: 10px;
    color: #64748b;
    font-weight: 600;
  }
  .receipt-titles .shop-addr {
    margin: 6px 0 0;
    font-size: 9px;
    line-height: 1.4;
    color: #334155;
    font-weight: 600;
    white-space: pre-wrap;
  }
  .receipt-body { padding: 12px 16px 14px; }
  .receipt-meta {
    margin-bottom: 10px;
    padding: 10px 12px;
    border: 1px solid #dbe3ef;
    border-radius: 10px;
    background: #f8fafc;
    page-break-after: avoid;
    break-after: avoid-page;
  }
  .meta-line {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 16px;
    align-items: start;
  }
  .party-card h3 {
    margin: 0 0 5px;
    font-size: 10px;
    color: #1f2937;
    font-weight: 800;
  }
  .party-card p {
    margin: 0 0 2px;
    font-size: 9px;
    color: #475569;
    line-height: 1.45;
    word-break: break-word;
  }
  .party-card p strong { color: #0f172a; font-weight: 700; }
  .party-card--customer { direction: ltr; text-align: left; }
  .party-card--meta { direction: rtl; text-align: right; }
  .section-title {
    margin: 4px 0 4px;
    font-size: 9px;
    font-weight: 700;
    color: #6b7280;
    letter-spacing: 0.04em;
    page-break-after: avoid;
  }
  .receipt-table-wrap {
    border: 1px solid #dbe3ef;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 8px;
  }
  table.receipt-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9px;
    table-layout: fixed;
  }
  .receipt-table col.col-idx { width: 6%; }
  .receipt-table col.col-name { width: 44%; }
  .receipt-table col.col-qty { width: 10%; }
  .receipt-table col.col-price { width: 20%; }
  .receipt-table col.col-total { width: 20%; }
  .receipt-table thead { display: table-header-group; }
  .receipt-table th,
  .receipt-table td { border: 1px solid #e5e7eb; padding: 0; vertical-align: top; }
  .receipt-table th {
    background: #e2e8f0;
    color: #1f2937;
    font-size: 8px;
    font-weight: 700;
  }
  .receipt-table th .th-inner { display: block; padding: 5px 4px; }
  .cell-pad { display: block; padding: 4px; word-break: break-word; }
  .receipt-table .col-name { text-align: start; }
  .receipt-table .num { text-align: end; font-variant-numeric: tabular-nums; }
  .cell-idx {
    text-align: center;
    color: #64748b;
    font-weight: 700;
    direction: ltr;
    unicode-bidi: isolate;
  }
  .cell-name-text { font-weight: 600; font-size: 9px; }
  .receipt-table tbody tr:nth-child(odd) td { background: #f8fafc; }
  .receipt-table tbody tr { page-break-inside: avoid; break-inside: avoid; }
  .receipt-totals {
    margin-bottom: 10px;
    margin-inline-start: auto;
    width: min(54%, 300px);
    border: 1px solid #dbe3ef;
    border-radius: 8px;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .receipt-totals .tot-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 5px 9px;
    border-bottom: 1px solid #e5e7eb;
    background: #fff;
    font-size: 9px;
  }
  .receipt-totals .tot-row:last-child { border-bottom: 0; }
  .receipt-totals .num {
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    text-align: end;
    min-width: 72px;
  }
  .tot-row--strong {
    background: #fff !important;
    border-top: 1px solid #e5e7eb;
  }
  .tot-row--strong .num {
    color: #f59e0b !important;
    font-size: 18px;
    line-height: 1.1;
    font-weight: 900;
  }
  .receipt-footer {
    margin: 0;
    padding: 7px 12px;
    text-align: center;
    font-size: 9px;
    font-weight: 600;
    color: #0f172a;
    background: #e2e8f0;
    border-top: 1px solid #cbd5e1;
    page-break-inside: avoid;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { max-width: none; padding: 0; }
    .receipt { box-shadow: none; border-radius: 0; }
  }
`

export function buildStorefrontOrderReceiptHtml(args: {
  order: MerchantStorefrontOrderRow
  shop?: StorefrontOrderReceiptShopInfo
  labels: StorefrontOrderReceiptLabels
  dateFormatted: string
  statusText: string
  dir?: 'rtl' | 'ltr'
}): string {
  const { order, shop = {}, labels, dateFormatted, statusText, dir = 'rtl' } = args
  const hasSubtotal =
    order.subtotal_amount != null && String(order.subtotal_amount).trim() !== ''
  const deliveryNum =
    order.delivery_fee != null ? Number.parseFloat(order.delivery_fee) : 0
  const showDelivery = Number.isFinite(deliveryNum) && deliveryNum > 0

  const addressClean = stripMapsUrlFromAddress(order.customer_address)
  const shopTitle =
    shop.shopNameKu?.trim() ||
    shop.shopName?.trim() ||
    labels.title
  const subTitle = shop.subTitle?.trim() || labels.title
  const shopAddress = (shop.shopAddress ?? '').trim()
  const footer = shop.footerNote?.trim() || `${labels.title} · #${order.id}`
  const orderDisplay = String(order.id)

  const logo = shop.logoUrl?.trim()
    ? `<img src="${esc(shop.logoUrl.trim())}" alt="" class="logo-img" />`
    : `<div class="logo-placeholder" aria-hidden="true">${esc(
        shopTitle
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0])
          .join('')
          .toUpperCase() || 'MM'
      )}</div>`

  const itemRows = order.items
    .map(
      (line, idx) => `
      <tr>
        <td class="cell-idx"><span class="cell-pad">${idx + 1}</span></td>
        <td class="col-name"><span class="cell-pad cell-name-text">${esc(line.product_name)}</span></td>
        <td class="num"><span class="cell-pad">${line.quantity}</span></td>
        <td class="num cell-price"><span class="cell-pad">$${formatUsd(line.unit_price)}</span></td>
        <td class="num cell-line-total"><span class="cell-pad">$${lineTotal(line.quantity, line.unit_price)}</span></td>
      </tr>`
    )
    .join('')

  const totalsRows = [
    hasSubtotal
      ? `<div class="tot-row"><span>${esc(labels.subtotal)}</span><span class="num">$${formatUsd(order.subtotal_amount)}</span></div>`
      : '',
    showDelivery
      ? `<div class="tot-row"><span>${esc(labels.delivery)}${order.delivery_zone_name ? ` (${esc(order.delivery_zone_name)})` : ''}</span><span class="num">$${formatUsd(order.delivery_fee)}</span></div>`
      : '',
    `<div class="tot-row tot-row--strong"><span>${esc(labels.total)} (USD)</span><span class="num">$${formatUsd(order.total_amount)}</span></div>`,
  ].join('')

  const customerBlock = `
    <p><strong>${esc(order.customer_name)}</strong></p>
    <p>${esc(labels.phone)}: <span dir="ltr">${esc(order.customer_phone)}</span></p>
    ${addressClean ? `<p>${esc(labels.address)}: ${esc(addressClean)}</p>` : ''}`

  const orderMetaBlock = `
    <p><strong>${esc(labels.orderNo)}:</strong> ${orderDisplay}</p>
    <p><strong>${esc(labels.date)}:</strong> ${esc(dateFormatted)}</p>
    <p><strong>${esc(labels.status)}:</strong> ${esc(statusText)}</p>
    ${order.delivery_zone_name ? `<p><strong>${esc(labels.deliveryArea)}:</strong> ${esc(order.delivery_zone_name)}</p>` : ''}`

  return `<!doctype html><html dir="${dir}" lang="ku"><head><meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(labels.orderNo)} #${order.id}</title>
  <style>${A4_RECEIPT_STYLES}</style></head><body>
  <div class="sheet">
    <div class="receipt receipt--a4">
      <div class="invoice-hero">
        <div class="invoice-hero__brand">
          ${logo}
          <div class="receipt-titles">
            <h1>${esc(shopTitle)}</h1>
            <p class="tag">${esc(subTitle)}</p>
            ${shopAddress ? `<p class="shop-addr" dir="auto">${esc(shopAddress)}</p>` : ''}
          </div>
        </div>
        <div class="invoice-hero__badge">
          <p class="invoice-hero__badge-ku">ORDER</p>
          <p class="invoice-hero__badge-en">${esc(labels.title)}</p>
          <p class="invoice-hero__badge-id">[ ${esc(labels.orderNo)}: ${orderDisplay} ]</p>
        </div>
      </div>
      <div class="receipt-body">
        <div class="receipt-meta">
          <div class="meta-line">
            <div class="party-card party-card--customer">
              <h3>${esc(labels.customer)}</h3>
              ${customerBlock}
            </div>
            <div class="party-card party-card--meta">
              <h3>${esc(labels.orderNo)}</h3>
              ${orderMetaBlock}
            </div>
          </div>
        </div>
        <p class="section-title">${esc(labels.items)} (${order.items.length})</p>
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
              <th scope="col"><span class="th-inner">${esc(labels.product)}</span></th>
              <th scope="col"><span class="th-inner">${esc(labels.qty)}</span></th>
              <th scope="col"><span class="th-inner">${esc(labels.unitPrice)}</span></th>
              <th scope="col"><span class="th-inner">${esc(labels.lineTotal)}</span></th>
            </tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
        <div class="receipt-totals">${totalsRows}</div>
        <footer class="receipt-footer">${esc(footer)}</footer>
      </div>
    </div>
  </div>
</body></html>`
}

export function printStorefrontOrderReceipt(html: string): void {
  printReceiptHtml(html)
}

export function downloadStorefrontOrderReceiptPdf(html: string): void {
  printReceiptHtml(html)
}
