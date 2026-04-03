import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getConfig, updateConfig } from '@/lib/config'
import {
  APP_THEME_STORAGE_KEY,
  CODE_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME,
  DEFAULT_CODE_THEME,
} from '@/lib/theme-system'
import type { AppTheme, CodeTheme } from '@/lib/theme-system'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: AppTheme
  storageKey?: string
}

interface ThemeProviderState {
  theme: AppTheme
  resolvedTheme: 'light' | 'dark'
  codeTheme: CodeTheme
  setTheme: (theme: AppTheme) => void
  setCodeTheme: (codeTheme: CodeTheme) => void
}

const initialState: ThemeProviderState = {
  theme: DEFAULT_APP_THEME,
  resolvedTheme: 'light',
  codeTheme: DEFAULT_CODE_THEME,
  setTheme: () => null,
  setCodeTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_APP_THEME,
  storageKey = APP_THEME_STORAGE_KEY,
  ...props
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<AppTheme>(() => (localStorage.getItem(storageKey) as AppTheme) || defaultTheme)
  const [codeTheme, setCodeThemeState] = useState<CodeTheme>(() => (localStorage.getItem(CODE_THEME_STORAGE_KEY) as CodeTheme) || DEFAULT_CODE_THEME)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    let cancelled = false

    getConfig().then((config) => {
      if (cancelled) {
        return
      }

      const nextTheme = (config.theme as AppTheme) || defaultTheme
      const nextCodeTheme = (config.codeTheme as CodeTheme) || DEFAULT_CODE_THEME

      localStorage.setItem(storageKey, nextTheme)
      localStorage.setItem(CODE_THEME_STORAGE_KEY, nextCodeTheme)
      setThemeState(nextTheme)
      setCodeThemeState(nextCodeTheme)
    }).catch(() => {
      // Ignore config fetch failures and keep local preferences.
    })

    return () => {
      cancelled = true
    }
  }, [defaultTheme, storageKey])

  useEffect(() => {
    const root = window.document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    root.classList.remove('light', 'dark')

    const applyTheme = (value: AppTheme) => {
      const nextResolvedTheme = value === 'system'
        ? (mediaQuery.matches ? 'dark' : 'light')
        : value

      root.classList.add(nextResolvedTheme)
      root.dataset.appTheme = value
      root.dataset.resolvedTheme = nextResolvedTheme
      setResolvedTheme(nextResolvedTheme)
    }

    applyTheme(theme)

    if (theme === 'system') {
      const onChange = () => applyTheme('system')
      mediaQuery.addEventListener('change', onChange)
      return () => mediaQuery.removeEventListener('change', onChange)
    }
  }, [theme])

  useEffect(() => {
    window.document.documentElement.dataset.codeTheme = codeTheme
  }, [codeTheme])

  const value = useMemo(() => ({
    theme,
    resolvedTheme,
    codeTheme,
    setTheme: (nextTheme: AppTheme) => {
      localStorage.setItem(storageKey, nextTheme)
      setThemeState(nextTheme)
      void updateConfig('theme', nextTheme)
    },
    setCodeTheme: (nextCodeTheme: CodeTheme) => {
      localStorage.setItem(CODE_THEME_STORAGE_KEY, nextCodeTheme)
      setCodeThemeState(nextCodeTheme)
      void updateConfig('codeTheme', nextCodeTheme)
    },
  }), [codeTheme, resolvedTheme, storageKey, theme])

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
