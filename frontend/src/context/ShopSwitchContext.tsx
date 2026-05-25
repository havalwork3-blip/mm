import { Loader2 } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocale } from './LocaleContext'
import { useSession } from './SessionContext'

const MIN_OVERLAY_MS = 480
const SETTLE_MS = 220

type ShopSwitchCtx = {
  switching: boolean
  runShopSwitch: (work: () => void | Promise<void>) => Promise<void>
}

const Ctx = createContext<ShopSwitchCtx | null>(null)

export function ShopSwitchProvider({ children }: { children: ReactNode }) {
  const { refresh } = useSession()
  const [switching, setSwitching] = useState(false)
  const inFlightRef = useRef(false)

  const runShopSwitch = useCallback(
    async (work: () => void | Promise<void>) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      setSwitching(true)
      const started = Date.now()
      try {
        await work()
        window.dispatchEvent(new Event('mm-dashboard-refresh'))
        window.dispatchEvent(new Event('mm-session-refresh'))
        await refresh()
        const wait = Math.max(0, MIN_OVERLAY_MS - (Date.now() - started))
        if (wait > 0) await new Promise((r) => setTimeout(r, wait))
        await new Promise((r) => setTimeout(r, SETTLE_MS))
      } finally {
        inFlightRef.current = false
        setSwitching(false)
      }
    },
    [refresh],
  )

  const value = useMemo(
    () => ({ switching, runShopSwitch }),
    [switching, runShopSwitch],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useShopSwitch(): ShopSwitchCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useShopSwitch outside ShopSwitchProvider')
  return ctx
}

/** Safe when provider is absent (e.g. tests). */
export function useShopSwitchOptional(): ShopSwitchCtx | null {
  return useContext(Ctx)
}

export function ShopSwitchLoadingOverlay() {
  const { switching } = useShopSwitch()
  const { t } = useLocale()
  if (!switching) return null
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[60] flex items-center justify-center bg-[var(--app-bg-color,#f1f5f9)]/75 backdrop-blur-[2px] dark:bg-slate-900/80"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-8 py-6 shadow-lg dark:border-slate-600 dark:bg-slate-800/95">
        <Loader2 className="h-9 w-9 animate-spin text-violet-600 dark:text-violet-400" aria-hidden />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('nav.switchingShop')}
        </p>
      </div>
    </div>
  )
}
