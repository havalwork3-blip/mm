import { useCallback, useRef, useState } from 'react'

/** Prevents overlapping async submit handlers (e.g. double-click on Save). */
export function useSubmitLock() {
  const busyRef = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const runLocked = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current) return undefined
    busyRef.current = true
    setIsSubmitting(true)
    try {
      return await fn()
    } finally {
      busyRef.current = false
      setIsSubmitting(false)
    }
  }, [])

  return { isSubmitting, runLocked }
}
