import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { apiJson } from '../../lib/api'
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
  const [editing, setEditing] = useState<ShopRow | null>(null)
  const [editName, setEditName] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiJson<ShopRow[] | { results: ShopRow[] }>('/api/shops/')
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
    try {
      await apiJson('/api/shops/', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: sl,
          is_active: true,
          settings: {},
        }),
      })
      setName('')
      setSlug('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    await apiJson(`/api/shops/${editing.slug}/`, {
      method: 'PATCH',
      body: JSON.stringify({ name: editName.trim() }),
    })
    setEditing(null)
    await load()
  }

  async function deleteShop(row: ShopRow) {
    const ok = window.confirm(t('admin.deleteShopConfirm').replace('{name}', row.name))
    if (!ok) return
    setDeletingSlug(row.slug)
    setError(null)
    try {
      await apiJson(`/api/shops/${row.slug}/`, { method: 'DELETE' })
      setRows((prev) => prev.filter((it) => it.id !== row.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setDeletingSlug(null)
    }
  }

  return (
    <div className="space-y-6 text-start">
      <h1 className="text-2xl font-bold text-slate-900">{t('admin.shops')}</h1>

      <form
        onSubmit={createShop}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="font-semibold text-slate-800">{t('admin.createShop')}</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('settings.shopName')}
            className="min-w-[200px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={t('settings.slug')}
            className="w-48 rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white"
          >
            {saving ? t('common.loading') : t('admin.create')}
          </button>
        </div>
      </form>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {loading ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[480px] text-start text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('admin.colShop')}</th>
                <th className="px-4 py-3">{t('settings.slug')}</th>
                <th className="px-4 py-3">{t('admin.colActive')}</th>
                <th className="px-4 py-3 text-end">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.slug}</td>
                  <td className="px-4 py-3">{r.is_active ? '✓' : '—'}</td>
                  <td className="px-4 py-3 text-end">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(r)
                          setEditName(r.name)
                        }}
                        className="text-violet-700 hover:underline"
                      >
                        {t('admin.edit')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteShop(r)}
                        disabled={deletingSlug === r.slug}
                        className="text-rose-700 hover:underline disabled:opacity-60"
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

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
        >
          <form
            onSubmit={saveEdit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 className="font-semibold">{t('admin.editShop')}</h3>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="mt-3 w-full rounded-lg border px-3 py-2"
              required
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg px-3 py-2 text-slate-600"
              >
                {t('pos.cancel')}
              </button>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-4 py-2 text-white"
              >
                {t('settings.save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
