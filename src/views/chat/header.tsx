import { Link } from '@tanstack/react-router'
import { AlignJustify, Bot, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/provider'
import useUI from '@/store/ui'

export function AsideChatHeader() {
  const { t } = useI18n()

  return (
    <header className="sticky top-0 z-10 px-2 pt-5 pb-3">
      <div className="space-y-2.5">
        <Link
          to="/"
          className="block w-full"
          activeProps={{
            className: 'pointer-events-none',
          }}
        >
          <Button
            variant="default"
            className="h-11 w-full justify-start gap-2 rounded-xl bg-foreground text-background shadow-none hover:bg-foreground/92"
          >
            <Plus className="h-4 w-4" />
            <span>{t('chat.sidebar.newChat')}</span>
          </Button>
        </Link>

        <div className="space-y-1">
          <Link
            to="/skills"
            className="flex h-10 w-full items-center justify-start gap-2 rounded-xl px-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-background/70 hover:text-foreground"
            activeProps={{
              className: 'bg-background text-foreground shadow-xs',
            }}
          >
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <span>{t('chat.sidebar.skills')}</span>
          </Link>
          <Link
            to="/agents"
            className="flex h-10 w-full items-center justify-start gap-2 rounded-xl px-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-background/70 hover:text-foreground"
            activeProps={{
              className: 'bg-background text-foreground shadow-xs',
            }}
          >
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span>{t('chat.sidebar.agents')}</span>
          </Link>
        </div>
      </div>
    </header>
  )
}

export function ChatLayoutToggle() {
  const layoutMode = useUI(state => state.layoutMode)
  const toggleLayoutMode = useUI(state => state.toggleLayoutMode)
  const { t } = useI18n()

  return (
    <Button
      variant="ghost"
      size="icon"
      title={layoutMode === 'chat' ? t('chat.sidebar.switchToArticle') : t('chat.sidebar.switchToChat')}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      onClick={toggleLayoutMode}
    >
      {layoutMode === 'chat'
        ? <AlignJustify className="h-4 w-4" />
        : <MessageSquare className="h-4 w-4" />}
    </Button>
  )
}

export function SidebarToggleButton() {
  const sidebarCollapsed = useUI(state => state.sidebarCollapsed)
  const toggleSidebar = useUI(state => state.toggleSidebar)
  const { t } = useI18n()

  return (
    <Button
      variant="ghost"
      size="icon"
      title={sidebarCollapsed ? t('chat.sidebar.expand') : t('chat.sidebar.collapse')}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
      onClick={toggleSidebar}
    >
      {sidebarCollapsed
        ? <PanelLeftOpen className="h-4 w-4" />
        : <PanelLeftClose className="h-4 w-4" />}
    </Button>
  )
}
