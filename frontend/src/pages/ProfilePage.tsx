import { Calendar, Camera, Clock, Mail, Shield, Store, User } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserAvatar, userDisplayName } from '../components/UserAvatar'
import { useLocale } from '../context/LocaleContext'
import { useSession } from '../context/SessionContext'
import { apiJson } from '../lib/api'
import type { Me, UserDailyActivity } from '../types/api'

function formatDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function roleLabel(t: (k: string) => string, me: Pick<Me, 'is_superuser' | 'role'>) {
  if (me.is_superuser) return t('role.superuser')
  const k = `role.${me.role}`
  const s = t(k)
  return s === k ? me.role : s
}

function formatDateTime(iso: string | null | undefined, lang: string): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(lang === 'ku' ? 'ckb-IQ' : lang === 'ar' ? 'ar-IQ' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function activityDescription(
  t: (key: string) => string,
  entry: UserDailyActivity['entries'][number],
): string {
  const meta = entry.meta ?? {}
  switch (entry.action) {
    case 'sale_created':
      return t('profile.activity.saleCreated').replace(
        '{receipt}',
        String(meta.receipt_number ?? '—'),
      )
    case 'sale_return':
      return t('profile.activity.saleReturn').replace(
        '{amount}',
        String(meta.total_refund_usd ?? '0'),
      )
    case 'purchase_created':
      return t('profile.activity.purchaseCreated').replace(
        '{invoice}',
        String(meta.invoice_number || '—'),
      )
    case 'expense_created':
      return t('profile.activity.expenseCreated')
        .replace('{amount}', String(meta.amount ?? '0'))
        .replace('{currency}', String(meta.currency ?? 'USD'))
    case 'employee_debt':
    case 'employee_debt_recorded':
      return t('profile.activity.employeeDebt')
        .replace(
          '{type}',
          meta.debt_type === 'returned'
            ? t('profile.activity.debtReturned')
            : t('profile.activity.debtTaken'),
        )
        .replace('{amount}', String(meta.amount_usd ?? meta.amount ?? '0'))
    case 'profile_updated':
      return t('profile.activity.profileUpdated')
    case 'session_start':
      return t('profile.activity.sessionStart')
    default:
      return entry.label
  }
}

export function ProfilePage() {
  const { t, lang } = useLocale()
  const { me, loading, refresh } = useSession()
  const fileRef = useRef<HTMLInputElement>(null)
  const [activityDate, setActivityDate] = useState(() => formatDateInputValue(new Date()))
  const [activity, setActivity] = useState<UserDailyActivity | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!me) return
    setDisplayName(me.display_name ?? me.effective_display_name ?? '')
  }, [me])

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(null), 2800)
    return () => window.clearTimeout(timer)
  }, [success])

  const loadActivity = useCallback(async () => {
    if (!me) return
    setActivityLoading(true)
    try {
      const data = await apiJson<UserDailyActivity>(
        `/api/users/me-activity/?date=${encodeURIComponent(activityDate)}`,
      )
      setActivity(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setActivityLoading(false)
    }
  }, [activityDate, me, t])

  useEffect(() => {
    void loadActivity()
  }, [loadActivity])

  const previewUser = useMemo(() => {
    if (!me) return null
    if (!avatarPreview) return me
    return { ...me, profile_picture_url: avatarPreview }
  }, [avatarPreview, me])

  async function saveProfile() {
    if (!me) return
    setSaving(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('display_name', displayName.trim())
      if (avatarFile) form.append('profile_picture', avatarFile)
      await apiJson<Me>('/api/users/me/profile/', { method: 'PATCH', body: form })
      setAvatarFile(null)
      setAvatarPreview(null)
      await refresh()
      await loadActivity()
      setSuccess(t('profile.saveSuccess'))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  function onAvatarPick(file: File | null) {
    setAvatarFile(file)
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(file ? URL.createObjectURL(file) : null)
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-slate-500 dark:text-slate-400">
        {t('common.loading')}
      </div>
    )
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center text-slate-600 dark:text-slate-300">
        <p>{t('profile.signInRequired')}</p>
        <Link to="/" className="mt-4 inline-block text-violet-600 hover:underline dark:text-violet-400">
          {t('nav.backToHome')}
        </Link>
      </div>
    )
  }

  const shownUser = previewUser ?? me

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 pb-10 sm:px-4 sm:py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">{t('profile.title')}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('profile.subtitle')}</p>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          {success}
        </div>
      ) : null}

      <div className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-2">
              <UserAvatar user={shownUser} size="lg" />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onAvatarPick(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Camera className="h-3.5 w-3.5" aria-hidden />
                {t('profile.changePhoto')}
              </button>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  {t('profile.displayName')}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  placeholder={userDisplayName(me)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow icon={Mail} label={t('profile.email')} value={me.email} />
                <InfoRow icon={Shield} label={t('profile.role')} value={roleLabel(t, me)} />
                <InfoRow icon={Store} label={t('profile.shop')} value={me.shop_name || '—'} />
                <InfoRow
                  icon={Calendar}
                  label={t('profile.memberSince')}
                  value={formatDateTime(me.date_joined, lang)}
                />
                <InfoRow
                  icon={Clock}
                  label={t('profile.lastLogin')}
                  value={formatDateTime(me.last_login, lang)}
                />
                <InfoRow icon={User} label={t('profile.accountId')} value={`#${me.id}`} />
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => void saveProfile()}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
              >
                {saving ? t('profile.saving') : t('profile.save')}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t('profile.activityTitle')}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t('profile.activityHint')}</p>
            </div>
            <input
              type="date"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {activityLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
          ) : activity && activity.entries.length > 0 ? (
            <ul className="space-y-2">
              {activity.entries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/60"
                >
                  <p className="text-sm text-slate-800 dark:text-slate-100">
                    {activityDescription(t, entry)}
                  </p>
                  <time className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                    {formatDateTime(entry.created_at, lang)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">
              {t('profile.activityEmpty')}
            </p>
          )}
        </section>
      </div>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="break-words text-sm font-medium text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  )
}
