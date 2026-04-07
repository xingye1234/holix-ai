import WindowControls from '@/components/window-controls'
import { usePlatform } from '@/hooks/platform'
import { ChatLayoutToggle, SidebarToggleButton } from '@/views/chat/header'
import { ChatTitleBar } from '@/views/chat/title-bar'

export default function WindowChrome() {
  const { isMacOS, isWindows } = usePlatform()

  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-40 flex h-(--app-header-height) before:absolute before:inset-x-0 before:top-0 before:h-(--app-header-height) before:border-b before:border-white/8 before:bg-[linear-gradient(180deg,color-mix(in_oklab,var(--region-chat)_88%,transparent)_0%,color-mix(in_oklab,var(--region-chat)_62%,transparent)_45%,transparent_100%)] before:backdrop-blur-xl before:content-[''] dark:before:border-white/6"
      >
        <div
          className={`app-drag-region relative z-10 w-(--app-sidebar-width) pointer-events-auto flex shrink-0 items-center justify-between px-3 ${isMacOS ? 'pl-25' : 'pl-3'
          }`}
        >
          <div className="app-no-drag flex items-center gap-1.5">
            <SidebarToggleButton />
            <ChatLayoutToggle />
          </div>
        </div>
        <div
          className={`app-drag-region relative z-10 pointer-events-auto flex min-w-0 flex-1 items-center px-5 ${isWindows ? 'pr-36' : 'pr-5'
          }`}
        >
          <ChatTitleBar />
        </div>
      </div>

      {isWindows && (
        <div className="pointer-events-auto absolute right-3 top-0 z-50 flex h-(--app-header-height) items-center">
          <WindowControls />
        </div>
      )}

      {/* {!isChatRoute && (
        <div className="hidden a">
          <AppSearch className="hidden" showShortcut={false} />
        </div>
      )} */}
    </>
  )
}
