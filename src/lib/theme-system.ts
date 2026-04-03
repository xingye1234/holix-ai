export type AppTheme = 'light' | 'dark' | 'system'

export type CodeTheme = 'github' | 'vitesse' | 'catppuccin'

export interface CodeThemePreset {
  id: CodeTheme
  labelKey: string
  descriptionKey: string
  lightTheme: string
  darkTheme: string
}

export const APP_THEME_STORAGE_KEY = 'holix.app-theme'
export const CODE_THEME_STORAGE_KEY = 'holix.code-theme'

export const DEFAULT_APP_THEME: AppTheme = 'system'
export const DEFAULT_CODE_THEME: CodeTheme = 'github'

export const CODE_THEME_PRESETS: CodeThemePreset[] = [
  {
    id: 'github',
    labelKey: 'settings.general.codeThemes.github.label',
    descriptionKey: 'settings.general.codeThemes.github.description',
    lightTheme: 'github-light',
    darkTheme: 'github-dark',
  },
  {
    id: 'vitesse',
    labelKey: 'settings.general.codeThemes.vitesse.label',
    descriptionKey: 'settings.general.codeThemes.vitesse.description',
    lightTheme: 'vitesse-light',
    darkTheme: 'vitesse-dark',
  },
  {
    id: 'catppuccin',
    labelKey: 'settings.general.codeThemes.catppuccin.label',
    descriptionKey: 'settings.general.codeThemes.catppuccin.description',
    lightTheme: 'catppuccin-latte',
    darkTheme: 'catppuccin-mocha',
  },
]

export function getCodeThemePreset(codeTheme: CodeTheme) {
  return CODE_THEME_PRESETS.find(theme => theme.id === codeTheme) ?? CODE_THEME_PRESETS[0]
}
