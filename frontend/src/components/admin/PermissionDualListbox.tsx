import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import {
  PERMISSION_CATEGORY_ORDER,
  getPermissionCategoryId,
  sortPermissionsForDisplay,
  splitSalesPermissions,
  type PermissionCategoryId,
} from '../../lib/permissionCategories'
import { formatPermissionLabel, permissionMatchesQuery } from '../../i18n/permissionFormat'
import type { PermissionRow } from '../../types/api'

type Props = {
  allPermissions: PermissionRow[]
  chosenIds: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
  t: (key: string) => string
}

function groupByCategory(rows: PermissionRow[]): Map<PermissionCategoryId, PermissionRow[]> {
  const map = new Map<PermissionCategoryId, PermissionRow[]>()
  for (const p of rows) {
    const cat = getPermissionCategoryId(p)
    const list = map.get(cat)
    if (list) list.push(p)
    else map.set(cat, [p])
  }
  return map
}

export function PermissionDualListbox({
  allPermissions,
  chosenIds,
  onChange,
  disabled = false,
  t,
}: Props) {
  const [qAvail, setQAvail] = useState('')
  const [qChosen, setQChosen] = useState('')
  const [selAvail, setSelAvail] = useState<number[]>([])
  const [selChosen, setSelChosen] = useState<number[]>([])

  const byId = useMemo(
    () => new Map(allPermissions.map((p) => [p.id, p])),
    [allPermissions],
  )

  const label = useCallback((p: PermissionRow) => formatPermissionLabel(p, t), [t])

  const chosenSet = useMemo(() => new Set(chosenIds), [chosenIds])

  const chosenOrdered = useMemo(() => {
    return chosenIds.map((id) => byId.get(id)).filter((p): p is PermissionRow => p != null)
  }, [chosenIds, byId])

  const availableBase = useMemo(() => {
    return allPermissions.filter((p) => !chosenSet.has(p.id))
  }, [allPermissions, chosenSet])

  const availableFiltered = useMemo(() => {
    return availableBase.filter((p) => permissionMatchesQuery(p, qAvail, t))
  }, [availableBase, qAvail, t])

  const chosenFiltered = useMemo(() => {
    return chosenOrdered.filter((p) => permissionMatchesQuery(p, qChosen, t))
  }, [chosenOrdered, qChosen, t])

  const availableByCat = useMemo(() => {
    const g = groupByCategory(availableFiltered)
    for (const [, list] of g) sortPermissionsForDisplay(list, label)
    return g
  }, [availableFiltered, label])

  const chosenByCat = useMemo(() => {
    const g = groupByCategory(chosenFiltered)
    for (const [, list] of g) sortPermissionsForDisplay(list, label)
    return g
  }, [chosenFiltered, label])

  const toggleAvail = useCallback((id: number, checked: boolean) => {
    setSelAvail((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((x) => x !== id)
    })
  }, [])

  const toggleChosen = useCallback((id: number, checked: boolean) => {
    setSelChosen((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id]
      return prev.filter((x) => x !== id)
    })
  }, [])

  const addSelected = useCallback(() => {
    if (disabled || selAvail.length === 0) return
    const next = [...chosenIds]
    const set = new Set(next)
    for (const id of selAvail) {
      if (!set.has(id)) {
        set.add(id)
        next.push(id)
      }
    }
    onChange(next)
    setSelAvail([])
  }, [chosenIds, disabled, onChange, selAvail])

  const removeSelected = useCallback(() => {
    if (disabled || selChosen.length === 0) return
    const remove = new Set(selChosen)
    onChange(chosenIds.filter((id) => !remove.has(id)))
    setSelChosen([])
  }, [chosenIds, disabled, onChange, selChosen])

  const grantAll = useCallback(() => {
    if (disabled) return
    onChange(allPermissions.map((p) => p.id))
    setSelAvail([])
    setSelChosen([])
  }, [allPermissions, disabled, onChange])

  const removeAll = useCallback(() => {
    if (disabled) return
    onChange([])
    setSelChosen([])
  }, [disabled, onChange])

  const addSection = useCallback(
    (rows: PermissionRow[]) => {
      if (disabled || rows.length === 0) return
      const next = [...chosenIds]
      const set = new Set(next)
      for (const p of rows) {
        if (!set.has(p.id)) {
          set.add(p.id)
          next.push(p.id)
        }
      }
      onChange(next)
      setSelAvail((prev) => prev.filter((id) => !rows.some((r) => r.id === id)))
    },
    [chosenIds, disabled, onChange],
  )

  const removeSection = useCallback(
    (rows: PermissionRow[]) => {
      if (disabled || rows.length === 0) return
      const drop = new Set(rows.map((r) => r.id))
      onChange(chosenIds.filter((id) => !drop.has(id)))
      setSelChosen((prev) => prev.filter((id) => !drop.has(id)))
    },
    [chosenIds, disabled, onChange],
  )

  const panelClass =
    'max-h-[min(52vh,28rem)] min-h-[14rem] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-2 sm:min-h-[16rem]'

  const rowClass =
    'flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-start text-[11px] text-slate-800 hover:bg-slate-50 sm:text-xs'

  const renderPermissionRows = (plist: PermissionRow[], panel: 'avail' | 'chosen') => (
    <ul className="mt-1 space-y-0.5">
      {plist.map((p) => {
        const checked = panel === 'avail' ? selAvail.includes(p.id) : selChosen.includes(p.id)
        return (
          <li key={p.id}>
            <label className={rowClass}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={checked}
                onChange={(e) =>
                  panel === 'avail'
                    ? toggleAvail(p.id, e.target.checked)
                    : toggleChosen(p.id, e.target.checked)
                }
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300"
              />
              <span className="min-w-0 leading-snug">{label(p)}</span>
            </label>
          </li>
        )
      })}
    </ul>
  )

  const renderSalesSubsections = (rows: PermissionRow[], panel: 'avail' | 'chosen') => {
    const sorted = sortPermissionsForDisplay([...rows], label)
    const { receiptEdit, other } = splitSalesPermissions(sorted)
    const onBucket = panel === 'avail' ? addSection : removeSection
    const bucketBtnLabel = panel === 'avail' ? t('admin.permAddSection') : t('admin.permRemoveSection')
    return (
      <div className="mt-2 space-y-3">
        {receiptEdit.length > 0 && (
          <div className="rounded-lg border border-violet-200/80 bg-violet-50/60 p-2 dark:border-violet-900/40 dark:bg-violet-950/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-[11px] font-semibold text-violet-950 dark:text-violet-200 sm:text-xs">
                {t('admin.permSub.salesReceiptEdit')}
              </h5>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onBucket(receiptEdit)}
                className={
                  panel === 'avail'
                    ? 'shrink-0 rounded-md border border-violet-300 bg-white px-2 py-0.5 text-[10px] font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-40 sm:text-xs'
                    : 'shrink-0 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 sm:text-xs'
                }
              >
                {bucketBtnLabel}
              </button>
            </div>
            {renderPermissionRows(receiptEdit, panel)}
          </div>
        )}
        {other.length > 0 && (
          <div className="rounded-lg border border-slate-200/90 bg-slate-50/70 p-2 dark:border-slate-600/50 dark:bg-slate-900/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h5 className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 sm:text-xs">
                {t('admin.permSub.salesOther')}
              </h5>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onBucket(other)}
                className={
                  panel === 'avail'
                    ? 'shrink-0 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-40 sm:text-xs'
                    : 'shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 sm:text-xs'
                }
              >
                {bucketBtnLabel}
              </button>
            </div>
            {renderPermissionRows(other, panel)}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">{t('admin.permHelpGrouped')}</p>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">{t('admin.permAvailable')}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={grantAll}
              className="text-xs font-medium text-violet-700 hover:underline disabled:opacity-50"
            >
              {t('admin.permGrantAll')}
            </button>
          </div>
          <input
            type="search"
            value={qAvail}
            onChange={(e) => setQAvail(e.target.value)}
            placeholder={t('admin.permSearch')}
            disabled={disabled}
            className="mb-2 w-full min-h-9 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          />
          <div className={panelClass} role="group" aria-label={t('admin.permAvailable')}>
            {PERMISSION_CATEGORY_ORDER.map(({ id, labelKey }) => {
              const rows = availableByCat.get(id)
              if (!rows?.length) return null
              return (
                <section key={id} className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                  <div className="sticky top-0 z-[1] flex flex-wrap items-center justify-between gap-2 bg-white/95 py-1.5 backdrop-blur-sm">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      {t(labelKey)}
                    </h4>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => addSection(rows)}
                      className="shrink-0 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-40 sm:text-xs"
                    >
                      {t('admin.permAddSection')}
                    </button>
                  </div>
                  {id === 'sales'
                    ? renderSalesSubsections(rows, 'avail')
                    : renderPermissionRows(sortPermissionsForDisplay([...rows], label), 'avail')}
                </section>
              )
            })}
            {availableBase.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-slate-500">{t('admin.permAllAssigned')}</p>
            )}
            {availableBase.length > 0 && availableFiltered.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-slate-500">{t('admin.permEmpty')}</p>
            )}
          </div>
        </div>

        <div className="flex flex-row items-center justify-center gap-1 lg:flex-col lg:justify-center lg:px-1">
          <button
            type="button"
            disabled={disabled || selAvail.length === 0}
            onClick={addSelected}
            title={t('admin.permAdd')}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden />
          </button>
          <button
            type="button"
            disabled={disabled || selChosen.length === 0}
            onClick={removeSelected}
            title={t('admin.permRemove')}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5 rtl:rotate-180" aria-hidden />
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-slate-600">{t('admin.permChosen')}</span>
            <button
              type="button"
              disabled={disabled || chosenIds.length === 0}
              onClick={removeAll}
              className="text-xs font-medium text-violet-700 hover:underline disabled:opacity-50"
            >
              {t('admin.permRemoveAll')}
            </button>
          </div>
          <input
            type="search"
            value={qChosen}
            onChange={(e) => setQChosen(e.target.value)}
            placeholder={t('admin.permSearch')}
            disabled={disabled}
            className="mb-2 w-full min-h-9 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          />
          <div className={panelClass} role="group" aria-label={t('admin.permChosen')}>
            {PERMISSION_CATEGORY_ORDER.map(({ id, labelKey }) => {
              const rows = chosenByCat.get(id)
              if (!rows?.length) return null
              return (
                <section key={id} className="border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
                  <div className="sticky top-0 z-[1] flex flex-wrap items-center justify-between gap-2 bg-white/95 py-1.5 backdrop-blur-sm">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                      {t(labelKey)}
                    </h4>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => removeSection(rows)}
                      className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 sm:text-xs"
                    >
                      {t('admin.permRemoveSection')}
                    </button>
                  </div>
                  {id === 'sales'
                    ? renderSalesSubsections(rows, 'chosen')
                    : renderPermissionRows(sortPermissionsForDisplay([...rows], label), 'chosen')}
                </section>
              )
            })}
            {chosenIds.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-slate-500">{t('admin.permChosenEmpty')}</p>
            )}
            {chosenIds.length > 0 && chosenFiltered.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-slate-500">{t('admin.permEmpty')}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
