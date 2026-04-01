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

function RootLayout() {
  const [splashDone, setSplashDone] = useState(false)
  const [isSettingsPanelOpen, setIsSettingsPanelOpen] = useState(false)
  const pathname = useRouterState({ select: s => s.location.pathname })

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 800)
    return () => clearTimeout(t)
  }, [])

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
      <AnimatePresence>
        {!splashDone && <SplashScreen key="splash" />}
      </AnimatePresence>
      <SettingsPanelProvider value={settingsPanelValue}>
        <div className="relative size-full overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
          <WindowChrome />
          <section
            className="flex h-full overflow-hidden"
          >
            <AppSideBar>
              <AsideChatHeader />
              <AsideChatSidebar />
              <div className="mt-auto px-2 pt-2">
                <AppSetting variant="sidebar" />
              </div>
            </AppSideBar>
            <AppMain>
              <Outlet />
            </AppMain>
          </section>
        </div>
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
