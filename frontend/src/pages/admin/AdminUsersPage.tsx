import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '../../context/LocaleContext'
import { useSession } from '../../context/SessionContext'
import { apiJson } from '../../lib/api'
import type { ShopUserRow } from '../../types/api'
import { AdminUserEditModal } from './AdminUserEditModal'

export function AdminUsersPage() {
  const { t } = useLocale()
  const { me } = useSession()
  const [rows, setRows] = useState<ShopUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiJson<ShopUserRow[] | { results: ShopUserRow[] }>('/api/users/')
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

  function roleLabel(role: string) {
    const k = `role.${role}`
    const s = t(k)
    return s === k ? role : s
  }

  const canEdit = Boolean(me?.is_superuser)

  return (
    <div className="space-y-6 text-start">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.users')}</h1>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setEditId(null)
              setEditOpen(true)
            }}
            className="min-h-10 rounded-lg bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-500"
          >
            {t('admin.create')}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <p className="text-slate-500">{t('common.loading')}</p>
      ) : (
        <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200 bg-white shadow-sm [-webkit-overflow-scrolling:touch]">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">{t('pos.emailPlaceholder')}</th>
                <th className="px-4 py-3">{t('admin.colShop')}</th>
                <th className="px-4 py-3">{t('admin.colRole')}</th>
                <th className="px-4 py-3">{t('admin.colActive')}</th>
                <th className="px-4 py-3">{t('admin.colStaff')}</th>
                <th className="px-4 py-3">{t('admin.colSuperuser')}</th>
                {canEdit && <th className="px-4 py-3">{t('admin.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                  <td className="px-4 py-3">{u.shop_name ?? '—'}</td>
                  <td className="px-4 py-3 max-w-md whitespace-normal leading-snug">{roleLabel(u.role)}</td>
                  <td className="px-4 py-3">{u.is_active ? '✓' : '—'}</td>
                  <td className="px-4 py-3">{u.is_staff ? '✓' : '—'}</td>
                  <td className="px-4 py-3">{u.is_superuser ? '✓' : '—'}</td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(u.id)
                          setEditOpen(true)
                        }}
                        className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 hover:bg-slate-50"
                      >
                        {t('admin.edit')}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-4 py-8 text-center text-slate-500">{t('admin.noUsers')}</p>
          )}
        </div>
      )}

      {canEdit && (
        <AdminUserEditModal
          userId={editId}
          open={editOpen}
          onClose={() => {
            setEditOpen(false)
            setEditId(null)
          }}
          onSaved={() => void load()}
        />
      )}
    </div>
  )
}
