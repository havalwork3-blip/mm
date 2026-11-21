import { lazy, type ComponentType } from 'react'

type Loader<M> = () => Promise<M>

const RELOAD_FLAG = 'mm_chunk_reload_at'

/**
 * After a deploy the old hashed chunk files are gone; a tab opened before the deploy then fails
 * to load a page. Reload once (online only) to pick up the new build instead of a blank screen.
 */
function retryOrReload<M>(loader: Loader<M>): Loader<M> {
  return () =>
    loader().catch((err: unknown) => {
      const online = typeof navigator === 'undefined' || navigator.onLine
      let last = 0
      try {
        last = Number(sessionStorage.getItem(RELOAD_FLAG) || 0)
      } catch {
        /* storage unavailable */
      }
      if (online && Date.now() - last > 30_000) {
        try {
          sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
        } catch {
          /* storage unavailable */
        }
        window.location.reload()
        return new Promise<M>(() => {}) // keep suspended until the reload happens
      }
      throw err
    })
}

const prefetchers: Array<() => Promise<unknown>> = []

/** Lazy-load a page that is a named export: `lazyPage(() => import('./pages/X'), 'X')`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<M extends Record<string, any>, K extends keyof M>(loader: Loader<M>, name: K) {
  const safe = retryOrReload(loader)
  prefetchers.push(safe)
  return lazy(async () => ({ default: (await safe())[name] as ComponentType<unknown> }))
}

/**
 * Download every page chunk in the background once the app is idle, so moving to another
 * page later (including while offline, e.g. POS) does not need the network.
 */
export function prefetchAllPages() {
  const run = () => {
    for (const p of prefetchers) void p().catch(() => {})
  }
  const w = window as Window & { requestIdleCallback?: (cb: () => void) => number }
  if (w.requestIdleCallback) w.requestIdleCallback(run)
  else window.setTimeout(run, 2000)
}
