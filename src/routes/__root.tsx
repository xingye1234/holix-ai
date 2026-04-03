import { createRootRoute, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import AppMain from '@/components/app/app-main'
import AppSetting from '@/components/app/app-setting'
import AppSideBar from '@/components/app/app-sidebar'
import SplashScreen from '@/components/app/splash-screen'
import { SettingsPanelProvider } from '@/context/settings-panel'
import { AsideChatSidebar } from '@/views/chat/chat'
import { AsideChatHeader } from '@/views/chat/header'
import WindowChrome from '@/views/shared/window-chrome'
import { SidebarProvider } from '@/components/ui/sidebar'

function RootLayout() {
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false)
  const pathname = useRouterState({ select: s => s.location.pathname })

  useEffect(() => {
    if (!pathname.startsWith('/chat/')) {
      setIsSettingsPanelOpen(false)
    }
  }, [pathname])

  const settingsPanelValue = useMemo(
    () => ({
      isOpen: isSettingsPanelOpen,
      toggle: () => setIsSettingsPanelOpen(prev => !prev),
      open: () => setIsSettingsPanelOpen(true),
      close: () => setIsSettingsPanelOpen(false),
    }),
    [isSettingsPanelOpen],
  )

  return (
    <>
      <SettingsPanelProvider value={settingsPanelValue}>
        <SidebarProvider
          style={
            {
              '--sidebar-width': 'calc(var(--spacing) * 72)',
              '--header-height': 'calc(var(--spacing) * 12)',
            } as React.CSSProperties
          }

          className="relative size-full overflow-hidden"
        >
          <WindowChrome />
          <section
            className="flex h-full overflow-hidden w-full"
          >
            <AppSideBar>
              <AsideChatHeader />
              <AsideChatSidebar />
              <AppSetting />
            </AppSideBar>
            <AppMain>
              <Outlet />
            </AppMain>
          </section>
        </SidebarProvider>
      </SettingsPanelProvider>
    </>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  beforeLoad: ({ location }) => {
    if (!localStorage.getItem('holix-welcomed') && location.pathname !== '/welcome') {
      throw redirect({ to: '/welcome' })
    }
  },
})
