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

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Remove Google Maps / any http(s) URL from address text for receipts. */
export function stripMapsUrlFromAddress(address: string): string {
  return address
    .replace(/https?:\/\/\S+/gi, '')
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

function logoBlock(logoUrl: string | null | undefined, shopTitle: string): string {
  if (logoUrl?.trim()) {
    return `<img src="${esc(logoUrl.trim())}" alt="" class="brand-logo" />`
  }
  const initials = shopTitle
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'MM'
  return `<div class="brand-logo brand-logo--placeholder" aria-hidden="true">${esc(initials)}</div>`
}

export function buildStorefrontOrderReceiptHtml(args: {
  order: MerchantStorefrontOrderRow
  shopName?: string
  logoUrl?: string | null
  labels: StorefrontOrderReceiptLabels
  dateFormatted: string
  statusText: string
  dir?: 'rtl' | 'ltr'
}): string {
  const { order, shopName, logoUrl, labels, dateFormatted, statusText, dir = 'rtl' } = args
  const hasSubtotal =
    order.subtotal_amount != null && String(order.subtotal_amount).trim() !== ''
  const deliveryNum =
    order.delivery_fee != null ? Number.parseFloat(order.delivery_fee) : 0
  const showDelivery = Number.isFinite(deliveryNum) && deliveryNum > 0

  const addressClean = stripMapsUrlFromAddress(order.customer_address)
  const shopTitle = shopName?.trim() ? shopName.trim() : labels.title

  const itemRows = order.items
    .map(
      (line, idx) => `
      <tr>
        <td class="idx"><span class="cell-pad">${idx + 1}</span></td>
        <td class="name"><span class="cell-pad">${esc(line.product_name)}</span></td>
        <td class="num"><span class="cell-pad">${line.quantity}</span></td>
        <td class="num"><span class="cell-pad">$${formatUsd(line.unit_price)}</span></td>
        <td class="num"><span class="cell-pad">$${lineTotal(line.quantity, line.unit_price)}</span></td>
      </tr>`
    )
    .join('')

  const totalsRows = [
    hasSubtotal
      ? `<div class="tot-row"><span>${esc(labels.subtotal)}</span><span class="num">$${formatUsd(order.subtotal_amount)}</span></div>`
      : '',
    showDelivery
      ? `<div class="tot-row"><span>${esc(labels.delivery)}${order.delivery_zone_name ? ` · ${esc(order.delivery_zone_name)}` : ''}</span><span class="num">$${formatUsd(order.delivery_fee)}</span></div>`
      : '',
    `<div class="tot-row tot-row--grand"><span>${esc(labels.total)}</span><span class="num">$${formatUsd(order.total_amount)}</span></div>`,
  ].join('')

  return `<!DOCTYPE html>
<html lang="ku" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <title>${esc(labels.orderNo)} #${order.id}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: 'Segoe UI', Tahoma, Arial, 'Noto Sans Arabic', sans-serif;
      font-size: 12px;
      color: #0f172a;
      background: #f1f5f9;
      direction: ${dir};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      max-width: 190mm;
      margin: 0 auto;
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.1);
    }
    .brand {
      text-align: center;
      padding: 22px 20px 16px;
      border-bottom: 3px solid #5b21b6;
      background: linear-gradient(180deg, #faf5ff 0%, #fff 100%);
    }
    .brand-logo {
      display: block;
      width: 88px;
      height: 88px;
      margin: 0 auto 12px;
      object-fit: contain;
      border-radius: 16px;
    }
    .brand-logo--placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #5b21b6, #4f46e5);
      color: #fff;
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 0.05em;
    }
    .brand-name {
      margin: 0;
      font-size: 22px;
      font-weight: 900;
      color: #1e1b4b;
      letter-spacing: 0.02em;
    }
    .brand-sub {
      margin: 6px 0 0;
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
    }
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      background: #5b21b6;
      color: #fff;
    }
    .meta-bar .order-no {
      font-size: 20px;
      font-weight: 900;
      font-variant-numeric: tabular-nums;
    }
    .meta-bar .meta-lines {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.95;
      text-align: end;
    }
    .meta-bar .meta-lines p { margin: 2px 0; }
    .status-pill {
      display: inline-block;
      margin-top: 4px;
      padding: 3px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.2);
      font-size: 10px;
      font-weight: 800;
    }
    .body-pad { padding: 16px 20px 20px; }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 16px;
    }
    @media (max-width: 520px) {
      .grid { grid-template-columns: 1fr; }
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px 16px;
      background: #f8fafc;
    }
    .card-title {
      margin: 0 0 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e9d5ff;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #5b21b6;
    }
    .field { margin-bottom: 10px; }
    .field:last-child { margin-bottom: 0; }
    .field-label {
      display: block;
      margin-bottom: 3px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #94a3b8;
    }
    .field-value {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.5;
      color: #0f172a;
    }
    .field-value--address {
      font-weight: 600;
      color: #334155;
      white-space: pre-wrap;
    }
    .field-value--phone { direction: ltr; unicode-bidi: isolate; text-align: start; }
    .totals {
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      background: #fff;
    }
    .tot-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 9px 12px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 12px;
    }
    .tot-row:last-child { border-bottom: 0; }
    .tot-row .num {
      font-variant-numeric: tabular-nums;
      font-weight: 800;
      color: #0f172a;
    }
    .tot-row--grand {
      background: linear-gradient(90deg, #ede9fe, #eef2ff);
      font-size: 14px;
      font-weight: 900;
      padding: 12px;
    }
    .tot-row--grand .num { color: #5b21b6; font-size: 16px; }
    .section-title {
      margin: 0 0 8px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #64748b;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .items-table thead th {
      padding: 10px 8px;
      background: #5b21b6;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      border: 0;
    }
    .items-table tbody td {
      padding: 0;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    .items-table tbody tr:last-child td { border-bottom: 0; }
    .items-table tbody tr:nth-child(even) td { background: #f8fafc; }
    .cell-pad { display: block; padding: 9px 8px; }
    .items-table .idx { text-align: center; color: #64748b; width: 2.2rem; font-weight: 700; }
    .items-table .name { font-weight: 700; }
    .items-table .num { text-align: end; font-variant-numeric: tabular-nums; font-weight: 700; }
    .footer-note {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px dashed #e2e8f0;
      text-align: center;
      font-size: 10px;
      font-weight: 600;
      color: #94a3b8;
    }
    @media print {
      body { padding: 0; background: #fff; }
      .sheet { box-shadow: none; border-radius: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="brand">
      ${logoBlock(logoUrl, shopTitle)}
      <h1 class="brand-name">${esc(shopTitle)}</h1>
      <p class="brand-sub">${esc(labels.title)}</p>
    </header>

    <div class="meta-bar">
      <span class="order-no">#${order.id}</span>
      <div class="meta-lines">
        <p>${esc(labels.date)}: ${esc(dateFormatted)}</p>
        <span class="status-pill">${esc(labels.status)}: ${esc(statusText)}</span>
      </div>
    </div>

    <div class="body-pad">
      <div class="grid">
        <section class="card">
          <h2 class="card-title">${esc(labels.customer)}</h2>
          <div class="field">
            <span class="field-label">${esc(labels.customer)}</span>
            <p class="field-value">${esc(order.customer_name)}</p>
          </div>
          <div class="field">
            <span class="field-label">${esc(labels.phone)}</span>
            <p class="field-value field-value--phone">${esc(order.customer_phone)}</p>
          </div>
          ${
            addressClean
              ? `<div class="field">
            <span class="field-label">${esc(labels.address)}</span>
            <p class="field-value field-value--address">${esc(addressClean)}</p>
          </div>`
              : ''
          }
        </section>

        <section class="card">
          <h2 class="card-title">${esc(labels.orderNo)}</h2>
          ${
            order.delivery_zone_name
              ? `<div class="field">
            <span class="field-label">${esc(labels.deliveryArea)}</span>
            <p class="field-value">${esc(order.delivery_zone_name)}</p>
          </div>`
              : ''
          }
          <div class="totals">${totalsRows}</div>
        </section>
      </div>

      <h3 class="section-title">${esc(labels.items)} (${order.items.length})</h3>
      <table class="items-table">
        <thead>
          <tr>
            <th>#</th>
            <th>${esc(labels.product)}</th>
            <th>${esc(labels.qty)}</th>
            <th>${esc(labels.unitPrice)}</th>
            <th>${esc(labels.lineTotal)}</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <p class="footer-note">${esc(labels.title)} · #${order.id}</p>
    </div>
  </div>
</body>
</html>`
}

export function printStorefrontOrderReceipt(html: string): void {
  printReceiptHtml(html)
}

/** Opens the system print dialog — choose “Save as PDF” to download. */
export function downloadStorefrontOrderReceiptPdf(html: string): void {
  printReceiptHtml(html)
}
