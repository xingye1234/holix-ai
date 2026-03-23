import { usePlatform } from '@/hooks/platform'
import { useChatContext } from '@/context/chat'
import useUI from '@/store/ui'
import { ChatLayoutToggle, SidebarToggleButton } from './header'

export function ChatTitleBar() {
  const { chat } = useChatContext()
  const { isMacOS, isWindows } = usePlatform()
  const sidebarCollapsed = useUI(state => state.sidebarCollapsed)

  const title = chat?.title?.trim() || '新对话'
  const showFallbackControls = sidebarCollapsed

  return (
    <header
      data-testid="chat-title-bar"
      className={`app-drag-region flex h-(--app-header-height) shrink-0 items-center gap-3 border-b px-6 ${
        showFallbackControls && isMacOS ? 'pl-[74px]' : ''
      } ${
        isWindows ? 'pr-36' : ''
      }`}
      style={{
        backgroundColor: 'var(--region-chat)',
        borderColor: 'var(--border)',
      }}
    >
      {showFallbackControls && (
        <div data-testid="chat-title-bar-controls" className="app-no-drag flex items-center gap-1.5">
          <SidebarToggleButton />
          <ChatLayoutToggle />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-foreground/88">
          {title}
        </h1>
      </div>
    </header>
  )
}
