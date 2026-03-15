import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import AppHeader from '@/components/app/app-header'
import AppMain from '@/components/app/app-main'
import AppSideBar from '@/components/app/app-sidebar'
import SplashScreen from '@/components/app/splash-screen'
import { AsideChatSidebar } from '@/views/chat/chat'
import { AsideChatHeader } from '@/views/chat/header'

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
      <div className="size-full">
        <AppHeader />
        <section className="flex border-t h-[calc(100vh-var(--app-header-height))] overflow-hidden">
          <AppSideBar>
            <AsideChatHeader />
            <AsideChatSidebar />
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
