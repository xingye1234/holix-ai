import { createRootRoute, Outlet } from '@tanstack/react-router'
import AppHeader from '@/components/app/app-header'
import AppMain from '@/components/app/app-main'
import AppSideBar from '@/components/app/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { AsideChatSidebar } from '@/views/chat/chat'
import { AsideChatHeader } from '@/views/chat/header'

function RootLayout() {
  return (
    <>
      <div className="size-full">
        <AppHeader />
        <section className="flex border-t h-[calc(100vh-var(--app-header-height))]">
          <AppSideBar>
            <AsideChatHeader />
            <Separator />
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

export const Route = createRootRoute({ component: RootLayout })
