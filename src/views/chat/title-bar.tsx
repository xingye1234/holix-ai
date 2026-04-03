import { useRouterState } from '@tanstack/react-router'
import { Ellipsis } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSettingsPanel } from '@/context/settings-panel'
import { usePlatform } from '@/hooks/platform'
import { useI18n } from '@/i18n/provider'
import { cn } from '@/lib/utils'
import useChat from '@/store/chat'

export function ChatTitleBar() {
  const { isOpen, toggle } = useSettingsPanel()
  const { t } = useI18n()
  const pathname = useRouterState({ select: s => s.location.pathname })
  const { isWindows } = usePlatform()
  const currentChatId = pathname.startsWith('/chat/') ? pathname.slice('/chat/'.length) : null
  const chat = useChat(state => state.chats.find(item => item.uid === currentChatId))
  const isChatRoute = currentChatId !== null
  const title = chat?.title?.trim() || (isChatRoute ? t('chat.titleBar.newChat') : 'Holix AI')

  return (
    <div
      data-testid="chat-title-bar"
      className={cn('flex min-w-0 flex-1 items-center gap-3', isWindows ? 'pr-32' : 'pr-2')}
    >
      <div className="min-w-0">
        <h1 className="truncate text-sm font-semibold text-foreground/88">
          {title}
        </h1>
      </div>

      <div data-testid="chat-title-bar-controls" className="app-no-drag flex items-center gap-1.5">
        {isChatRoute && (
          <Button
            data-testid="chat-title-bar-settings"
            variant="ghost"
            size="icon"
            title={isOpen ? t('chat.titleBar.closeSettings') : t('chat.titleBar.openSettings')}
            aria-label={isOpen ? t('chat.titleBar.closeSettings') : t('chat.titleBar.openSettings')}
            aria-pressed={isOpen}
            className={cn(
              'h-8 w-8 rounded-lg text-muted-foreground/80 hover:bg-background/80 hover:text-foreground',
              isOpen && 'bg-background/90 text-foreground shadow-xs',
            )}
            onClick={toggle}
          >
            <Ellipsis className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
