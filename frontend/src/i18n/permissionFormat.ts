import type { PermissionRow } from '../types/api'

/** Parse Django default codename like add_product → { verb: add, rest: product }. */
function parseCodename(codename: string): { verb: string; rest: string } {
  const verbs = ['add_', 'change_', 'delete_', 'view_'] as const
  for (const v of verbs) {
    if (codename.startsWith(v)) {
      return { verb: v.slice(0, -1), rest: codename.slice(v.length) }
    }
  }
  return { verb: '', rest: codename }
}

function titleCase(s: string): string {
  return s
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Human-friendly label: "Model | Action" using i18n where keys exist.
 */
export function formatPermissionLabel(
  p: PermissionRow,
  t: (key: string) => string,
): string {
  const { verb, rest } = parseCodename(p.codename)
  const modelKey = `admin.permModel.${rest}`
  const verbKey = verb ? `admin.permVerb.${verb}` : ''
  const modelLabel = t(modelKey) === modelKey ? titleCase(rest) : t(modelKey)
  const verbLabel = verb && t(verbKey) !== verbKey ? t(verbKey) : titleCase(verb || p.codename)
  if (!verb) {
    return `${p.app_label} › ${titleCase(p.model)} › ${p.name}`
  }
  return `${modelLabel} | ${verbLabel}`
}

export function permissionMatchesQuery(p: PermissionRow, q: string, t: (key: string) => string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const label = formatPermissionLabel(p, t).toLowerCase()
  return (
    label.includes(s) ||
    p.codename.toLowerCase().includes(s) ||
    p.name.toLowerCase().includes(s) ||
    p.app_label.toLowerCase().includes(s) ||
    p.model.toLowerCase().includes(s)
  )
}
