import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

export type StorefrontTheme = 'light' | 'dark'

type Ctx = {
  theme: StorefrontTheme
  setTheme: (t: StorefrontTheme) => void
  toggleTheme: () => void
}

const StorefrontThemeContext = createContext<Ctx | null>(null)

function themeStorageKey(shopId: number | null): string {
  return shopId != null ? `sf_theme_${shopId}` : 'sf_theme'
}

function readTheme(shopId: number | null): StorefrontTheme {
  try {
    const v = localStorage.getItem(themeStorageKey(shopId))
    if (v === 'dark' || v === 'light') return v
  } catch {
    /* ignore */
  }
  return 'light'
}

export function StorefrontThemeProvider({
  shopId,
  children,
}: {
  shopId: number | null
  children: React.ReactNode
}) {
  const [theme, setThemeState] = useState<StorefrontTheme>(() => readTheme(shopId))

  useEffect(() => {
    setThemeState(readTheme(shopId))
  }, [shopId])

  const setTheme = useCallback(
    (t: StorefrontTheme) => {
      setThemeState(t)
      try {
        localStorage.setItem(themeStorageKey(shopId), t)
      } catch {
        /* ignore */
      }
    },
    [shopId],
  )

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return (
    <StorefrontThemeContext.Provider value={value}>{children}</StorefrontThemeContext.Provider>
  )
}

export function useStorefrontTheme() {
  const c = useContext(StorefrontThemeContext)
  if (!c) throw new Error('useStorefrontTheme outside StorefrontThemeProvider')
  return c
}
