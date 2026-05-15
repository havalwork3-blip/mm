import { HelpCircle, ShieldAlert, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PermissionDualListbox } from '../../components/admin/PermissionDualListbox'
import { useLocale } from '../../context/LocaleContext'
import { useSession } from '../../context/SessionContext'
import { apiJson } from '../../lib/api'
import type { ShopRow, ShopUserRow, UserDetail } from '../../types/api'
import type { Lang } from '../../i18n/strings'

type Draft = {
  email: string
  shop: number | null
  role: string
  is_active: boolean
  is_staff: boolean
  is_superuser: boolean
}

const CREATE_DRAFT: Draft = {
  email: '',
  shop: null,
  role: 'employee',
  is_active: true,
  is_staff: false,
  is_superuser: false,
}

function formatDateTime(iso: string | null, lang: Lang): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const loc = lang === 'en' ? 'en' : lang === 'ar' ? 'ar' : 'ckb-IQ'
    return new Intl.DateTimeFormat(loc, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return iso
  }
}

function needsSensitiveConfirm(before: ShopUserRow, after: Draft): boolean {
  return (
    before.is_superuser !== after.is_superuser ||
    before.is_staff !== after.is_staff ||
    before.role !== after.role
  )
}

function detailToDraft(d: ShopUserRow): Draft {
  return {
    email: d.email,
    shop: d.shop,
    role: d.role,
    is_active: d.is_active,
    is_staff: d.is_staff,
    is_superuser: d.is_superuser,
  }
}

