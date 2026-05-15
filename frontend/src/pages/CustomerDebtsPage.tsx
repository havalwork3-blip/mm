import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { ArrowLeft, Banknote, Download, Pencil, Printer, Wallet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PageAuthLoading } from '../components/PageAuthLoading'
import { useLocale } from '../context/LocaleContext'
import { useSyncedSession } from '../hooks/useSyncedSession'
import { apiJson } from '../lib/api'
import { hasPerm } from '../lib/permissions'
import type {
  CustomerCollectPaymentResponse,
  CustomerDebtRow,
  CustomerDebtSummaryResponse,
  CustomerRow,
  SaleListRow,
} from '../types/api'

function normalizeMoneyInput(s: string) {
  return s.replace(/[\s,،\u066C]/g, '').trim()
}

type CustomerPaymentHistoryRow = {
  kind: 'sale_payment'
  id: number
  occurred_on: string
  occurred_at: string | null
  amount_usd: string
  direction: 'in' | 'out' | 'balance'
  label: string
}

function escapeHtml(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatMoneyCompact(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '0'
  const n = Number(String(value).replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return String(value ?? '')
  return n.toFixed(2).replace(/\.?0+$/, '')
}

function stripAnyParens(label: string): string {
  return label
    .replace(/\s*[\(\（][^)\）]*[\)\）]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatDateTimeCell(value: string | null | undefined): string {
  if (!value) return '—'
  const dt = new Date(value)
  if (Number.isNaN(dt.getTime())) return String(value)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  const hh = String(dt.getHours()).padStart(2, '0')
  const mm = String(dt.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${hh}:${mm}`
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function parseDec(s: string) {
  const t = normalizeMoneyInput(s).replace(/٫/g, '.')
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

/** When correcting total USD equivalent, scale USD/IQD parts so ratio is preserved. */
function splitPaymentPreservingRatio(
  oldUsd: number,
  oldIqd: number,
  rate: number,
  newEqUsd: number,
): { usd: number; iqd: number } {
  if (!Number.isFinite(rate) || rate <= 0) {
    return { usd: newEqUsd, iqd: 0 }
  }
  const oldEq = oldUsd + oldIqd / rate
  if (!Number.isFinite(oldEq) || oldEq <= 1e-9) {
    return { usd: newEqUsd, iqd: 0 }
  }
  const factor = newEqUsd / oldEq
  return { usd: oldUsd * factor, iqd: oldIqd * factor }
}

function phoneDigitsOnly(s: string) {
  return normalizeMoneyInput(s).replace(/\D/g, '')
}

function debtRowPhonesDigits(r: CustomerDebtRow) {
  const a = phoneDigitsOnly(r.phone_1 ?? '')
  const b = phoneDigitsOnly(r.phone_2 ?? '')
  return { p1: a, p2: b }
}

function debtRowMatchesPhoneFilter(r: CustomerDebtRow, digitQuery: string) {
  if (!digitQuery) return true
  const { p1, p2 } = debtRowPhonesDigits(r)
  return p1.includes(digitQuery) || p2.includes(digitQuery)
}

function debtRowPhonesDisplay(r: CustomerDebtRow) {
  const parts = [r.phone_1, r.phone_2].map((x) => String(x ?? '').trim()).filter(Boolean)
  return parts.length ? parts.join(' · ') : '—'
}

export function CustomerDebtsPage() {
  const { t } = useLocale()
  const {
    me,
    authPending,
    showLogin,
    login,
    shopImpersonation,
    setShopImpersonation,
    canAccessShopData,
  } = useSyncedSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [shopOverride, setShopOverride] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<CustomerDebtSummaryResponse | null>(
    null,
  )
  const [collectFor, setCollectFor] = useState<{
    id: number
    name: string
  } | null>(null)
  const [payUsd, setPayUsd] = useState('')
  const [payIqd, setPayIqd] = useState('')
  const [submittingPay, setSubmittingPay] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyRows, setHistoryRows] = useState<CustomerPaymentHistoryRow[]>([])
  const [localHistoryRows, setLocalHistoryRows] = useState<CustomerPaymentHistoryRow[]>(
    [],
  )
  const [historyCustomerQuery, setHistoryCustomerQuery] = useState('')
  const [historyCustomerOpen, setHistoryCustomerOpen] = useState(false)
  const [customerLookup, setCustomerLookup] = useState<CustomerRow[]>([])
  const [historyDateFrom, setHistoryDateFrom] = useState('')
  const [historyDateTo, setHistoryDateTo] = useState('')

  const [historyEditOpen, setHistoryEditOpen] = useState(false)
  const [historyEditLoading, setHistoryEditLoading] = useState(false)
  const [historyEditSaving, setHistoryEditSaving] = useState(false)
  const [historyEditError, setHistoryEditError] = useState<string | null>(null)
  const [historyEditBlocked, setHistoryEditBlocked] = useState(false)
  const [historyEditSaleId, setHistoryEditSaleId] = useState<number | null>(null)
  const [historyEditLabel, setHistoryEditLabel] = useState('')
  const [historyEditOccurredAt, setHistoryEditOccurredAt] = useState('')
  const [historyEditAmountUsd, setHistoryEditAmountUsd] = useState('')
  const [historyEditPaidUsd, setHistoryEditPaidUsd] = useState(0)
  const [historyEditPaidIqd, setHistoryEditPaidIqd] = useState(0)
  const [historyEditRate, setHistoryEditRate] = useState(0)

  const [debtFilterName, setDebtFilterName] = useState('')
  const [debtFilterPhone, setDebtFilterPhone] = useState('')
  const [debtNameSuggestOpen, setDebtNameSuggestOpen] = useState(false)

  const canView = Boolean(me && hasPerm(me, 'view_customer'))
  const canRecordPayment = Boolean(
    me && hasPerm(me, 'change_sale', 'add_sale'),
  )
  const customerNames = Array.from(
    new Set(customerLookup.map((r) => String(r.name ?? '')).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))
  const filteredHistoryCustomerNames = historyCustomerQuery.trim()
    ? customerNames.filter((name) =>
        name.toLowerCase().includes(historyCustomerQuery.trim().toLowerCase()),
      )
    : customerNames
  const filteredHistoryRows = historyCustomerQuery.trim()
    ? historyRows.filter((r) =>
        r.label.toLowerCase().includes(historyCustomerQuery.trim().toLowerCase()),
      )
    : historyRows

  const debtDigitQuery = useMemo(() => phoneDigitsOnly(debtFilterPhone), [debtFilterPhone])

  const filteredDebtRows = useMemo(() => {
    const rows = summary?.results ?? []
    const nq = debtFilterName.trim().toLowerCase()
    return rows.filter((r) => {
      if (nq && !String(r.name ?? '').toLowerCase().includes(nq)) return false
      if (debtDigitQuery && !debtRowMatchesPhoneFilter(r, debtDigitQuery)) return false
      return true
    })
  }, [summary, debtFilterName, debtDigitQuery])

  const debtCustomerNamesList = useMemo(() => {
    const rows = summary?.results ?? []
    return Array.from(new Set(rows.map((r) => String(r.name ?? '').trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [summary])

  const filteredDebtCustomerNamesList = useMemo(() => {
    const q = debtFilterName.trim().toLowerCase()
    if (!q) return debtCustomerNamesList
    return debtCustomerNamesList.filter((n) => n.toLowerCase().includes(q))
  }, [debtCustomerNamesList, debtFilterName])

  const hasDebtFilters = Boolean(debtFilterName.trim() || debtDigitQuery)

  const filteredDebtTotals = useMemo(() => {
    const usdSum = filteredDebtRows.reduce((acc, r) => acc + parseFloat(r.outstanding_balance_usd || '0'), 0)
    let iqdDisplay: string | null = null
    const rateStr = summary?.exchange_rate_usd_to_iqd
    if (rateStr != null && rateStr !== '') {
      const rate = parseFloat(rateStr)
      if (Number.isFinite(rate) && rate > 0) {
        iqdDisplay = Math.round(usdSum * rate).toLocaleString()
      }
    } else if (
      filteredDebtRows.length > 0 &&
      filteredDebtRows.every((r) => r.outstanding_balance_iqd != null && r.outstanding_balance_iqd !== '')
    ) {
      const iqdSum = filteredDebtRows.reduce(
        (acc, r) => acc + parseFloat(String(r.outstanding_balance_iqd).replace(/,/g, '')),
        0,
      )
      iqdDisplay = Number.isFinite(iqdSum) ? Math.round(iqdSum).toLocaleString() : null
    }
    return { usdStr: formatMoneyCompact(usdSum), iqdStr: iqdDisplay }
  }, [filteredDebtRows, summary?.exchange_rate_usd_to_iqd])

  useEffect(() => {
    setShopOverride(shopImpersonation ?? '')
  }, [shopImpersonation])

  const fetchSummary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiJson<CustomerDebtSummaryResponse>(
        '/api/customers/debt-summary/',
      )
      setSummary(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('customerDebts.loadFailed'))
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (!canView || !me) return
    if (me.is_superuser && me.shop === null && !shopImpersonation) return
    void fetchSummary()
  }, [canView, fetchSummary, me, shopImpersonation])

  useEffect(() => {
    if (!successMsg) return
    const id = window.setTimeout(() => setSuccessMsg(null), 6000)
    return () => window.clearTimeout(id)
  }, [successMsg])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.loginFailed'))
    }
  }

  function openCollect(row: { id: number; name: string }) {
    setError(null)
    setCollectFor(row)
    setPayUsd('')
    setPayIqd('')
  }

  async function submitCollect() {
    if (!collectFor) return
    const usdClean = normalizeMoneyInput(payUsd)
    const iqdClean = normalizeMoneyInput(payIqd)
    if (!usdClean && !iqdClean) {
      setError(t('customerDebts.enterPayment'))
      return
    }
    setSubmittingPay(true)
    setError(null)
    try {
      const data = await apiJson<CustomerCollectPaymentResponse>(
        `/api/customers/${collectFor.id}/collect-payment/`,
        {
          method: 'POST',
          body: JSON.stringify({
            amount_paid_usd: usdClean || '0',
            amount_paid_iqd: iqdClean || '0',
          }),
        },
      )
      let msg = t('customerDebts.paymentRecorded')
      const over = parseFloat(data.overpaid_usd_eq)
      if (over > 0.0001) {
        msg += ` ${t('customerDebts.overpaidHint').replace('{usd}', data.overpaid_usd_eq)}`
      }
      setSuccessMsg(msg)
      const applied = parseFloat(data.applied_usd_eq)
      if (applied > 0.000001) {
        setLocalHistoryRows((prev) => [
          {
            kind: 'sale_payment',
            id: -Date.now(),
            occurred_on: new Date().toISOString().slice(0, 10),
            occurred_at: new Date().toISOString(),
            amount_usd: data.applied_usd_eq,
            direction: 'in',
            label: collectFor.name,
          },
          ...prev,
        ])
      }
      setCollectFor(null)
      await fetchSummary()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('customerDebts.loadFailed'))
    } finally {
      setSubmittingPay(false)
    }
  }

  useEffect(() => {
    if (!canView || !canAccessShopData) return
    void (async () => {
      try {
        const data = await apiJson<CustomerRow[] | { results: CustomerRow[] }>(
          '/api/customers/?page_size=1000',
        )
        const list = Array.isArray(data) ? data : data.results
        setCustomerLookup(list ?? [])
      } catch {
        setCustomerLookup([])
      }
    })()
  }, [canAccessShopData, canView])

  async function fetchPaymentHistory(dateFrom: string, dateTo: string) {
    setHistoryLoading(true)
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const from = dateFrom.trim() || '2000-01-01'
      const to = dateTo.trim() || today
      const q = new URLSearchParams({ from, to })
      const led = await apiJson<{ entries: CustomerPaymentHistoryRow[] }>(
        `/api/cashier/ledger/?${q.toString()}`,
      )
      const onlyCustomerPayments = (led.entries ?? []).filter(
        (e) => e.kind === 'sale_payment',
      )
      const merged = [...localHistoryRows, ...onlyCustomerPayments]
      const seen = new Set<string>()
      const deduped = merged.filter((r) => {
        const key = `${r.kind}-${r.id}-${r.occurred_at ?? r.occurred_on}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setHistoryRows(deduped)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setHistoryRows([])
    } finally {
      setHistoryLoading(false)
    }
  }

  async function openPaymentHistory() {
    setHistoryOpen(true)
    setHistoryCustomerQuery('')
    setHistoryCustomerOpen(false)
    setHistoryDateFrom('')
    setHistoryDateTo('')
    await fetchPaymentHistory('', '')
  }

  function closeHistoryEdit() {
    setHistoryEditOpen(false)
    setHistoryEditLoading(false)
    setHistoryEditSaving(false)
    setHistoryEditError(null)
    setHistoryEditBlocked(false)
    setHistoryEditSaleId(null)
    setHistoryEditLabel('')
    setHistoryEditOccurredAt('')
    setHistoryEditAmountUsd('')
    setHistoryEditPaidUsd(0)
    setHistoryEditPaidIqd(0)
    setHistoryEditRate(0)
  }

  async function openHistoryEdit(r: CustomerPaymentHistoryRow) {
    if (!canRecordPayment || r.kind !== 'sale_payment' || r.id <= 0) return
    setHistoryEditError(null)
    setHistoryEditBlocked(false)
    setHistoryEditLoading(true)
    setHistoryEditSaleId(r.id)
    setHistoryEditLabel(r.label)
    try {
      const sale = await apiJson<SaleListRow>(`/api/sales/${r.id}/`)
      if (sale.has_returns) {
        setHistoryEditBlocked(true)
        setHistoryEditError(t('customerDebtsPage.paymentsHistoryEditBlockedReturns'))
        setHistoryEditOccurredAt('')
        setHistoryEditAmountUsd('')
        setHistoryEditOpen(true)
        return
      }
      const rate = parseFloat(sale.exchange_rate_usd_to_iqd)
      const usd = parseFloat(sale.amount_paid_usd)
      const iqd = parseFloat(sale.amount_paid_iqd)
      const eq =
        Number.isFinite(rate) && rate > 0 && Number.isFinite(usd) && Number.isFinite(iqd)
          ? usd + iqd / rate
          : usd
      const d = new Date(sale.occurred_at)
      setHistoryEditOccurredAt(Number.isNaN(d.getTime()) ? '' : toDatetimeLocalValue(d))
      setHistoryEditAmountUsd(formatMoneyCompact(eq))
      setHistoryEditPaidUsd(Number.isFinite(usd) ? usd : 0)
      setHistoryEditPaidIqd(Number.isFinite(iqd) ? iqd : 0)
      setHistoryEditRate(Number.isFinite(rate) && rate > 0 ? rate : 0)
      setHistoryEditOpen(true)
    } catch (e) {
      setHistoryEditError(e instanceof Error ? e.message : t('common.error'))
      setHistoryEditBlocked(true)
      setHistoryEditOpen(true)
    } finally {
      setHistoryEditLoading(false)
    }
  }

  async function saveHistoryEdit() {
    if (historyEditSaleId == null || historyEditBlocked) return
    let occurred = historyEditOccurredAt.trim()
    if (occurred.length === 16) occurred = `${occurred}:00`
    const dt = new Date(occurred)
    if (Number.isNaN(dt.getTime())) {
      setHistoryEditError(t('inv.historyEditInvalidDate'))
      return
    }
    const newEq = parseDec(historyEditAmountUsd)
    if (!Number.isFinite(newEq) || newEq < 0) {
      setHistoryEditError(t('common.error'))
      return
    }
    const { usd, iqd } = splitPaymentPreservingRatio(
      historyEditPaidUsd,
      historyEditPaidIqd,
      historyEditRate,
      newEq,
    )
    setHistoryEditSaving(true)
    setHistoryEditError(null)
    try {
      await apiJson(`/api/sales/${historyEditSaleId}/`, {
        method: 'PATCH',
        body: JSON.stringify({
          occurred_at: dt.toISOString(),
          amount_paid_usd: usd.toFixed(4),
          amount_paid_iqd: iqd.toFixed(4),
        }),
      })
      closeHistoryEdit()
      await fetchPaymentHistory(historyDateFrom, historyDateTo)
      await fetchSummary()
    } catch (e) {
      setHistoryEditError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setHistoryEditSaving(false)
    }
  }

  const buildPaymentHistoryPdfDoc = useCallback(async (): Promise<jsPDF> => {
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-100000px'
    container.style.top = '0'
    container.style.width = '1300px'
    container.style.background = '#ffffff'
    container.style.color = '#0f172a'
    container.style.fontFamily = '"Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif'
    container.style.padding = '16px'
    const rowsHtml = filteredHistoryRows
      .map(
        (r) => `<tr>
      <td>${escapeHtml(formatDateTimeCell(r.occurred_at ?? r.occurred_on))}</td>
      <td>${escapeHtml(r.label)}</td>
      <td>${escapeHtml(formatMoneyCompact(r.amount_usd))}</td>
    </tr>`,
      )
      .join('')
    const dateText = `${historyDateFrom.trim() || '2000-01-01'} -> ${historyDateTo.trim() || new Date().toISOString().slice(0, 10)}`
    container.innerHTML = `
      <style>
        .sheet { border: 1px solid #dbe2ea; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(2,6,23,.08); }
        .head { padding: 14px 16px; background: linear-gradient(180deg,#f8fafc,#f1f5f9); border-bottom: 1px solid #e2e8f0; }
        h2 { margin: 0 0 4px; font-size: 18px; font-weight: 700; }
        p.meta { margin: 0; color: #475569; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
        th, td { border: 1px solid #dbe2ea; padding: 8px 9px; text-align: center; vertical-align: middle; }
        thead th { background: #0ea5a4; color: #fff; font-weight: 700; padding: 0; height: 34px; vertical-align: middle; }
        thead th > span { display: flex; align-items: center; justify-content: center; height: 34px; line-height: 1.1; text-align: center; }
        tbody tr:nth-child(even) { background: #f8fafc; }
      </style>
      <div class="sheet">
        <div class="head">
          <h2>${escapeHtml(t('customerDebtsPage.paymentsHistoryTitle'))}</h2>
          <p class="meta">${escapeHtml(dateText)}</p>
        </div>
        <table>
          <thead><tr>
            <th><span>${escapeHtml(t('cashier.ledgerColDate'))}</span></th>
            <th><span>${escapeHtml(t('cashier.ledgerColLabel'))}</span></th>
            <th><span>${escapeHtml('بر USD')}</span></th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `
    document.body.appendChild(container)
    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
            if (!el.textContent?.includes('.sheet {')) el.remove()
          })
        },
      })
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const margin = 20
      const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2
      const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2
      const sourcePageHeight = Math.floor((canvas.width * pageHeight) / pageWidth)
      let offsetY = 0
      let pageNo = 1
      while (offsetY < canvas.height) {
        const sliceHeight = Math.min(sourcePageHeight, canvas.height - offsetY)
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = sliceHeight
        const ctx = pageCanvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(
            canvas,
            0,
            offsetY,
            canvas.width,
            sliceHeight,
            0,
            0,
            canvas.width,
            sliceHeight,
          )
        }
        const img = pageCanvas.toDataURL('image/png')
        const renderedHeight = (sliceHeight * pageWidth) / canvas.width
        if (pageNo > 1) pdf.addPage()
        pdf.addImage(img, 'PNG', margin, margin, pageWidth, renderedHeight)
        offsetY += sliceHeight
        pageNo += 1
      }
      return pdf
    } finally {
      document.body.removeChild(container)
    }
  }, [filteredHistoryRows, historyDateFrom, historyDateTo, t])

  const downloadPaymentHistoryPdf = useCallback(async () => {
    try {
      const pdf = await buildPaymentHistoryPdfDoc()
      pdf.save(`customer-payment-history-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }, [buildPaymentHistoryPdfDoc, t])

  const printPaymentHistory = useCallback(async () => {
    const w = window.open('', '_blank')
    if (!w) {
      setError(t('common.error'))
      return
    }
    try {
      const pdf = await buildPaymentHistoryPdfDoc()
      const url = URL.createObjectURL(pdf.output('blob'))
      w.location.href = url
      window.setTimeout(() => {
        w.focus()
        w.print()
        window.setTimeout(() => URL.revokeObjectURL(url), 5000)
      }, 900)
    } catch (e) {
      w.close()
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }, [buildPaymentHistoryPdfDoc, t])

  const buildCustomerDebtsPdfDoc = useCallback(async (): Promise<jsPDF> => {
    const rows = filteredDebtRows
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-100000px'
    container.style.top = '0'
    container.style.width = '1300px'
    container.style.background = '#ffffff'
    container.style.color = '#0f172a'
    container.style.fontFamily = '"Noto Sans Arabic","Segoe UI",Tahoma,Arial,sans-serif'
    container.style.padding = '16px'
    const rowsHtml = rows
      .map(
        (r) => `<tr>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.address || '—')}</td>
      <td>${escapeHtml(debtRowPhonesDisplay(r))}</td>
      <td>${escapeHtml(formatMoneyCompact(r.outstanding_balance_usd))}</td>
      <td>${escapeHtml(
        r.outstanding_balance_iqd !== null
          ? Number(r.outstanding_balance_iqd).toLocaleString()
          : '—',
      )}</td>
    </tr>`,
      )
      .join('')
    container.innerHTML = `
      <style>
        .sheet { border: 1px solid #dbe2ea; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(2,6,23,.08); }
        .head { padding: 14px 16px; background: linear-gradient(180deg,#f8fafc,#f1f5f9); border-bottom: 1px solid #e2e8f0; }
        h2 { margin: 0 0 4px; font-size: 18px; font-weight: 700; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
        th, td { border: 1px solid #dbe2ea; padding: 8px 9px; text-align: center; vertical-align: middle; }
        thead th { background: #0ea5a4; color: #fff; font-weight: 700; }
      </style>
      <div class="sheet">
        <div class="head">
          <h2>${escapeHtml(t('customerDebts.title'))}</h2>
        </div>
        <table>
          <thead><tr>
            <th>${escapeHtml(t('customerDebts.colCustomer'))}</th>
            <th>${escapeHtml(t('customerDebts.colAddress'))}</th>
            <th>${escapeHtml(t('customerDebts.colPhone'))}</th>
            <th>${escapeHtml(stripAnyParens(t('customerDebts.colAmount')) + ' USD')}</th>
            <th>${escapeHtml(stripAnyParens(t('customerDebts.colIqd')) + ' IQD')}</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="3"><strong>${escapeHtml(t('customerDebts.total'))}</strong></td>
              <td><strong>${escapeHtml(filteredDebtTotals.usdStr)}</strong></td>
              <td><strong>${escapeHtml(
                filteredDebtTotals.iqdStr !== null ? filteredDebtTotals.iqdStr : '—',
              )}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `
    document.body.appendChild(container)
    try {
      const canvas = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        onclone: (clonedDoc) => {
          // Prevent parser issues with global Tailwind color functions (e.g. oklch).
          clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
            if (!el.textContent?.includes('.sheet {')) el.remove()
          })
        },
      })
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const margin = 20
      const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2
      const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2
      const sourcePageHeight = Math.floor((canvas.width * pageHeight) / pageWidth)
      let offsetY = 0
      let pageNo = 1
      while (offsetY < canvas.height) {
        const sliceHeight = Math.min(sourcePageHeight, canvas.height - offsetY)
        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = canvas.width
        pageCanvas.height = sliceHeight
        const ctx = pageCanvas.getContext('2d')
        if (ctx) ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight)
        const img = pageCanvas.toDataURL('image/png')
        const renderedHeight = (sliceHeight * pageWidth) / canvas.width
        if (pageNo > 1) pdf.addPage()
        pdf.addImage(img, 'PNG', margin, margin, pageWidth, renderedHeight)
        offsetY += sliceHeight
        pageNo += 1
      }
      return pdf
    } finally {
      document.body.removeChild(container)
    }
  }, [filteredDebtRows, filteredDebtTotals, t])

  const downloadCustomerDebtsPdf = useCallback(async () => {
    try {
      const pdf = await buildCustomerDebtsPdfDoc()
      pdf.save(`customer-debts-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }, [buildCustomerDebtsPdfDoc, t])

  const printCustomerDebts = useCallback(async () => {
    const w = window.open('', '_blank')
    if (!w) {
      setError(t('common.error'))
      return
    }
    try {
      const pdf = await buildCustomerDebtsPdfDoc()
      const url = URL.createObjectURL(pdf.output('blob'))
      w.location.href = url
      window.setTimeout(() => {
        w.focus()
        w.print()
        window.setTimeout(() => URL.revokeObjectURL(url), 5000)
      }, 900)
    } catch (e) {
      w.close()
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }, [buildCustomerDebtsPdfDoc, t])

  const rateForHint = summary?.exchange_rate_usd_to_iqd
  const iqdPerUsdRounded =
    rateForHint !== null && rateForHint !== undefined
      ? Math.round(parseFloat(rateForHint) * 100).toLocaleString()
      : null
  const historyPaymentsColSpan = canRecordPayment ? 4 : 3
  if (authPending) {
    return <PageAuthLoading />
  }

  if (showLogin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-start text-xl font-semibold">
          {t('customerDebts.title')} — {t('dash.signIn')}
        </h1>
        <form onSubmit={handleLogin} className="mt-6 space-y-3">
          <input
            type="email"
            autoComplete="username"
            placeholder={t('pos.emailPlaceholder')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder={t('pos.passwordPlaceholder')}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-medium text-white"
          >
            {t('dash.signIn')}
          </button>
        </form>
        <Link to="/" className="mt-6 inline-block text-sm text-violet-600">
          ← {t('nav.home')}
        </Link>
      </div>
    )
  }

  if (!canView) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-slate-900">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to="/manage/customers"
              className="inline-flex min-h-9 w-fit shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
              {t('common.back')}
            </Link>
            <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <Banknote className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden />
              {t('customerDebts.title')}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void printCustomerDebts()}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" aria-hidden />
              {t('companiesPage.print')}
            </button>
            <button
              type="button"
              onClick={() => void downloadCustomerDebtsPdf()}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4" aria-hidden />
              {t('companiesPage.downloadPdf')}
            </button>
            <button
              type="button"
              onClick={() => void openPaymentHistory()}
              className="min-h-9 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('customerDebtsPage.paymentsHistoryBtn')}
            </button>
            {me.is_superuser && (
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900">
                <input
                  aria-label={t('pos.shopIdAria')}
                  placeholder={t('pos.shopIdPlaceholder')}
                  value={shopOverride}
                  onChange={(e) => setShopOverride(e.target.value)}
                  className="w-16 border-0 bg-transparent dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    const v = shopOverride.trim()
                    setShopImpersonation(v || null)
                    void fetchSummary()
                  }}
                  className="font-medium text-violet-700 dark:text-violet-400"
                >
                  {t('pos.apply')}
                </button>
              </div>
            )}
          </div>
        </div>

        {!canAccessShopData && me.is_superuser ? (
          <p className="text-start text-sm text-amber-800 dark:text-amber-200">
            {t('customerDebts.needShop')}
          </p>
        ) : null}

        {successMsg && (
          <p
            className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-start text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
            role="status"
          >
            {successMsg}
          </p>
        )}

        {error && (
          <p className="mb-4 text-start text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {loading && !summary ? (
          <p className="text-slate-600 dark:text-slate-400">{t('common.loading')}</p>
        ) : summary && canAccessShopData ? (
          <>
            {summary.results.length === 0 ? (
              <p className="text-start text-slate-600 dark:text-slate-400">
                {t('customerDebts.empty')}
              </p>
            ) : (
              <>
                <div className="relative mb-4 grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <label className="relative block sm:col-span-5">
                    <span className="mb-1 block text-start text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('sales.filterCustomerName')}
                    </span>
                    <input
                      value={debtFilterName}
                      onChange={(e) => {
                        setDebtFilterName(e.target.value)
                        setDebtNameSuggestOpen(true)
                      }}
                      onFocus={() => setDebtNameSuggestOpen(true)}
                      onBlur={() =>
                        window.setTimeout(() => setDebtNameSuggestOpen(false), 120)
                      }
                      placeholder={t('sales.filterCustomerNamePlaceholder')}
                      autoComplete="off"
                      className="min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                    {debtNameSuggestOpen && filteredDebtCustomerNamesList.length > 0 ? (
                      <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-600 dark:bg-slate-900">
                        {filteredDebtCustomerNamesList.map((name) => (
                          <li key={name}>
                            <button
                              type="button"
                              onClick={() => {
                                setDebtFilterName(name)
                                setDebtNameSuggestOpen(false)
                              }}
                              className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              {name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </label>
                  <label className="block sm:col-span-4">
                    <span className="mb-1 block text-start text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('customerDebts.filterPhoneLabel')}
                    </span>
                    <input
                      value={debtFilterPhone}
                      onChange={(e) => setDebtFilterPhone(e.target.value)}
                      inputMode="numeric"
                      placeholder={t('customerDebts.filterPhonePlaceholder')}
                      autoComplete="off"
                      className="min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <div className="flex items-end sm:col-span-3">
                    <button
                      type="button"
                      onClick={() => {
                        setDebtFilterName('')
                        setDebtFilterPhone('')
                        setDebtNameSuggestOpen(false)
                      }}
                      className="min-h-10 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {t('sales.clearFilters')}
                    </button>
                  </div>
                </div>
                {filteredDebtRows.length === 0 ? (
                  <p className="text-start text-slate-600 dark:text-slate-400">
                    {t('customerDebts.filterNoMatch')}
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <table className="w-full min-w-[28rem] text-start text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900/80">
                          <th className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">
                            {t('customerDebts.colCustomer')}
                          </th>
                          <th className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">
                            {t('customerDebts.colAddress')}
                          </th>
                          <th className="px-3 py-3 font-medium text-slate-700 dark:text-slate-200">
                            {t('customerDebts.colPhone')}
                          </th>
                          <th className="px-3 py-3 text-end font-medium text-slate-700 dark:text-slate-200">
                            {stripAnyParens(t('customerDebts.colAmount'))} USD
                          </th>
                          <th className="px-3 py-3 text-end font-medium text-slate-700 dark:text-slate-200">
                            {stripAnyParens(t('customerDebts.colIqd'))} IQD
                          </th>
                          <th className="w-14 px-2 py-3 text-center font-medium text-slate-700 dark:text-slate-200">
                            <span className="sr-only">{t('customerDebts.collectPayment')}</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDebtRows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-slate-100 dark:border-slate-700/80"
                          >
                            <td className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">
                              {row.name}
                            </td>
                            <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                              {row.address || '—'}
                            </td>
                            <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                              {debtRowPhonesDisplay(row)}
                            </td>
                            <td className="px-3 py-3 text-end font-mono tabular-nums text-slate-900 dark:text-slate-100">
                              {formatMoneyCompact(row.outstanding_balance_usd)}
                            </td>
                            <td className="px-3 py-3 text-end font-mono tabular-nums text-slate-900 dark:text-slate-100">
                              {row.outstanding_balance_iqd !== null
                                ? Number(row.outstanding_balance_iqd).toLocaleString()
                                : '—'}
                            </td>
                            <td className="px-2 py-2 text-center">
                              {canRecordPayment ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openCollect({ id: row.id, name: row.name })
                                  }
                                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-800 transition hover:bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/50"
                                  title={t('customerDebts.collectPayment')}
                                  aria-label={t('customerDebts.collectPayment')}
                                >
                                  <Wallet className="h-4 w-4" aria-hidden />
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 font-medium dark:bg-slate-900/50">
                          <td
                            colSpan={3}
                            className="px-3 py-3 text-slate-800 dark:text-slate-200"
                          >
                            {t('customerDebts.total')}
                          </td>
                          <td className="px-3 py-3 text-end font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {hasDebtFilters
                              ? filteredDebtTotals.usdStr
                              : formatMoneyCompact(summary.total_outstanding_usd)}
                          </td>
                          <td className="px-3 py-3 text-end font-mono tabular-nums text-slate-900 dark:text-slate-100">
                            {hasDebtFilters
                              ? filteredDebtTotals.iqdStr !== null
                                ? filteredDebtTotals.iqdStr
                                : '—'
                              : summary.total_outstanding_iqd !== null
                                ? Number(summary.total_outstanding_iqd).toLocaleString()
                                : '—'}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}
          </>
        ) : null}
      </main>

      {collectFor && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCollectFor(null)
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-800"
            role="dialog"
            aria-labelledby="collect-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="collect-dialog-title"
              className="text-start text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {t('customerDebts.collectTitle').replace('{name}', collectFor.name)}
            </h2>
            <div className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="cd-usd"
                  className="mb-1 block text-start text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  {t('customerDebts.amountUsdShort')}
                </label>
                <input
                  id="cd-usd"
                  value={payUsd}
                  onChange={(e) => setPayUsd(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono tabular-nums dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  inputMode="decimal"
                  placeholder="0"
                  autoComplete="off"
                />
              </div>
              <div>
                <label
                  htmlFor="cd-iqd"
                  className="mb-1 block text-start text-xs font-medium text-slate-600 dark:text-slate-400"
                >
                  {t('customerDebts.amountIqdShort')}
                </label>
                <input
                  id="cd-iqd"
                  value={payIqd}
                  onChange={(e) => setPayIqd(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono tabular-nums dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  inputMode="numeric"
                  placeholder="0"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setCollectFor(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {t('customerDebts.cancel')}
              </button>
              <button
                type="button"
                disabled={submittingPay || !iqdPerUsdRounded}
                onClick={() => void submitCollect()}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                {submittingPay ? t('pos.saving') : t('customerDebts.submitPayment')}
              </button>
            </div>
          </div>
        </div>
      )}
      {historyOpen && (
        <div
          className="fixed inset-0 z-[210] flex items-end justify-center bg-black/50 p-4 sm:items-center lg:pr-64"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryOpen(false)
          }}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-payments-history-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="customer-payments-history-title"
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                {t('customerDebtsPage.paymentsHistoryTitle')}
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void printPaymentHistory()}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Printer className="h-4 w-4" aria-hidden />
                  {t('companiesPage.print')}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadPaymentHistoryPdf()}
                  className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {t('companiesPage.downloadPdf')}
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-200"
                >
                  {t('crud.cancel')}
                </button>
              </div>
            </div>
            {historyLoading ? (
              <p className="py-6 text-sm text-slate-500">{t('common.loading')}</p>
            ) : historyRows.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">{t('crud.noRows')}</p>
            ) : (
              <div>
                <div className="relative mb-3 grid grid-cols-1 gap-2 sm:grid-cols-6">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('sales.filterCustomerName')}
                    </span>
                    <input
                      value={historyCustomerQuery}
                      onChange={(e) => {
                        setHistoryCustomerQuery(e.target.value)
                        setHistoryCustomerOpen(true)
                      }}
                      onFocus={() => setHistoryCustomerOpen(true)}
                      onBlur={() =>
                        window.setTimeout(() => setHistoryCustomerOpen(false), 120)
                      }
                      placeholder={t('sales.filterCustomerNamePlaceholder')}
                      className="min-h-9 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="sm:col-span-1">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('dash.from')}
                    </span>
                    <input
                      type="date"
                      value={historyDateFrom}
                      onChange={(e) => setHistoryDateFrom(e.target.value)}
                      className="min-h-9 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="sm:col-span-1">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('dash.to')}
                    </span>
                    <input
                      type="date"
                      value={historyDateTo}
                      onChange={(e) => setHistoryDateTo(e.target.value)}
                      className="min-h-9 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <div className="flex items-end gap-2 sm:col-span-2">
                    <button
                      type="button"
                      disabled={historyLoading}
                      onClick={() => void fetchPaymentHistory(historyDateFrom, historyDateTo)}
                      className="min-h-9 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      {t('dash.apply')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryDateFrom('')
                        setHistoryDateTo('')
                        void fetchPaymentHistory('', '')
                      }}
                      className="min-h-9 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:text-slate-200"
                    >
                      {t('sales.clearFilters')}
                    </button>
                  </div>
                  {historyCustomerOpen && filteredHistoryCustomerNames.length > 0 ? (
                    <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-44 overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-600 dark:bg-slate-900">
                      {filteredHistoryCustomerNames.map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            onClick={() => {
                              setHistoryCustomerQuery(name)
                              setHistoryCustomerOpen(false)
                            }}
                            className="w-full px-3 py-2 text-start text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            {name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="max-h-[65dvh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/80">
                      <tr>
                        <th className="px-3 py-2 text-start">
                          {t('cashier.ledgerColDate')}
                        </th>
                        <th className="px-3 py-2 text-start">
                          {t('cashier.ledgerColLabel')}
                        </th>
                        <th className="px-3 py-2 text-end">{t('cashier.ledgerColAmount')}</th>
                        {canRecordPayment ? (
                          <th className="sticky end-0 z-10 min-w-[3rem] bg-slate-50 px-2 py-2 text-center shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.15)] dark:bg-slate-800/95 dark:shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.35)]">
                            {t('purchasePage.colActions')}
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistoryRows.length === 0 ? (
                        <tr>
                          <td colSpan={historyPaymentsColSpan} className="px-3 py-4 text-sm text-slate-500">
                            {t('crud.noRows')}
                          </td>
                        </tr>
                      ) : (
                        filteredHistoryRows.map((r) => (
                          <tr
                            key={`${r.kind}-${r.id}-${r.occurred_at ?? r.occurred_on}`}
                            className="border-t border-slate-100 dark:border-slate-700"
                          >
                            <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">
                              {formatDateTimeCell(r.occurred_at ?? r.occurred_on)}
                            </td>
                            <td className="px-3 py-2">{r.label}</td>
                            <td className="px-3 py-2 text-end font-mono tabular-nums">
                              {formatMoneyCompact(r.amount_usd)}
                            </td>
                            {canRecordPayment ? (
                              <td className="sticky end-0 z-10 border-s border-slate-100 bg-white px-2 py-2 text-center align-middle shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[-6px_0_8px_-4px_rgba(0,0,0,0.35)]">
                                {r.id > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => void openHistoryEdit(r)}
                                    className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                                    title={t('purchasePage.editHistoryRow')}
                                    aria-label={t('purchasePage.editHistoryRow')}
                                  >
                                    <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                                  </button>
                                ) : null}
                              </td>
                            ) : null}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {historyEditOpen ? (
        <div
          className="fixed inset-0 z-[220] flex items-end justify-center bg-black/55 p-4 sm:items-center lg:pr-64"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeHistoryEdit()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-history-edit-title"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-600 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="customer-history-edit-title"
              className="text-start text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              {t('customerDebtsPage.paymentsHistoryEditTitle')}
            </h3>
            <p className="mt-2 text-start text-xs text-slate-500 dark:text-slate-400">
              {t('customerDebtsPage.paymentsHistoryEditHint')}
            </p>
            {historyEditError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {historyEditError}
              </p>
            ) : null}
            {historyEditLoading ? (
              <p className="mt-4 text-sm text-slate-500">{t('common.loading')}</p>
            ) : (
              <>
                <p className="mt-3 text-start text-sm font-medium text-slate-800 dark:text-slate-100">
                  {historyEditLabel}
                </p>
                <div className="mt-4 grid grid-cols-1 gap-3 text-start">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('inv.historyEditOccurredAt')}
                    </span>
                    <input
                      type="datetime-local"
                      value={historyEditOccurredAt}
                      onChange={(e) => setHistoryEditOccurredAt(e.target.value)}
                      disabled={historyEditBlocked}
                      className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('cashier.ledgerColAmount')}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={historyEditAmountUsd}
                      onChange={(e) => setHistoryEditAmountUsd(e.target.value)}
                      disabled={historyEditBlocked}
                      className="min-h-10 rounded-lg border border-slate-200 px-2 py-1.5 font-mono text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeHistoryEdit}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600 dark:text-slate-200"
                  >
                    {t('crud.cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={historyEditSaving || historyEditBlocked || historyEditLoading}
                    onClick={() => void saveHistoryEdit()}
                    className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {historyEditSaving ? t('pos.saving') : t('crud.save')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
