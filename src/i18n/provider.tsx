import type { ReactNode } from 'react'
import type { Locale } from './messages'
import { createContext, useContext, useMemo, useState } from 'react'
import { messages } from './messages'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const STORAGE_KEY = 'holix.locale'

const I18nContext = createContext<I18nContextValue | null>(null)

function getByPath(obj: Record<string, any>, path: string): string | undefined {
  return path.split('.').reduce<any>((acc, part) => acc?.[part], obj)
}

function detectInitialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'zh-CN' || saved === 'en-US')
    return saved
  const browser = navigator.language.toLowerCase()
  if (browser.startsWith('zh'))
    return 'zh-CN'
  return 'en-US'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale)

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    localStorage.setItem(STORAGE_KEY, next)
  }

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key: string) => {
      const localized = getByPath(messages[locale] as any, key)
      if (localized)
        return localized
      const fallback = getByPath(messages['en-US'] as any, key)
      return fallback ?? key
    },
  }), [locale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx)
    throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
