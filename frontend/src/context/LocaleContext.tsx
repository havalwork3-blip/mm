import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Lang } from '../i18n/strings'
import { translate } from '../i18n/strings'

const STORAGE_KEY = 'ui_lang'

type Ctx = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
  /** True when UI language is Arabic or Kurdish (Sorani). */
  isRtl: boolean
}

const LocaleContext = createContext<Ctx | null>(null)

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const s = localStorage.getItem(STORAGE_KEY) as Lang | null
    return s === 'ar' || s === 'ku' || s === 'en' ? s : 'ku'
  })

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang === 'ku' ? 'ckb' : lang
    document.documentElement.dir =
      lang === 'ar' || lang === 'ku' ? 'rtl' : 'ltr'
  }, [lang])

  const t = useCallback((key: string) => translate(lang, key), [lang])

  const isRtl = lang === 'ar' || lang === 'ku'

  const value = useMemo(
    () => ({ lang, setLang, t, isRtl }),
    [lang, setLang, t, isRtl],
  )

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  )
}

export function useLocale() {
  const c = useContext(LocaleContext)
  if (!c) throw new Error('useLocale outside LocaleProvider')
  return c
}