type Props = {
  userId: number | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function AdminUserEditModal({ userId, open, onClose, onSaved }: Props) {
  const { t, lang } = useLocale()
  const { me } = useSession()

  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [permissionIds, setPermissionIds] = useState<number[]>([])
  const [shops, setShops] = useState<ShopRow[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sensitiveOpen, setSensitiveOpen] = useState(false)
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [permGuideOpen, setPermGuideOpen] = useState(false)
  const isCreateMode = userId == null

  const loadShops = useCallback(async () => {
    try {
      const data = await apiJson<ShopRow[] | { results: ShopRow[] }>('/api/shops/', {
        omitShopScope: true,
      })
      setShops(Array.isArray(data) ? data : data.results)
    } catch {
      setShops([])
    }
  }, [])

  const loadUser = useCallback(async () => {
    if (userId == null) return
    setLoading(true)
    setError(null)
    try {
      const d = await apiJson<UserDetail>(`/api/users/${userId}/`)
      setDetail(d)
      setDraft(detailToDraft(d))
      setPermissionIds(Array.isArray(d.user_permission_ids) ? [...d.user_permission_ids] : [])
    } catch (e) {
      setDetail(null)
      setDraft(null)
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [userId, t])

  useEffect(() => {
    if (!open) {
      setDetail(null)
      setDraft(null)
      setPermissionIds([])
      setError(null)
      setSensitiveOpen(false)
      setPermGuideOpen(false)
      setPw1('')
      setPw2('')
      setPwMsg(null)
      return
    }
    if (isCreateMode) {
      setDetail(null)
      setDraft(CREATE_DRAFT)
      setPermissionIds([])
      setError(null)
      setSensitiveOpen(false)
      setPermGuideOpen(false)
      setPw1('')
      setPw2('')
      setPwMsg(null)
      void loadShops()
      return
    }
    void loadUser()
    void loadShops()
  }, [open, userId, isCreateMode, loadUser, loadShops])

  const editingSelf = me?.id === userId
  const canManageObjectPermissions = Boolean(me?.is_superuser)

  const permGuideRows = useMemo(
    () =>
      [
        { titleKey: 'admin.permGuide.roles', descKey: 'admin.permGuide.rolesDesc' },
        { titleKey: 'admin.permGuide.products', descKey: 'admin.permGuide.productsDesc' },
        { titleKey: 'admin.permGuide.sales', descKey: 'admin.permGuide.salesDesc' },
        { titleKey: 'admin.permGuide.reports', descKey: 'admin.permGuide.reportsDesc' },
        { titleKey: 'admin.permGuide.expenses', descKey: 'admin.permGuide.expensesDesc' },
        { titleKey: 'admin.permGuide.cashier', descKey: 'admin.permGuide.cashierDesc' },
        { titleKey: 'admin.permGuide.qrSocial', descKey: 'admin.permGuide.qrSocialDesc' },
      ] as const,
    [],
  )

  const performSave = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        email: draft.email.trim(),
        shop: draft.shop,
        role: draft.role,
        is_active: draft.is_active,
        is_staff: draft.is_staff,
        is_superuser: draft.is_superuser,
      }
      if (canManageObjectPermissions && Array.isArray(detail?.all_permissions)) {
        body.user_permission_ids = permissionIds
      }
      if (isCreateMode) {
        if (pw1.length < 8) {
          setError(t('admin.passwordTooShort'))
          setSaving(false)
          return
        }
        if (pw1 !== pw2) {
          setError(t('admin.passwordMismatch'))
          setSaving(false)
          return
        }
        body.password = pw1
        await apiJson('/api/users/', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      } else {
        await apiJson<UserDetail>(`/api/users/${userId}/`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      }
      window.dispatchEvent(new Event('mm-session-refresh'))
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }, [
    userId,
    isCreateMode,
    draft,
    editingSelf,
    permissionIds,
    canManageObjectPermissions,
    detail,
    onSaved,
    onClose,
    t,
  ])

  const onSaveClick = () => {
    if (!draft) return
    if (isCreateMode) {
      void performSave()
      return
    }
    if (!detail) return
    if (needsSensitiveConfirm(detail, draft)) {
      setSensitiveOpen(true)
      return
    }
    void performSave()
  }

  const onSensitiveConfirm = () => {
    setSensitiveOpen(false)
    void performSave()
  }

  const resetPassword = async () => {
    if (userId == null) return
    setPwMsg(null)
    if (pw1.length < 8) {
      setPwMsg(t('admin.passwordTooShort'))
      return
    }
    if (pw1 !== pw2) {
      setPwMsg(t('admin.passwordMismatch'))
      return
    }
    setPwBusy(true)
    try {
      await apiJson(`/api/users/${userId}/reset-password/`, {
        method: 'POST',
        body: JSON.stringify({ password: pw1 }),
      })
      setPw1('')
      setPw2('')
      setPwMsg(t('admin.passwordUpdated'))
    } catch (e) {
      setPwMsg(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setPwBusy(false)
    }
  }

  const bento = useMemo(
    () =>
      'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5',
    [],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-user-edit-title"
    >
      <div className="flex max-h-[min(92dvh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-slate-50 shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <h2 id="admin-user-edit-title" className="text-lg font-semibold text-slate-900">
            {isCreateMode ? `${t('admin.create')} ${t('admin.users')}` : t('admin.editUser')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loading && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
          {error && !loading && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          )}

          {draft && !loading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <section className={`${bento} md:col-span-2`}>
                <h3 className="text-sm font-semibold text-slate-800">{t('admin.sectionAccount')}</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">{t('pos.emailPlaceholder')}</label>
                    <input
                      type="email"
                      value={draft.email}
                      onChange={(e) => setDraft((d) => (d ? { ...d, email: e.target.value } : d))}
                      className="mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      autoComplete="off"
                    />
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                    <p className="text-xs font-medium text-slate-600">{t('admin.resetPassword')}</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input
                        type="password"
                        value={pw1}
                        onChange={(e) => setPw1(e.target.value)}
                        placeholder={t('admin.newPassword')}
                        className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        autoComplete="new-password"
                      />
                      <input
                        type="password"
                        value={pw2}
                        onChange={(e) => setPw2(e.target.value)}
                        placeholder={t('admin.confirmPassword')}
                        className="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        autoComplete="new-password"
                      />
                    </div>
                    {pwMsg && <p className="mt-2 text-xs text-slate-600">{pwMsg}</p>}
                    {!isCreateMode && (
                      <button
                        type="button"
                        disabled={pwBusy}
                        onClick={() => void resetPassword()}
                        className="mt-3 min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {pwBusy ? t('common.loading') : t('admin.applyPassword')}
                      </button>
                    )}
                  </div>
                </div>
              </section>

              <section className={bento}>
                <h3 className="text-sm font-semibold text-slate-800">{t('admin.sectionShopRole')}</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600">{t('admin.colShop')}</label>
                    <select
                      value={draft.shop ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setDraft((d) =>
                          d ? { ...d, shop: v === '' ? null : Number(v) } : d,
                        )
                      }}
                      className="mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">{t('admin.noShop')}</option>
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600">{t('admin.colRole')}</label>
                    <select
                      value={draft.role}
                      onChange={(e) => setDraft((d) => (d ? { ...d, role: e.target.value } : d))}
                      className="mt-1 w-full min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <optgroup label={t('admin.roleOptgroupFull')}>
                        <option value="owner">{t('role.owner')}</option>
                      </optgroup>
                      <optgroup label={t('admin.roleOptgroupSales')}>
                        <option value="receipt_editor">{t('role.receipt_editor')}</option>
                      </optgroup>
                      <optgroup label={t('admin.roleOptgroupByDepartment')}>
                        <option value="manager">{t('role.manager')}</option>
                        <option value="employee">{t('role.employee')}</option>
                      </optgroup>
                    </select>
                  </div>
                </div>
              </section>

              <section className={bento}>
                <h3 className="text-sm font-semibold text-slate-800">{t('admin.sectionPermissions')}</h3>
                <ul className="mt-3 space-y-3 text-sm">
                  <li className="flex items-start gap-2">
                    <input
                      id="u-active"
                      type="checkbox"
                      checked={draft.is_active}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, is_active: e.target.checked } : d))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <label htmlFor="u-active" className="leading-snug">
                      <span className="font-medium text-slate-800">{t('admin.activeStatus')}</span>
                    </label>
                  </li>
                  <li className="flex items-start gap-2">
                    <input
                      id="u-staff"
                      type="checkbox"
                      checked={draft.is_staff}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, is_staff: e.target.checked } : d))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <label htmlFor="u-staff" className="leading-snug">
                      <span className="font-medium text-slate-800">{t('admin.staffStatus')}</span>
                    </label>
                  </li>
                  <li className="flex items-start gap-2">
                    <input
                      id="u-super"
                      type="checkbox"
                      checked={draft.is_superuser}
                      disabled={Boolean(editingSelf)}
                      onChange={(e) =>
                        setDraft((d) => (d ? { ...d, is_superuser: e.target.checked } : d))
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 disabled:opacity-50"
                    />
                    <label htmlFor="u-super" className="leading-snug">
                      <span className="font-medium text-slate-800">{t('admin.superuserStatus')}</span>
                      {editingSelf && (
                        <span className="mt-1 block text-xs text-slate-500">
                          {t('admin.ownSuperuserLocked')}
                        </span>
                      )}
                    </label>
                  </li>
                </ul>
              </section>

              {!isCreateMode && canManageObjectPermissions && Array.isArray(detail?.all_permissions) && (
                <section className={`${bento} md:col-span-2`}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-800">{t('admin.sectionUserPermissions')}</h3>
                    <button
                      type="button"
                      onClick={() => setPermGuideOpen(true)}
                      className="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                      aria-label={t('admin.permissionsHelp')}
                      title={t('admin.permissionsHelp')}
                    >
                      <HelpCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </button>
                  </div>
                  <div className="mt-3">
                    <PermissionDualListbox
                      allPermissions={detail.all_permissions}
                      chosenIds={permissionIds}
                      onChange={setPermissionIds}
                      disabled={!canManageObjectPermissions}
                      t={t}
                    />
                  </div>
                </section>
              )}

              {!isCreateMode && detail && (
                <section className={`${bento} md:col-span-2`}>
                <h3 className="text-sm font-semibold text-slate-800">{t('admin.sectionDates')}</h3>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-slate-500">{t('admin.lastLogin')}</dt>
                    <dd className="mt-1 font-mono text-xs text-slate-800">
                      {formatDateTime(detail.last_login, lang)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">{t('admin.dateJoined')}</dt>
                    <dd className="mt-1 font-mono text-xs text-slate-800">
                      {formatDateTime(detail.date_joined, lang)}
                    </dd>
                  </div>
                </dl>
                </section>
              )}
            </div>
          )}
        </div>

        {draft && !loading && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('inv.cancel')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onSaveClick}
              className="min-h-11 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {saving ? t('inv.saving') : t('admin.saveChanges')}
            </button>
          </div>
        )}
      </div>

      {permGuideOpen && (
        <div
          className="fixed inset-0 z-[220] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="perm-guide-title"
          onClick={() => setPermGuideOpen(false)}
        >
          <div
            className="flex max-h-[min(90dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/90 to-white shadow-2xl sm:max-w-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-indigo-100/90 bg-indigo-50/70 px-4 py-3 sm:px-5">
              <h2 id="perm-guide-title" className="text-base font-semibold text-indigo-950 sm:text-lg">
                {t('admin.permissionsHelp')}
              </h2>
              <button
                type="button"
                onClick={() => setPermGuideOpen(false)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-indigo-700 hover:bg-indigo-100/80"
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-sm leading-relaxed text-slate-600">{t('admin.permGuideIntro')}</p>
              <div className="mt-4 space-y-3 sm:space-y-4">
                {permGuideRows.map((row) => (
                  <div
                    key={row.titleKey}
                    className="rounded-xl border border-indigo-100/70 bg-white/90 p-3 shadow-sm sm:p-4"
                  >
                    <h3 className="text-sm font-semibold text-indigo-900">{t(row.titleKey)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{t(row.descKey)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {sensitiveOpen && detail && draft && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex gap-3">
              <ShieldAlert className="h-8 w-8 shrink-0 text-amber-500" aria-hidden />
              <div>
                <h3 className="font-semibold text-slate-900">{t('admin.sensitiveConfirmTitle')}</h3>
                <p className="mt-2 text-sm text-slate-600">{t('admin.sensitiveConfirmBody')}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setSensitiveOpen(false)}
                className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700"
              >
                {t('inv.cancel')}
              </button>
              <button
                type="button"
                onClick={onSensitiveConfirm}
                className="min-h-11 rounded-lg bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-500"
              >
                {t('admin.confirmSave')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
