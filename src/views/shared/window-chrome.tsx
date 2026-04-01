import { useRouterState } from '@tanstack/react-router'
import AppSearch from '@/components/app/app-search'
import WindowControls from '@/components/window-controls'
import { usePlatform } from '@/hooks/platform'
import useUI from '@/store/ui'
import { ChatLayoutToggle, SidebarToggleButton } from '@/views/chat/header'
import { ChatTitleBar } from '@/views/chat/title-bar'

export default function WindowChrome() {
  const { isMacOS, isWindows } = usePlatform()
  const pathname = useRouterState({ select: s => s.location.pathname })
  const isChatRoute = pathname.startsWith('/chat/')

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex h-(--app-header-height)">
        <div
          className={`app-drag-region w-(--app-sidebar-width) pointer-events-auto flex shrink-0 items-center justify-between px-3 ${
            isMacOS ? 'pl-25' : 'pl-3'
          }`}
        >
          <div className="app-no-drag flex items-center gap-1.5">
            <SidebarToggleButton />
            <ChatLayoutToggle />
          </div>
        </div>

        <div
          className={`app-drag-region pointer-events-auto flex min-w-0 flex-1 items-center px-5 ${
            isWindows ? 'pr-36' : 'pr-5'
          }`}
          style={{
            backgroundColor: 'var(--region-chat)',
            borderColor: 'var(--border)',
          }}
        >
          <ChatTitleBar />
        </div>
      </div>

      {isWindows && (
        <div className="pointer-events-auto absolute right-3 top-0 z-50 flex h-(--app-header-height) items-center">
          <WindowControls />
        </div>
      )}

      {!isChatRoute && (
        <div className="hidden">
          <AppSearch className="hidden" showShortcut={false} />
        </div>
      )}
    </>
  )
}
