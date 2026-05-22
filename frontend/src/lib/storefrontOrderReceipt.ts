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

export function buildStorefrontOrderReceiptHtml(args: {
  order: MerchantStorefrontOrderRow
  shopName?: string
  labels: StorefrontOrderReceiptLabels
  dateFormatted: string
  statusText: string
  dir?: 'rtl' | 'ltr'
}): string {
  const { order, shopName, labels, dateFormatted, statusText, dir = 'rtl' } = args
  const hasSubtotal =
    order.subtotal_amount != null && String(order.subtotal_amount).trim() !== ''
  const deliveryNum =
    order.delivery_fee != null ? Number.parseFloat(order.delivery_fee) : 0
  const showDelivery = Number.isFinite(deliveryNum) && deliveryNum > 0

  const itemRows = order.items
    .map(
      (line, idx) => `
      <tr>
        <td class="idx">${idx + 1}</td>
        <td class="name">${esc(line.product_name)}</td>
        <td class="num">${line.quantity}</td>
        <td class="num">$${formatUsd(line.unit_price)}</td>
        <td class="num">$${lineTotal(line.quantity, line.unit_price)}</td>
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
    `<div class="tot-row tot-row--strong"><span>${esc(labels.total)}</span><span class="num">$${formatUsd(order.total_amount)}</span></div>`,
  ].join('')

  const shopTitle = shopName?.trim() ? esc(shopName.trim()) : esc(labels.title)

  return `<!DOCTYPE html>
<html lang="ku" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <title>${esc(labels.orderNo)} #${order.id}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: system-ui, 'Segoe UI', Tahoma, sans-serif;
      font-size: 12px;
      color: #0f172a;
      background: #fff;
      direction: ${dir};
    }
    .sheet { max-width: 210mm; margin: 0 auto; }
    .hero {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 8px;
      background: linear-gradient(135deg, #5b21b6, #4f46e5);
      color: #fff;
      margin-bottom: 12px;
    }
    .hero h1 { margin: 0; font-size: 18px; font-weight: 800; }
    .hero .meta { margin: 4px 0 0; font-size: 11px; opacity: 0.9; }
    .hero .order-id {
      font-size: 22px;
      font-weight: 900;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }
    @media (max-width: 480px) {
      .grid { grid-template-columns: 1fr; }
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f8fafc;
    }
    .card h3 {
      margin: 0 0 6px;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #64748b;
    }
    .card p { margin: 4px 0; font-size: 12px; font-weight: 600; line-height: 1.45; }
    .card .muted { font-weight: 500; color: #475569; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #e2e8f0;
      padding: 6px 8px;
    }
    th {
      background: #eef2ff;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      color: #4338ca;
    }
    td.idx { text-align: center; color: #64748b; width: 2rem; }
    td.name { font-weight: 600; }
    td.num { text-align: end; font-variant-numeric: tabular-nums; font-weight: 600; }
    tbody tr:nth-child(odd) td { background: #f8fafc; }
    .totals {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 8px;
    }
    .tot-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
      background: #fff;
    }
    .tot-row:last-child { border-bottom: 0; }
    .tot-row .num { font-variant-numeric: tabular-nums; font-weight: 700; }
    .tot-row--strong { background: #eef2ff !important; font-weight: 800; font-size: 13px; }
    .status-pill {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 10px;
      border-radius: 999px;
      background: #fff;
      color: #5b21b6;
      font-size: 10px;
      font-weight: 800;
    }
    @media print {
      body { padding: 0; }
      .sheet { max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hero">
      <div>
        <h1>${shopTitle}</h1>
        <p class="meta">${esc(labels.title)}</p>
        <p class="meta">${esc(labels.date)}: ${esc(dateFormatted)}</p>
        <span class="status-pill">${esc(labels.status)}: ${esc(statusText)}</span>
      </div>
      <div class="order-id">#${order.id}</div>
    </div>

    <div class="grid">
      <div class="card">
        <h3>${esc(labels.customer)}</h3>
        <p>${esc(order.customer_name)}</p>
        <h3>${esc(labels.phone)}</h3>
        <p dir="ltr">${esc(order.customer_phone)}</p>
        <h3>${esc(labels.address)}</h3>
        <p class="muted">${esc(order.customer_address)}</p>
      </div>
      <div class="card">
        <h3>${esc(labels.orderNo)}</h3>
        <p>#${order.id}</p>
        ${order.delivery_zone_name ? `<h3>${esc(labels.deliveryArea)}</h3><p>${esc(order.delivery_zone_name)}</p>` : ''}
        <div class="totals">${totalsRows}</div>
      </div>
    </div>

    <h3 style="margin:0 0 6px;font-size:10px;color:#64748b;text-transform:uppercase;">${esc(labels.items)} (${order.items.length})</h3>
    <table>
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
