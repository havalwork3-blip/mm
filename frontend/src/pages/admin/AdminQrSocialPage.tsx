import { Copy, Download, Loader2, MessageCircle, Plus, QrCode, Send, Share2, Trash2 } from 'lucide-react'
import QRCode from 'qrcode'
import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { useLocale } from '../../context/LocaleContext'
import { useSubmitLock } from '../../hooks/useSubmitLock'
import { apiFetch, apiJson, resolveMediaUrl } from '../../lib/api'
import type {
  QrLandingAdminResponse,
  QrLandingCustomLinkRow,
  QrLandingPresetRow,
} from '../../types/api'

/** Matches `color.light` when generating the sidebar QR (JPG export uses same fill). */
const QR_SIDEBAR_LIGHT = '#faf6f0'

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function pngDataUrlToJpegDataUrl(pngDataUrl: string, bgHex: string, quality = 0.92): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('no canvas'))
          return
        }
        ctx.fillStyle = bgHex
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = pngDataUrl
  })
}

function SafeLogoPreview({
  src,
  className,
  emptyClassName = 'text-xs text-slate-400',
}: {
  src: string | null
  className?: string
  emptyClassName?: string
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [src])
  if (!src || failed) {
    return <span className={emptyClassName}>—</span>
  }
  return <img src={src} alt="" className={className} onError={() => setFailed(true)} />
}

const PRESET_META: { id: string; labelKey: string }[] = [
  { id: 'instagram', labelKey: 'qrAdmin.platform.instagram' },
  { id: 'facebook', labelKey: 'qrAdmin.platform.facebook' },
  { id: 'tiktok', labelKey: 'qrAdmin.platform.tiktok' },
  { id: 'youtube', labelKey: 'qrAdmin.platform.youtube' },
  { id: 'whatsapp', labelKey: 'qrAdmin.platform.whatsapp' },
  { id: 'telegram', labelKey: 'qrAdmin.platform.telegram' },
  { id: 'snapchat', labelKey: 'qrAdmin.platform.snapchat' },
  { id: 'x', labelKey: 'qrAdmin.platform.x' },
  { id: 'website', labelKey: 'qrAdmin.platform.website' },
]

