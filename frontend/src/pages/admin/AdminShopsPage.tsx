import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { apiJson } from '../../lib/api'
import { normalizeStorefrontHostInput } from '../../lib/storefrontConfig'
import type { ShopRow } from '../../types/api'

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export function AdminShopsPage() {
  const { t } = useLocale()
  const [rows, setRows] = useState<ShopRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [onlineEnabled, setOnlineEnabled] = useState(false)
  const [storefrontHost, setStorefrontHost] = useState('')
  const [editing, setEditing] = useState<ShopRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editOnlineEnabled, setEditOnlineEnabled] = useState(false)
  const [editStorefrontHost, setEditStorefrontHost] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiJson<ShopRow[] | { results: ShopRow[] }>('/api/shops/', {
        omitShopScope: true,
      })
      setRows(Array.isArray(data) ? data : data.results)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  async function createShop(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const sl = slug.trim() || slugify(name)
    const host = onlineEnabled ? normalizeStorefrontHostInput(storefrontHost) : ''
    if (onlineEnabled && !host) {
      setError(t('admin.storefrontHostRequired'))
      setSaving(false)
      return
    }
    try {
      await apiJson('/api/shops/', {
        method: 'POST',
        omitShopScope: true,
        body: JSON.stringify({
          name: name.trim(),
          slug: sl,
          is_active: true,
          settings: {},
          online_storefront_enabled: onlineEnabled,
          storefront_host: host,
        }),
      })
      setName('')
      setSlug('')
      setOnlineEnabled(false)
      setStorefrontHost('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing || editSaving) return

    setEditError(null)
    setError(null)

    const trimmedName = editName.trim()
    if (!trimmedName) {
      setEditError(t('admin.shopNameRequired'))
      return
    }

    const trimmedSlug = slugify(editSlug.trim() || trimmedName)
    if (!trimmedSlug) {
      setEditError(t('admin.slugRequired'))
      return
    }

    const host = editOnlineEnabled ? normalizeStorefrontHostInput(editStorefrontHost) : ''
    if (editOnlineEnabled && !host) {
      setEditError(t('admin.storefrontHostRequired'))
      return
    }

    setEditSaving(true)
    try {
      await apiJson(`/api/shops/${editing.id}/`, {
        method: 'PATCH',
        omitShopScope: true,
        body: JSON.stringify({
          name: trimmedName,
          slug: trimmedSlug,
          online_storefront_enabled: editOnlineEnabled,
          storefront_host: host,
        }),
      })
      setEditing(null)
      setEditError(null)
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('common.error')
      setEditError(msg)
    } finally {
      setEditSaving(false)
    }
  }

  async function deleteShop(row: ShopRow) {
    const ok = window.confirm(t('admin.deleteShopConfirm').replace('{name}', row.name))
    if (!ok) return
    setDeletingSlug(row.slug)
    setError(null)
    try {
      await apiJson(`/api/shops/${row.id}/`, { method: 'DELETE', omitShopScope: true })
      setRows((prev) => prev.filter((it) => it.id !== row.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setDeletingSlug(null)
    }
  }

  function openEdit(row: ShopRow) {
    setEditing(row)
    setEditName(row.name)
    setEditSlug(row.slug?.trim() || slugify(row.name))
    setEditOnlineEnabled(Boolean(row.online_storefront_enabled))
    setEditStorefrontHost(row.storefront_host || '')
    setEditError(null)
  }

  function closeEdit() {
    if (editSaving) return
    setEditing(null)
    setEditError(null)
  }

  return (
    <div className="space-y-6 text-start">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('admin.shops')}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.shopsHint')}</p>

      <form
        onSubmit={createShop}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900"
      >
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">
          {t('admin.createShop')}
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('admin.storefrontSuperuserOnly')}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('settings.shopName')}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={t('settings.slug')}
            className="w-48 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={onlineEnabled}
            onChange={(e) => setOnlineEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-violet-600"
          />
          {t('admin.onlineStorefrontEnabled')}
        </label>
        {onlineEnabled ? (
          <div className="mt-2 max-w-md">
            <input
              value={storefrontHost}
              onChange={(e) => setStorefrontHost(e.target.value)}
              placeholder={t('admin.storefrontHostPlaceholder')}
              dir="ltr"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('admin.storefrontHostHint')}
            </p>
          </div>
        ) : null}
        <div className="mt-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {saving ? t('common.loading') : t('admin.create')}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {loading ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">{t('admin.colShop')}</th>
                <th className="px-4 py-3">{t('settings.slug')}</th>
                <th className="px-4 py-3">{t('admin.colOnlineShop')}</th>
                <th className="px-4 py-3">{t('admin.colActive')}</th>
                <th className="px-4 py-3 text-end">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {r.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {r.slug?.trim() ? r.slug : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.online_storefront_enabled ? (
                      <span className="font-mono text-xs text-violet-700 dark:text-violet-300">
                        {r.storefront_host || '—'}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">{r.is_active ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-end">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="text-violet-700 hover:underline dark:text-violet-400"
                      >
                        {t('admin.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteShop(r)}
                        disabled={deletingSlug === r.slug}
                        className="text-rose-700 hover:underline disabled:opacity-60 dark:text-rose-400"
                      >
                        {deletingSlug === r.slug ? t('common.loading') : t('crud.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
        >
          <form
            noValidate
            onSubmit={(e) => void saveEdit(e)}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
          >
            <h3 className="font-semibold text-slate-900 dark:text-white">{t('admin.editShop')}</h3>
            <label className="mt-3 block text-xs text-slate-500 dark:text-slate-400">
              {t('settings.shopName')}
            </label>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <label className="mt-3 block text-xs text-slate-500 dark:text-slate-400">
              {t('settings.slug')}
            </label>
            <input
              value={editSlug}
              onChange={(e) => setEditSlug(e.target.value)}
              dir="ltr"
              placeholder={t('settings.slug')}
              className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editOnlineEnabled}
                onChange={(e) => {
                  setEditOnlineEnabled(e.target.checked)
                  if (!e.target.checked) setEditStorefrontHost('')
                  setEditError(null)
                }}
                className="h-4 w-4 rounded border-slate-300 text-violet-600"
              />
              {t('admin.onlineStorefrontEnabled')}
            </label>
            {editOnlineEnabled ? (
              <div className="mt-2">
                <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">
                  {t('admin.storefrontHost')}
                </label>
                <input
                  value={editStorefrontHost}
                  onChange={(e) => setEditStorefrontHost(e.target.value)}
                  placeholder={t('admin.storefrontHostPlaceholder')}
                  dir="ltr"
                  className="w-full rounded-lg border px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t('admin.storefrontHostHint')}
                </p>
                {import.meta.env.DEV && editing ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {t('admin.storefrontLocalTest')}{' '}
                    <a
                      href={`/store/?shop_id=${editing.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-violet-600 underline dark:text-violet-400"
                    >
                      /store/?shop_id={editing.id}
                    </a>
                  </p>
                ) : null}
              </div>
            ) : null}
            {editError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                {editError}
              </p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={editSaving}
                onClick={closeEdit}
                className="rounded-lg px-3 py-2 text-slate-600 disabled:opacity-50 dark:text-slate-300"
              >
                {t('pos.cancel')}
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="rounded-lg bg-violet-600 px-4 py-2 text-white disabled:opacity-50"
              >
                {editSaving ? t('common.loading') : t('settings.save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
