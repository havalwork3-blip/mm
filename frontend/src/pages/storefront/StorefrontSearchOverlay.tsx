import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { accentAlpha } from './storefrontTheme'

type Props = {
  open: boolean
  value: string
  onChange: (value: string) => void
  onClose: () => void
  placeholder: string
  accent: string
  closeLabel: string
}

export function StorefrontSearchOverlay({
  open,
  value,
  onChange,
  onClose,
  placeholder,
  accent,
  closeLabel,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 120)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="sf-search-overlay fixed inset-0 z-[60] flex flex-col" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        aria-label={closeLabel}
        onClick={onClose}
      />
      <div className="sf-search-panel relative z-10 mx-3 mt-[max(0.75rem,env(safe-area-inset-top))] sm:mx-auto sm:max-w-lg">
        <div className="sf-glass-strong overflow-hidden rounded-3xl border border-white/70 shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-100/80 px-3 py-2">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute start-3.5 top-1/2 h-5 w-5 -translate-y-1/2"
                style={{ color: accent }}
                aria-hidden
              />
              <input
                ref={inputRef}
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-2xl border-0 bg-slate-50/90 py-3.5 pe-3 ps-11 text-[15px] text-slate-800 outline-none ring-1 ring-slate-200/60 placeholder:text-slate-400 focus:ring-2"
                style={{ ['--tw-ring-color' as string]: accentAlpha(accent, 0.45) }}
                autoComplete="off"
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              aria-label={closeLabel}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <p className="px-4 py-2.5 text-center text-[11px] font-medium text-slate-500">
            {placeholder}
          </p>
        </div>
      </div>
    </div>
  )
}
