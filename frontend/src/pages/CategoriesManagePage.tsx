import { ArrowLeft, ImagePlus, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageAuthLoading } from '../components/PageAuthLoading'
import { useLocale } from '../context/LocaleContext'
import { useSyncedSession } from '../hooks/useSyncedSession'
import { apiFetch, apiJson, resolveMediaUrl } from '../lib/api'
import { hasPerm } from '../lib/permissions'

type CategoryRow = {
  id: number
  shop: number
  name: string
  image: string | null
  image_url: string | null
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-slate-600 dark:bg-slate-800 dark:text-white'

export function CategoriesManagePage() {
  const { t } = useLocale()
  const { me, authPending, showLogin, canAccessShopData } = useSyncedSession()

  const [rows, setRows] = useState<CategoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryRow | null>(null)
  const [name, setName] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const canView = Boolean(me && hasPerm(me, 'view_category'))
  const canAdd = Boolean(me && hasPerm(me, 'add_category'))
  const canChange = Boolean(me && hasPerm(me, 'change_category'))
  const canDelete = Boolean(me && hasPerm(me, 'delete_category'))

  const load = useCallback(async () => {
    if (!canView) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiJson<CategoryRow[] | { results: CategoryRow[] }>('/api/categories/', {
        shopScoped: true,
      })
      setRows(Array.isArray(data) ? data : data.results)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [canView, t])

  useEffect(() => {
    if (canAccessShopData) void load()
  }, [canAccessShopData, load])

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function resetForm() {
    setName('')
    setImageFile(null)
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function openCreate() {
    setEditing(null)
    resetForm()
    setOpen(true)
  }

  function openEdit(row: CategoryRow) {
    setEditing(row)
    setName(row.name)
    setImageFile(null)
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(resolveMediaUrl(row.image_url))
    if (fileRef.current) fileRef.current.value = ''
    setOpen(true)
  }

  function onPickImage(file: File | null) {
    if (!file) return
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setImageFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('name', trimmed)
      if (imageFile) form.append('image', imageFile)
      const path = editing ? `/api/categories/${editing.id}/` : '/api/categories/'
      const res = await apiFetch(path, {
        method: editing ? 'PATCH' : 'POST',
        shopScoped: true,
        body: form,
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { detail?: string }
        throw new Error(j.detail || res.statusText)
      }
      setOpen(false)
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!window.confirm(t('categoriesPage.deleteConfirm'))) return
    try {
      await apiJson(`/api/categories/${id}/`, { method: 'DELETE', shopScoped: true })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.error'))
    }
  }

  if (authPending) return <PageAuthLoading />
  if (showLogin) return <p className="text-slate-600">{t('dash.signIn')}</p>
  if (!canView) return <p className="text-amber-800">{t('dash.noPermissionsHint')}</p>

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/inventory"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('categoriesPage.title')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('categoriesPage.subtitle')}</p>
          </div>
        </div>
        {canAdd ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t('crud.createNew')}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          {t('common.loading')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-start text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-800/50">
                <th className="px-4 py-3">{t('categoriesPage.colImage')}</th>
                <th className="px-4 py-3">{t('customersPage.fieldName')}</th>
                <th className="px-4 py-3 text-end">{t('crud.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-slate-500">
                    {t('categoriesPage.empty')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const thumb = resolveMediaUrl(row.image_url)
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-50 last:border-0 dark:border-slate-800"
                    >
                      <td className="px-4 py-3">
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
                          {thumb ? (
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                              <ImagePlus className="h-5 w-5" aria-hidden />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{row.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {canChange ? (
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="rounded-lg p-2 text-violet-600 hover:bg-violet-50"
                              aria-label={t('crud.edit')}
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => void remove(row.id)}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                              aria-label={t('crud.delete')}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={(e) => void save(e)}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900"
          >
            <h2 className="mb-4 text-lg font-bold text-slate-900 dark:text-white">
              {editing ? t('crud.editRecordTitle') : t('crud.createRecordTitle')}
            </h2>

            <label className="mb-3 block text-xs font-medium text-slate-500">
              {t('customersPage.fieldName')} *
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} mb-4`}
              required
            />

            <label className="mb-2 block text-xs font-medium text-slate-500">
              {t('categoriesPage.imageLabel')}
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mb-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-8 hover:border-violet-400 dark:border-slate-600"
            >
              {previewUrl ? (
                <img src={previewUrl} alt="" className="max-h-32 rounded-lg object-contain" />
              ) : (
                <>
                  <ImagePlus className="h-8 w-8 text-slate-300" aria-hidden />
                  <span className="text-sm text-slate-500">{t('categoriesPage.pickImage')}</span>
                </>
              )}
            </button>
            <p className="mb-4 text-[11px] text-slate-400">{t('categoriesPage.imageHint')}</p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  resetForm()
                }}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium dark:border-slate-600"
              >
                {t('crud.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t('settings.save')}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