export function AdminQrSocialPage() {
  const { t } = useLocale()
  const [cfg, setCfg] = useState<QrLandingAdminResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { isSubmitting: addingCustomLink, runLocked: runAddCustomLink } = useSubmitLock()
  const [error, setError] = useState<string | null>(null)
  const [copyDone, setCopyDone] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [primaryLogoUploading, setPrimaryLogoUploading] = useState(false)
  const [primaryLogoPreviewUrl, setPrimaryLogoPreviewUrl] = useState<string | null>(null)
  const primaryLogoPreviewRef = useRef<string | null>(null)

  const [managerTokenInput, setManagerTokenInput] = useState('')
  const [managerTelegramTesting, setManagerTelegramTesting] = useState(false)
  const [managerTelegramSending, setManagerTelegramSending] = useState(false)
  const [managerTelegramMsg, setManagerTelegramMsg] = useState<string | null>(null)

  const [newCustom, setNewCustom] = useState({
    label: '',
    url: 'https://',
    bg_color: '#14110f',
    sort_order: 0,
    logoFile: null as File | null,
  })

  const landingUrl = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URL('/qr-code', window.location.origin).href
  }, [])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const data = await apiJson<QrLandingAdminResponse>('/api/admin/qr-landing/', {
        omitShopScope: true,
      })
      setCfg(data)
    } catch (e) {
      if (!opts?.silent) setCfg(null)
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      if (primaryLogoPreviewRef.current) {
        URL.revokeObjectURL(primaryLogoPreviewRef.current)
        primaryLogoPreviewRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!landingUrl) {
      setQrDataUrl(null)
      return
    }
    let cancelled = false
    void QRCode.toDataURL(landingUrl, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1a1410', light: QR_SIDEBAR_LIGHT },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [landingUrl])

  function setPrimaryLogoLocalPreview(file: File) {
    if (primaryLogoPreviewRef.current) {
      URL.revokeObjectURL(primaryLogoPreviewRef.current)
    }
    const url = URL.createObjectURL(file)
    primaryLogoPreviewRef.current = url
    setPrimaryLogoPreviewUrl(url)
  }

  function clearPrimaryLogoLocalPreview() {
    if (primaryLogoPreviewRef.current) {
      URL.revokeObjectURL(primaryLogoPreviewRef.current)
      primaryLogoPreviewRef.current = null
    }
    setPrimaryLogoPreviewUrl(null)
  }

  async function saveManagerTelegram(e: FormEvent) {
    e.preventDefault()
    if (!cfg) return
    setSaving(true)
    setError(null)
    setManagerTelegramMsg(null)
    try {
      await apiJson<QrLandingAdminResponse>('/api/admin/qr-landing/', {
        method: 'PATCH',
        omitShopScope: true,
        body: JSON.stringify({
          manager_telegram_notify_enabled: cfg.manager_telegram_notify_enabled,
          manager_telegram_chat_id: cfg.manager_telegram_chat_id,
          manager_telegram_send_hour: cfg.manager_telegram_send_hour,
          manager_telegram_send_minute: cfg.manager_telegram_send_minute,
          ...(managerTokenInput.trim()
            ? { manager_telegram_bot_token: managerTokenInput.trim() }
            : {}),
        }),
      })
      setManagerTokenInput('')
      await load({ silent: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function testManagerTelegram() {
    setManagerTelegramTesting(true)
    setManagerTelegramMsg(null)
    try {
      const res = await apiJson<{ ok: boolean }>('/api/admin/qr-landing/manager-telegram-test/', {
        method: 'POST',
        omitShopScope: true,
      })
      setManagerTelegramMsg(res.ok ? t('qrAdmin.managerTelegramTestOk') : t('qrAdmin.managerTelegramTestFail'))
    } catch (e) {
      setManagerTelegramMsg(e instanceof Error ? e.message : t('qrAdmin.managerTelegramTestFail'))
    } finally {
      setManagerTelegramTesting(false)
    }
  }

  async function sendManagerTelegramNow() {
    setManagerTelegramSending(true)
    setManagerTelegramMsg(null)
    try {
      const res = await apiJson<{
        ok?: boolean
        status?: string
        sent: number
        shops: number
        shop_ok?: number
        failed?: { id: number; name: string; error: string }[]
      }>('/api/admin/qr-landing/manager-telegram-send-now/', {
        method: 'POST',
        omitShopScope: true,
      })
      if (res.failed?.length) {
        const names = res.failed.map((f) => f.name).join(', ')
        setManagerTelegramMsg(
          t('qrAdmin.managerTelegramSendPartial')
            .replace('{ok}', String(res.shop_ok ?? res.sent))
            .replace('{shops}', String(res.shops))
            .replace('{failed}', names),
        )
      } else {
        setManagerTelegramMsg(
          t('qrAdmin.managerTelegramSendOk')
            .replace('{sent}', String(res.sent))
            .replace('{shops}', String(res.shops)),
        )
      }
      await load({ silent: true })
    } catch (e) {
      setManagerTelegramMsg(e instanceof Error ? e.message : t('qrAdmin.managerTelegramSendFail'))
    } finally {
      setManagerTelegramSending(false)
    }
  }

  async function saveMain(e: FormEvent) {
    e.preventDefault()
    if (!cfg) return
    setSaving(true)
    setError(null)
    try {
      await apiJson<QrLandingAdminResponse>('/api/admin/qr-landing/', {
        method: 'PATCH',
        body: JSON.stringify({
          headline: cfg.headline,
          tagline: cfg.tagline,
          accent_color: cfg.accent_color || '#c9a962',
          phone: cfg.phone,
          preset_links: cfg.preset_links,
        }),
        omitShopScope: true,
      })
      await load({ silent: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  function updatePreset(id: string, patch: Partial<QrLandingPresetRow>) {
    setCfg((c) => {
      if (!c) return c
      return {
        ...c,
        preset_links: c.preset_links.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      }
    })
  }

  async function uploadPrimaryLogo(file: File) {
    if (!file.type.startsWith('image/')) {
      setError(t('qrAdmin.logoInvalidType'))
      return
    }
    setError(null)
    setPrimaryLogoUploading(true)
    setPrimaryLogoLocalPreview(file)
    const fd = new FormData()
    fd.append('logo', file)
    try {
      const res = await apiFetch('/api/admin/qr-landing/logo/', {
        method: 'POST',
        body: fd,
        omitShopScope: true,
      })
      if (!res.ok) {
        let detail = res.statusText
        try {
          const j = (await res.json()) as { detail?: string }
          if (j.detail) detail = j.detail
        } catch {
          /* ignore */
        }
        throw new Error(detail)
      }
      const body = (await res.json()) as { primary_logo_url: string | null }
      clearPrimaryLogoLocalPreview()
      setCfg((c) => (c ? { ...c, primary_logo_url: body.primary_logo_url } : c))
    } catch (e) {
      clearPrimaryLogoLocalPreview()
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setPrimaryLogoUploading(false)
    }
  }

  async function removePrimaryLogo() {
    setError(null)
    setPrimaryLogoUploading(true)
    try {
      const res = await apiFetch('/api/admin/qr-landing/logo/', {
        method: 'DELETE',
        omitShopScope: true,
      })
      if (!res.ok) {
        let detail = res.statusText
        try {
          const j = (await res.json()) as { detail?: string }
          if (j.detail) detail = j.detail
        } catch {
          /* ignore */
        }
        throw new Error(detail)
      }
      clearPrimaryLogoLocalPreview()
      setCfg((c) => (c ? { ...c, primary_logo_url: null } : c))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setPrimaryLogoUploading(false)
    }
  }

  async function addCustomLink(e: FormEvent) {
    e.preventDefault()
    await runAddCustomLink(async () => {
      if (!newCustom.label.trim() || !newCustom.url.trim()) return
      setError(null)
      const fd = new FormData()
      fd.append('label', newCustom.label.trim())
      fd.append('url', newCustom.url.trim())
      fd.append('enabled', 'true')
      fd.append('sort_order', String(newCustom.sort_order))
      fd.append('bg_color', newCustom.bg_color)
      if (newCustom.logoFile) fd.append('logo', newCustom.logoFile)
      try {
        await apiFetch('/api/admin/qr-landing/custom-links/', { method: 'POST', body: fd })
        setNewCustom({
          label: '',
          url: 'https://',
          bg_color: '#14110f',
          sort_order: 0,
          logoFile: null,
        })
        await load({ silent: true })
      } catch (err) {
        setError(err instanceof Error ? err.message : t('common.error'))
      }
    })
  }

  async function deleteCustomLink(id: number) {
    if (!window.confirm(`${t('qrAdmin.deleteCustomLink')} (#${id})?`)) return
    setError(null)
    try {
      await apiJson(`/api/admin/qr-landing/custom-links/${id}/`, {
        method: 'DELETE',
        omitShopScope: true,
      })
      await load({ silent: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  async function patchCustomRow(
    id: number,
    body: {
      label: string
      url: string
      enabled: boolean
      bg_color: string
      sort_order: number
      logoFile?: File | null
    },
  ) {
    setError(null)
    try {
      if (body.logoFile) {
        const fd = new FormData()
        fd.append('label', body.label)
        fd.append('url', body.url)
        fd.append('enabled', body.enabled ? 'true' : 'false')
        fd.append('sort_order', String(body.sort_order))
        fd.append('bg_color', body.bg_color)
        fd.append('logo', body.logoFile)
        await apiFetch(`/api/admin/qr-landing/custom-links/${id}/`, {
          method: 'PATCH',
          body: fd,
        })
      } else {
        await apiJson(`/api/admin/qr-landing/custom-links/${id}/`, {
          method: 'PATCH',
          body: JSON.stringify({
            label: body.label,
            url: body.url,
            enabled: body.enabled,
            bg_color: body.bg_color,
            sort_order: body.sort_order,
          }),
          omitShopScope: true,
        })
      }
      await load({ silent: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  async function copyLandingUrl() {
    if (!landingUrl) return
    try {
      await navigator.clipboard.writeText(landingUrl)
      setCopyDone(true)
      window.setTimeout(() => setCopyDone(false), 2000)
    } catch {
      setError(t('qrAdmin.copyFailed'))
    }
  }

  function downloadQrPng() {
    if (!qrDataUrl) return
    setError(null)
    downloadDataUrl(qrDataUrl, 'qr-code.png')
  }

  async function downloadQrJpg() {
    if (!qrDataUrl) return
    setError(null)
    try {
      const jpeg = await pngDataUrlToJpegDataUrl(qrDataUrl, QR_SIDEBAR_LIGHT)
      downloadDataUrl(jpeg, 'qr-code.jpg')
    } catch {
      setError(t('qrAdmin.downloadJpgFailed'))
    }
  }

  const primaryLogoResolved = useMemo(() => {
    if (primaryLogoPreviewUrl) return primaryLogoPreviewUrl
    return resolveMediaUrl(cfg?.primary_logo_url ?? null)
  }, [primaryLogoPreviewUrl, cfg?.primary_logo_url])

  return (
    <div className="space-y-8 text-start">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Share2 className="h-7 w-7 text-amber-700 dark:text-amber-400" aria-hidden />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('admin.qrSocial')}</h1>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        {loading || !cfg ? (
          <p className="text-slate-500">{t('common.loading')}</p>
        ) : (
          <div className="space-y-6">
            <form onSubmit={saveMain} className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('qrAdmin.pageCopy')}</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('qrAdmin.headline')}
                    </label>
                    <input
                      value={cfg.headline}
                      onChange={(e) => setCfg((c) => (c ? { ...c, headline: e.target.value } : c))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                    />
                    <p className="mt-1 text-xs text-slate-500">{t('qrAdmin.headlineHint')}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('qrAdmin.tagline')}
                    </label>
                    <input
                      value={cfg.tagline}
                      onChange={(e) => setCfg((c) => (c ? { ...c, tagline: e.target.value } : c))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('qrAdmin.phone')}
                    </label>
                    <input
                      dir="ltr"
                      value={cfg.phone}
                      onChange={(e) => setCfg((c) => (c ? { ...c, phone: e.target.value } : c))}
                      placeholder="+964 ..."
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-900"
                    />
                    <p className="mt-1 text-xs text-slate-500">{t('qrAdmin.phoneHint')}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('qrAdmin.accent')}
                    </label>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <input
                        type="color"
                        value={cfg.accent_color?.trim() || '#c9a962'}
                        onChange={(e) => setCfg((c) => (c ? { ...c, accent_color: e.target.value } : c))}
                        className="h-11 w-16 cursor-pointer rounded border border-slate-200 bg-white p-1 dark:border-slate-600"
                      />
                      <input
                        value={cfg.accent_color}
                        onChange={(e) => setCfg((c) => (c ? { ...c, accent_color: e.target.value } : c))}
                        placeholder="#c9a962"
                        className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-900"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{t('qrAdmin.accentHint')}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('qrAdmin.primaryLogo')}</h2>
                <div className="mt-3 flex flex-wrap items-start gap-4">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900">
                    <SafeLogoPreview
                      src={primaryLogoResolved}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800 ${primaryLogoUploading ? 'pointer-events-none opacity-60' : ''}`}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={primaryLogoUploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          e.target.value = ''
                          if (f) void uploadPrimaryLogo(f)
                        }}
                      />
                      {primaryLogoUploading ? t('common.loading') : t('qrAdmin.uploadLogo')}
                    </label>
                    {primaryLogoResolved ? (
                      <button
                        type="button"
                        disabled={primaryLogoUploading}
                        onClick={() => void removePrimaryLogo()}
                        className="text-start text-sm text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400"
                      >
                        {t('qrAdmin.removeLogo')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('qrAdmin.linksTitle')}</h2>
                <p className="mt-1 text-xs text-slate-500">{t('qrAdmin.linksHint')}</p>
                <ul className="mt-4 space-y-4">
                  {cfg.preset_links.map((link) => (
                    <li
                      key={link.id}
                      className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 sm:flex-row sm:items-center dark:border-slate-600 dark:bg-slate-900/50"
                    >
                      <label className="flex shrink-0 items-center gap-2 sm:w-40">
                        <input
                          type="checkbox"
                          checked={link.enabled}
                          onChange={(e) => updatePreset(link.id, { enabled: e.target.checked })}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                          {t(PRESET_META.find((p) => p.id === link.id)?.labelKey ?? 'qrAdmin.platform.website')}
                        </span>
                      </label>
                      <input
                        type="url"
                        inputMode="url"
                        value={link.url}
                        onChange={(e) => updatePreset(link.id, { url: e.target.value })}
                        placeholder="https://"
                        disabled={!link.enabled}
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900"
                      />
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-amber-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                {saving ? t('common.loading') : t('settings.save')}
              </button>
            </form>

            <form
              onSubmit={saveManagerTelegram}
              className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-sm dark:border-violet-900/40 dark:from-violet-950/25 dark:to-slate-800"
            >
              <h2 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                <MessageCircle className="h-5 w-5 text-violet-600 dark:text-violet-400" aria-hidden />
                {t('qrAdmin.managerTelegramSection')}
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {t('qrAdmin.managerTelegramHint')}
              </p>
              <label className="mt-4 flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={cfg.manager_telegram_notify_enabled}
                  onChange={(e) =>
                    setCfg((c) =>
                      c ? { ...c, manager_telegram_notify_enabled: e.target.checked } : c,
                    )
                  }
                  className="h-4 w-4 rounded border-slate-300 text-violet-600"
                />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {t('qrAdmin.managerTelegramEnabled')}
                </span>
              </label>
              {cfg.manager_telegram_notify_enabled ? (
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('qrAdmin.managerTelegramBotToken')}
                    </label>
                    <input
                      type="password"
                      dir="ltr"
                      value={managerTokenInput}
                      onChange={(e) => setManagerTokenInput(e.target.value)}
                      placeholder={
                        cfg.manager_telegram_bot_token_masked ||
                        '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-900"
                    />
                    <p className="mt-1 text-xs text-slate-500">{t('qrAdmin.managerTelegramBotTokenHint')}</p>
                    {cfg.manager_telegram_bot_token_masked && !managerTokenInput ? (
                      <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                        {t('qrAdmin.managerTelegramTokenSaved')}:{' '}
                        {cfg.manager_telegram_bot_token_masked}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('qrAdmin.managerTelegramChatId')}
                    </label>
                    <input
                      dir="ltr"
                      value={cfg.manager_telegram_chat_id}
                      onChange={(e) =>
                        setCfg((c) => (c ? { ...c, manager_telegram_chat_id: e.target.value } : c))
                      }
                      placeholder="123456789"
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-900"
                    />
                    <p className="mt-1 text-xs text-slate-500">{t('qrAdmin.managerTelegramChatIdHint')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t('qrAdmin.managerTelegramSendTime')}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={cfg.manager_telegram_send_hour}
                        onChange={(e) =>
                          setCfg((c) =>
                            c
                              ? {
                                  ...c,
                                  manager_telegram_send_hour: Math.min(
                                    23,
                                    Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                                  ),
                                }
                              : c,
                          )
                        }
                        className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                      />
                      <span className="text-slate-500">:</span>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={cfg.manager_telegram_send_minute}
                        onChange={(e) =>
                          setCfg((c) =>
                            c
                              ? {
                                  ...c,
                                  manager_telegram_send_minute: Math.min(
                                    59,
                                    Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                                  ),
                                }
                              : c,
                          )
                        }
                        className="w-20 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                      />
                    </div>
                    {cfg.manager_telegram_last_sent_date ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {t('qrAdmin.managerTelegramLastSent')}: {cfg.manager_telegram_last_sent_date}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-slate-400">{t('qrAdmin.managerTelegramCronHint')}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
                    >
                      {saving ? t('common.loading') : t('settings.save')}
                    </button>
                    <button
                      type="button"
                      disabled={managerTelegramTesting}
                      onClick={() => void testManagerTelegram()}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {managerTelegramTesting ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <MessageCircle className="h-4 w-4" aria-hidden />
                      )}
                      {t('qrAdmin.managerTelegramTest')}
                    </button>
                    <button
                      type="button"
                      disabled={managerTelegramSending}
                      onClick={() => void sendManagerTelegramNow()}
                      className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-200 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
                    >
                      {managerTelegramSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Send className="h-4 w-4" aria-hidden />
                      )}
                      {t('qrAdmin.managerTelegramSendNow')}
                    </button>
                  </div>
                  {managerTelegramMsg ? (
                    <p className="text-xs text-slate-600 dark:text-slate-300">{managerTelegramMsg}</p>
                  ) : null}
                </div>
              ) : null}
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t('qrAdmin.customLinksTitle')}</h2>
              <p className="mt-1 text-xs text-slate-500">{t('qrAdmin.customLinksHint')}</p>

              <ul className="mt-4 space-y-6">
                {cfg.custom_links.map((row) => (
                  <CustomLinkEditor
                    key={row.id}
                    row={row}
                    t={t}
                    onDelete={() => void deleteCustomLink(row.id)}
                    onSave={(payload) => void patchCustomRow(row.id, payload)}
                  />
                ))}
              </ul>

              <form onSubmit={addCustomLink} className="mt-6 space-y-3 rounded-xl border border-dashed border-slate-300 p-4 dark:border-slate-600">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('qrAdmin.addCustomLink')}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={newCustom.label}
                    onChange={(e) => setNewCustom((s) => ({ ...s, label: e.target.value }))}
                    placeholder={t('qrAdmin.headline')}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                  />
                  <input
                    dir="ltr"
                    value={newCustom.url}
                    onChange={(e) => setNewCustom((s) => ({ ...s, url: e.target.value }))}
                    placeholder="https://"
                    className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-900"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-slate-500">{t('qrAdmin.linkBg')}</label>
                    <input
                      type="color"
                      value={newCustom.bg_color}
                      onChange={(e) => setNewCustom((s) => ({ ...s, bg_color: e.target.value }))}
                      className="h-9 w-14 cursor-pointer rounded border border-slate-200 p-0.5 dark:border-slate-600"
                    />
                    <input
                      value={newCustom.bg_color}
                      onChange={(e) => setNewCustom((s) => ({ ...s, bg_color: e.target.value }))}
                      className="w-28 rounded border border-slate-200 px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-900"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">{t('qrAdmin.sortOrder')}</label>
                    <input
                      type="number"
                      min={0}
                      value={newCustom.sort_order}
                      onChange={(e) =>
                        setNewCustom((s) => ({ ...s, sort_order: Number(e.target.value) || 0 }))
                      }
                      className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="text-sm text-slate-600 dark:text-slate-400">{t('qrAdmin.rowLogo')}</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      setNewCustom((s) => ({ ...s, logoFile: e.target.files?.[0] ?? null }))
                    }
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingCustomLink}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  {addingCustomLink ? t('common.loading') : t('qrAdmin.addCustomLink')}
                </button>
              </form>
            </div>
          </div>
        )}

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-5 shadow-sm dark:border-amber-900/40 dark:from-amber-950/30 dark:to-slate-800">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <QrCode className="h-5 w-5" aria-hidden />
              <h3 className="font-semibold">{t('qrAdmin.publicUrl')}</h3>
            </div>
            <p className="mt-2 break-all font-mono text-xs text-slate-700 dark:text-slate-300">{landingUrl || '—'}</p>
            <button
              type="button"
              onClick={() => void copyLandingUrl()}
              disabled={!landingUrl}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-slate-800"
            >
              <Copy className="h-4 w-4" aria-hidden />
              {copyDone ? t('qrAdmin.copied') : t('qrAdmin.copyUrl')}
            </button>
            <div className="mt-4">
            <ErrorBoundary
                fallback={
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    {t('qrAdmin.qrPreviewFailed')}
                  </p>
                }
              >
                {qrDataUrl ? (
                  <div className="flex flex-col items-center">
                    <img src={qrDataUrl} alt="" width={220} height={220} className="rounded-xl border border-white shadow-md" />
                    <div className="mt-3 flex w-full flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={downloadQrPng}
                    className="inline-flex flex-1 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2 py-2 text-xs font-medium text-amber-950 hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {t('qrAdmin.downloadPng')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void downloadQrJpg()}
                    className="inline-flex flex-1 min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2 py-2 text-xs font-medium text-amber-950 hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {t('qrAdmin.downloadJpg')}
                  </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
                )}
            </ErrorBoundary>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function CustomLinkEditor({
  row,
  t,
  onDelete,
  onSave,
}: {
  row: QrLandingCustomLinkRow
  t: (k: string) => string
  onDelete: () => void
  onSave: (payload: {
    label: string
    url: string
    enabled: boolean
    bg_color: string
    sort_order: number
    logoFile?: File | null
  }) => void
}) {
  const [label, setLabel] = useState(row.label)
  const [url, setUrl] = useState(row.url)
  const [enabled, setEnabled] = useState(row.enabled)
  const [bg_color, setBgColor] = useState(row.bg_color || '#14110f')
  const [sort_order, setSortOrder] = useState(row.sort_order)
  const [logoFile, setLogoFile] = useState<File | null>(null)

  useEffect(() => {
    setLabel(row.label)
    setUrl(row.url)
    setEnabled(row.enabled)
    setBgColor(row.bg_color || '#14110f')
    setSortOrder(row.sort_order)
    setLogoFile(null)
  }, [row])

  const thumb = resolveMediaUrl(row.logo_url)

  return (
    <li className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">#{row.id}</span>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 text-sm text-rose-600 hover:underline dark:text-rose-400"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
          {t('qrAdmin.deleteCustomLink')}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <input
          dir="ltr"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="text-slate-600 dark:text-slate-400">{t('admin.colActive')}</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">{t('qrAdmin.sortOrder')}</span>
          <input
            type="number"
            min={0}
            value={sort_order}
            onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
            className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          <span className="text-xs text-slate-500">{t('qrAdmin.linkBg')}</span>
          <input
            type="color"
            value={bg_color}
            onChange={(e) => setBgColor(e.target.value)}
            className="h-9 w-14 cursor-pointer rounded border border-slate-200 p-0.5 dark:border-slate-600"
          />
          <input
            value={bg_color}
            onChange={(e) => setBgColor(e.target.value)}
            className="w-32 rounded border border-slate-200 px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {thumb ? (
          <img src={thumb} alt="" className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-600" />
        ) : null}
        <label className="text-sm text-slate-600 dark:text-slate-400">
          {t('qrAdmin.rowLogo')}
          <input
            type="file"
            accept="image/*"
            className="ms-2 mt-1 max-w-full text-xs"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() =>
          onSave({
            label: label.trim(),
            url: url.trim(),
            enabled,
            bg_color,
            sort_order,
            logoFile: logoFile ?? undefined,
          })
        }
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white dark:bg-slate-200 dark:text-slate-900"
      >
        {t('qrAdmin.saveCustomLink')}
      </button>
    </li>
  )
}
