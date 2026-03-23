import { useRouterState } from '@tanstack/react-router'
import AppSearch from '@/components/app/app-search'
import WindowControls from '@/components/window-controls'
import { usePlatform } from '@/hooks/platform'
import useUI from '@/store/ui'
import { ChatLayoutToggle, SidebarToggleButton } from '@/views/chat/header'

export default function WindowChrome() {
  const { isMacOS, isWindows } = usePlatform()
  const sidebarCollapsed = useUI(state => state.sidebarCollapsed)
  const pathname = useRouterState({ select: s => s.location.pathname })
  const leftChromeWidth = sidebarCollapsed ? '140px' : 'var(--app-sidebar-width)'
  const shouldUseChatFallback = sidebarCollapsed && pathname.startsWith('/chat/')

  return (
    <>
      {!shouldUseChatFallback && (
        <div
          className={`app-drag-region pointer-events-auto absolute left-0 top-0 z-40 flex h-(--app-header-height) items-center border-b ${
            isMacOS ? 'pl-[74px]' : 'pl-3'
          } pr-3`}
          style={{
            width: leftChromeWidth,
            backgroundColor: 'var(--region-sidebar)',
            borderColor: 'var(--border)',
          }}
        >
          <div className="app-no-drag flex items-center gap-1.5">
            <SidebarToggleButton />
            <ChatLayoutToggle />
          </div>
        </div>
      )}

      {isWindows && (
        <div className="pointer-events-auto absolute right-3 top-0 z-50 flex h-(--app-header-height) items-center">
          <WindowControls />
        </div>
      )}

      <div className="hidden">
        <AppSearch className="hidden" showShortcut={false} />
      </div>
    </>
  )
}
