import { useEffect, useRef } from 'react'

/**
 * Many pages keep their own `me` copy instead of `useSession()`. When permissions
 * change (e.g. admin PATCH) we dispatch `mm-session-refresh`; this hook refetches
 * `/api/users/me/` so UI matches the server.
 */
export function useResyncLocalMe(resync: () => void | Promise<void>) {
  const ref = useRef(resync)
  ref.current = resync
  useEffect(() => {
    const run = () => {
      void Promise.resolve(ref.current())
    }
    window.addEventListener('mm-session-refresh', run)
    return () => {
      window.removeEventListener('mm-session-refresh', run)
    }
  }, [])
}
