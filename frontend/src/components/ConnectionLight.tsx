import { Lightbulb, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { buildApiUrl, flushOfflineQueue } from '../lib/api'
import { getOfflineFailedCount, getOfflineQueueSize } from '../lib/offlineQueue'

/** online = server answers; no-internet = device is offline; server-down = online but the server does not answer. */
type Status = 'online' | 'no-internet' | 'server-down'

const CHECK_EVERY_MS = 15_000
const TIMEOUT_MS = 5_000
/** Above this round-trip the connection is reported as slow (still green). */
const SLOW_MS = 1_500
const PANEL_WIDTH = 256

type CheckResult = { status: Status; latencyMs: number | null }

async function checkServer(): Promise<CheckResult> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { status: 'no-internet', latencyMs: null }
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  const started = performance.now()
  try {
    const res = await fetch(buildApiUrl('/api/health/', true, false), {
      cache: 'no-store',
      signal: ctrl.signal,
    })
    const latencyMs = Math.round(performance.now() - started)
    return { status: res.ok ? 'online' : 'server-down', latencyMs: res.ok ? latencyMs : null }
  } catch {
    // fetch can fail while navigator still says "online" (Wi-Fi without internet, server down).
    return {
      status: typeof navigator !== 'undefined' && !navigator.onLine ? 'no-internet' : 'server-down',
      latencyMs: null,
    }
  } finally {
    window.clearTimeout(timer)
  }
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatClock(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

type Props = {
  t: (key: string) => string
  /** Dark box for the slate sidebar footer, light box for the mobile header. */
  variant?: 'light' | 'dark'
}

/**
 * Small bulb: green when the server is reachable, red (pulsing) when there is no connection.
 * Click it for details (status, last check, speed, sales waiting to sync, check now).
 */
export function ConnectionLight({ t, variant = 'light' }: Props) {
  const [status, setStatus] = useState<Status>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'no-internet' : 'online',
  )
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [checking, setChecking] = useState(false)
  const [pending, setPending] = useState(0)
  const [failed, setFailed] = useState(0)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)

  const runCheck = useCallback(async () => {
    setChecking(true)
    const r = await checkServer()
    if (!mountedRef.current) return
    setStatus(r.status)
    setLatencyMs(r.latencyMs)
    setLastCheck(new Date())
    // The browser 'online' event never fires when Wi-Fi stayed up but the server was down:
    // send waiting offline sales as soon as the server answers again.
    if (r.status === 'online' && getOfflineQueueSize() > 0) {
      await flushOfflineQueue()
      if (!mountedRef.current) return
    }
    setPending(getOfflineQueueSize())
    setFailed(getOfflineFailedCount())
    setChecking(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const goOffline = () => {
      setStatus('no-internet')
      setLatencyMs(null)
      setLastCheck(new Date())
    }
    const onOnline = () => void runCheck()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runCheck()
    }
    const first = window.setTimeout(() => void runCheck(), 0)
    const id = window.setInterval(() => void runCheck(), CHECK_EVERY_MS)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', goOffline)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      mountedRef.current = false
      window.clearTimeout(first)
      window.clearInterval(id)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', goOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [runCheck])

  // Place the panel above the bulb, kept inside the viewport (sidebar may be collapsed or RTL).
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const btn = buttonRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const panelH = panelRef.current?.offsetHeight ?? 200
      const left = Math.min(
        Math.max(8, r.left + r.width / 2 - PANEL_WIDTH / 2),
        window.innerWidth - PANEL_WIDTH - 8,
      )
      const above = r.top - panelH - 8
      const top = above >= 8 ? above : Math.min(r.bottom + 8, window.innerHeight - panelH - 8)
      setPos({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, status, pending, failed])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const online = status === 'online'
  const slow = online && latencyMs != null && latencyMs > SLOW_MS
  const title = t(online ? (slow ? 'conn.slow' : 'conn.online') : status === 'no-internet' ? 'conn.offline' : 'conn.serverDown')
  const detail = t(
    online
      ? slow
        ? 'conn.detailSlow'
        : 'conn.detailOnline'
      : status === 'no-internet'
        ? 'conn.detailOffline'
        : 'conn.detailServerDown',
  )
  let label = title
  if (pending > 0) label += ` · ${t('conn.pending').replace('{n}', String(pending))}`

  const box =
    variant === 'dark'
      ? 'border-slate-600 bg-slate-800 hover:border-slate-500'
      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900'
  const bulb = online
    ? 'text-emerald-500 fill-emerald-400/70 drop-shadow-[0_0_6px_rgba(16,185,129,0.7)]'
    : 'animate-pulse text-red-500 fill-red-500/70 drop-shadow-[0_0_6px_rgba(239,68,68,0.8)]'
  const dot = online ? (slow ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-red-500'

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) void runCheck()
        }}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
        className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm transition ${box}`}
      >
        <Lightbulb className={`h-4 w-4 transition-colors ${bulb}`} aria-hidden />
        {pending > 0 ? (
          <span className="absolute -top-1 -end-1 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
            {pending}
          </span>
        ) : null}
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={t('conn.panelTitle')}
              style={{
                position: 'fixed',
                left: pos?.left ?? -9999,
                top: pos?.top ?? -9999,
                width: PANEL_WIDTH,
              }}
              className="z-[300] rounded-xl border border-slate-200 bg-white p-3 text-start text-sm text-slate-700 shadow-xl dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
                <p className="font-semibold text-slate-900 dark:text-slate-100" role="status" aria-live="polite">
                  {title}
                </p>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{detail}</p>

              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">{t('conn.lastCheck')}</dt>
                  <dd className="font-mono tabular-nums">{lastCheck ? formatClock(lastCheck) : '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">{t('conn.speed')}</dt>
                  <dd className="font-mono tabular-nums">{latencyMs != null ? `${latencyMs} ms` : '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">{t('conn.waiting')}</dt>
                  <dd className={`font-mono tabular-nums ${pending > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : ''}`}>
                    {pending}
                  </dd>
                </div>
                {failed > 0 ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">{t('conn.failed')}</dt>
                    <dd className="font-mono font-semibold tabular-nums text-red-600 dark:text-red-400">{failed}</dd>
                  </div>
                ) : null}
              </dl>
              {pending > 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  {t(online ? 'conn.pendingWillSend' : 'conn.pendingKeep')}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void runCheck()}
                disabled={checking}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} aria-hidden />
                {checking ? t('conn.checking') : t('conn.checkNow')}
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
