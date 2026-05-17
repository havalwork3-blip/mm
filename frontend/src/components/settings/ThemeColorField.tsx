import { normalizeHex } from '../../lib/themeColors'

const HEX_RE = /^#([0-9a-fA-F]{6})$/

type Props = {
  label: string
  value: string
  fallback: string
  presets?: string[]
  onChange: (hex: string) => void
}

export function ThemeColorField({ label, value, fallback, presets, onChange }: Props) {
  const normalized = normalizeHex(value, fallback)
  const pickerValue = HEX_RE.test(normalized) ? normalized : fallback

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-900/50">
      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</p>
      {presets && presets.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((color) => {
            const active = normalized.toLowerCase() === color.toLowerCase()
            return (
              <button
                key={color}
                type="button"
                onClick={() => onChange(color)}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  active
                    ? 'scale-110 border-white ring-2 ring-slate-400 dark:ring-slate-300'
                    : 'border-white/80 hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                aria-label={color}
                title={color}
              />
            )
          })}
        </div>
      ) : null}
      <label className="mt-2 flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5 dark:border-slate-600"
          aria-label={label}
        />
        <span className="text-[10px] font-medium uppercase text-slate-500">HEX</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-800"
        />
      </label>
    </div>
  )
}
