import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import AppMain from '@/components/app/app-main'
import AppSetting from '@/components/app/app-setting'
import AppSideBar from '@/components/app/app-sidebar'
import SplashScreen from '@/components/app/splash-screen'
import { AsideChatSidebar } from '@/views/chat/chat'
import { AsideChatHeader } from '@/views/chat/header'
import WindowChrome from '@/views/shared/window-chrome'

function RootLayout() {
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 800)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <AnimatePresence>
        {!splashDone && <SplashScreen key="splash" />}
      </AnimatePresence>
      <div className="size-full overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
        <WindowChrome />
        <section className="flex h-full overflow-hidden">
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
