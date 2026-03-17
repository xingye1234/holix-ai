import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enUS from './locales/en-US.json'
import zhCN from './locales/zh-CN.json'

export type Locale = 'zh-CN' | 'en-US'

const STORAGE_KEY = 'holix.locale'

function detectInitialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'zh-CN' || saved === 'en-US')
    return saved
  const browser = navigator.language.toLowerCase()
  if (browser.startsWith('zh'))
    return 'zh-CN'
  return 'en-US'
}

i18n
  .use(initReactI18next)
  .init({
    lng: detectInitialLocale(),
    fallbackLng: 'en-US',
    resources: {
      'zh-CN': { translation: zhCN },
      'en-US': { translation: enUS },
    },
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
