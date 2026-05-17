import {
  ACCENT_PRESETS,
  BACKGROUND_PRESETS,
  PRIMARY_PRESETS,
  THEME_PALETTE_DEFAULTS,
  type ThemePalette,
} from '../../lib/themeColors'
import type { ShopSettingsRow } from '../../types/api'
import { ThemeColorField } from './ThemeColorField'

const STATUS_PRESETS = ['#16a34a', '#22c55e', '#f59e0b', '#eab308', '#ef4444', '#dc2626']
const DARK_BG_PRESETS = ['#0f172a', '#111827', '#1e293b', '#18181b', '#172554']
const SURFACE_PRESETS = ['#ffffff', '#f8fafc', '#f1f5f9', '#fafafa']
const SURFACE_DARK_PRESETS = ['#1e293b', '#334155', '#1f2937', '#27272a']

type Props = {
  t: (key: string) => string
  shopSettings: ShopSettingsRow
  previewPalette: ThemePalette
  resolvedMode: 'light' | 'dark'
  mode: 'light' | 'dark' | 'system'
  onPatch: (patch: Partial<ShopSettingsRow>) => void
  onModeChange: (mode: 'light' | 'dark') => void
  onReset: () => void
}

export function SettingsAppearanceSection({
  t,
  shopSettings,
  previewPalette,
  resolvedMode,
  mode,
  onPatch,
  onModeChange,
  onReset,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800 lg:col-span-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{t('settings.appearance')}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('settings.appearanceHint')}</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          {t('settings.resetTheme')}
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">{t('settings.themeMode')}</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{t('settings.themeModeHint')}</p>
          <select
            value={shopSettings.default_mode === 'system' ? mode : shopSettings.default_mode}
            onChange={(e) => onModeChange(e.target.value as 'light' | 'dark')}
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="light">{t('settings.lightMode')}</option>
            <option value="dark">{t('settings.darkMode')}</option>
          </select>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">{t('settings.themeModeSidebarHint')}</p>
        </div>

        <div className="rounded-xl border border-dashed border-slate-300 p-4 lg:col-span-8 dark:border-slate-600">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{t('settings.themePreview')}</p>
          <div
            className="mt-3 flex min-h-[140px] overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600"
            style={{
              backgroundColor:
                resolvedMode === 'dark'
                  ? previewPalette.darkBackgroundColor
                  : previewPalette.backgroundColor,
            }}
          >
            <div
              className="w-24 shrink-0 p-2 text-[10px] text-white"
              style={{ backgroundColor: previewPalette.sidebarColor }}
            >
              <p className="font-semibold opacity-90">Menu</p>
              <p className="mt-2 opacity-70">· Home</p>
              <p className="opacity-70">· POS</p>
            </div>
            <div className="min-w-0 flex-1 p-3">
              <div
                className="rounded-lg border border-slate-200/80 p-2 shadow-sm dark:border-slate-600/80"
                style={{
                  backgroundColor:
                    resolvedMode === 'dark'
                      ? previewPalette.surfaceColorDark
                      : previewPalette.surfaceColor,
                }}
              >
                <p className="text-[11px] font-medium text-slate-800 dark:text-slate-100">Card</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: previewPalette.primaryColor }}
                  >
                    Primary
                  </span>
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: previewPalette.accentColor }}
                  >
                    Accent
                  </span>
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: previewPalette.successColor }}
                  >
                    OK
                  </span>
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: previewPalette.warningColor }}
                  >
                    !
                  </span>
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: previewPalette.dangerColor }}
                  >
                    ×
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {t('settings.systemColors')}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ThemeColorField
          label={t('settings.primaryColor')}
          value={shopSettings.primary_color}
          fallback={THEME_PALETTE_DEFAULTS.primaryColor}
          presets={PRIMARY_PRESETS}
          onChange={(hex) => onPatch({ primary_color: hex })}
        />
        <ThemeColorField
          label={t('settings.accentColor')}
          value={shopSettings.accent_color ?? ''}
          fallback={THEME_PALETTE_DEFAULTS.accentColor}
          presets={ACCENT_PRESETS}
          onChange={(hex) => onPatch({ accent_color: hex })}
        />
        <ThemeColorField
          label={t('settings.backgroundColor')}
          value={shopSettings.background_color ?? ''}
          fallback={THEME_PALETTE_DEFAULTS.backgroundColor}
          presets={BACKGROUND_PRESETS}
          onChange={(hex) => onPatch({ background_color: hex })}
        />
        <ThemeColorField
          label={t('settings.darkBackgroundColor')}
          value={shopSettings.dark_background_color ?? ''}
          fallback={THEME_PALETTE_DEFAULTS.darkBackgroundColor}
          presets={DARK_BG_PRESETS}
          onChange={(hex) => onPatch({ dark_background_color: hex })}
        />
        <ThemeColorField
          label={t('settings.sidebarColor')}
          value={shopSettings.sidebar_color ?? ''}
          fallback={THEME_PALETTE_DEFAULTS.sidebarColor}
          presets={DARK_BG_PRESETS}
          onChange={(hex) => onPatch({ sidebar_color: hex })}
        />
        <ThemeColorField
          label={t('settings.surfaceColor')}
          value={shopSettings.surface_color ?? ''}
          fallback={THEME_PALETTE_DEFAULTS.surfaceColor}
          presets={SURFACE_PRESETS}
          onChange={(hex) => onPatch({ surface_color: hex })}
        />
        <ThemeColorField
          label={t('settings.surfaceColorDark')}
          value={shopSettings.surface_color_dark ?? ''}
          fallback={THEME_PALETTE_DEFAULTS.surfaceColorDark}
          presets={SURFACE_DARK_PRESETS}
          onChange={(hex) => onPatch({ surface_color_dark: hex })}
        />
        <ThemeColorField
          label={t('settings.successColor')}
          value={shopSettings.success_color ?? ''}
          fallback={THEME_PALETTE_DEFAULTS.successColor}
          presets={STATUS_PRESETS}
          onChange={(hex) => onPatch({ success_color: hex })}
        />
        <ThemeColorField
          label={t('settings.warningColor')}
          value={shopSettings.warning_color ?? ''}
          fallback={THEME_PALETTE_DEFAULTS.warningColor}
          presets={STATUS_PRESETS}
          onChange={(hex) => onPatch({ warning_color: hex })}
        />
        <ThemeColorField
          label={t('settings.dangerColor')}
          value={shopSettings.danger_color ?? ''}
          fallback={THEME_PALETTE_DEFAULTS.dangerColor}
          presets={STATUS_PRESETS}
          onChange={(hex) => onPatch({ danger_color: hex })}
        />
      </div>
    </section>
  )
}
