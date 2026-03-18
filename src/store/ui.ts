import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LayoutMode = 'chat' | 'article'

interface UIStore {
  layoutMode: LayoutMode
  sidebarCollapsed: boolean
  setLayoutMode: (mode: LayoutMode) => void
  toggleLayoutMode: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void
}

const useUI = create<UIStore>()(
  persist(
    (set, get) => ({
      layoutMode: 'chat',
      sidebarCollapsed: false,

      setLayoutMode: mode => set({ layoutMode: mode }),
      toggleLayoutMode: () =>
        set({ layoutMode: get().layoutMode === 'chat' ? 'article' : 'chat' }),

      setSidebarCollapsed: collapsed => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
    }),
    {
      name: 'holix-ui-preferences',
      partialize: state => ({
        layoutMode: state.layoutMode,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
)

export default useUI
