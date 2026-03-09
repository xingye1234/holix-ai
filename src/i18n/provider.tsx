import type { ReactNode } from 'react'
import type { Locale } from './config'
import { useTranslation } from 'react-i18next'
import i18n from './config'

export type { Locale }

const STORAGE_KEY = 'holix.locale'

export function I18nProvider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function useI18n() {
  const { t } = useTranslation()
  return {
    t,
    locale: i18n.language as Locale,
    setLocale: (locale: Locale) => {
      localStorage.setItem(STORAGE_KEY, locale)
      i18n.changeLanguage(locale)
    },
  }
}
