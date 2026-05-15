import type { Me } from '../types/api'

function bareCodename(perm: string): string {
  return perm.includes('.') ? (perm.split('.').pop() ?? perm) : perm
}

/**
 * Receipt editor role: pass checks that are part of POS / receipt workflows
 * (sales, returns, and read-only product/category access for search & lines).
 */
function receiptEditorMatches(...candidates: string[]): boolean {
  if (candidates.length === 0) return false
  return candidates.every((perm) => {
    const b = bareCodename(perm)
    if (b.includes('sale')) return true
    if (b === 'view_product' || b === 'view_category') return true
    return false
  })
}

/**
 * True if the user has any of the given Django permission codenames
 * (bare codename or full `app.codename`). Superusers and shop owners always pass.
 * Managers and employees require explicit `user_permissions` (assign in Admin → Users).
 * Receipt editors pass when every candidate codename relates to sales.
 */
export function hasPerm(me: Me | null | undefined, ...candidates: string[]): boolean {
  if (!me) return false
  const role = (me.role ?? '').toLowerCase()
  // Strict check: non-boolean truthy values must not count as superuser.
  if (me.is_superuser === true || role === 'owner') return true
  if (role === 'receipt_editor' && receiptEditorMatches(...candidates)) return true
  const perms = new Set(me.user_permissions ?? [])
  return candidates.some(
    (perm) =>
      perms.has(perm) ||
      Array.from(perms).some((p) => p === perm || p.endsWith(`.${perm}`)),
  )
}
