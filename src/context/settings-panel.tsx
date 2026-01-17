import type { ReactNode } from 'react'
import { createContext, useContext } from 'react'

interface SettingsPanelContextValue {
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
}

const SettingsPanelContext = createContext<SettingsPanelContextValue | null>(
  null,
)

export function useSettingsPanel() {
  const context = useContext(SettingsPanelContext)
  if (!context) {
    throw new Error(
      'useSettingsPanel must be used within SettingsPanelProvider',
    )
  }
  return context
}

interface SettingsPanelProviderProps {
  children: ReactNode
  value: SettingsPanelContextValue
}

export function SettingsPanelProvider({
  children,
  value,
}: SettingsPanelProviderProps) {
  return (
    <SettingsPanelContext.Provider value={value}>
      {children}
    </SettingsPanelContext.Provider>
  )
}
