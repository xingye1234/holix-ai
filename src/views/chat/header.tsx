import { Link } from '@tanstack/react-router'
import { AlignJustify, Bot, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/provider'
import useUI from '@/store/ui'

export function AsideChatHeader() {
  const { t } = useI18n()
  const toggleSidebar = useUI(state => state.toggleSidebar)

  return (
    <header className="px-3 py-3 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10">
      {/* 标题栏：标题 + 收起按钮 */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-sm font-semibold text-foreground">{t('chat.sidebar.title')}</h1>
        <Button
          variant="ghost"
          size="icon"
          title={t('chat.sidebar.collapse')}
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={toggleSidebar}
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* 新建会话按钮 */}
      <Link
        to="/"
        className="w-full mb-3"
        activeProps={{
          className: 'pointer-events-none',
        }}
      >
        <Button
          variant="default"
          className="w-full justify-start gap-2 h-10 shadow-sm hover:shadow transition-all"
        >
          <Plus className="h-4 w-4" />
          <span>{t('chat.sidebar.newChat')}</span>
        </Button>
      </Link>

      {/* 功能链接 */}
      <div className="space-y-0.5">
        <Link
          to="/skills"
          className="h-9 w-full flex items-center justify-start gap-2 rounded-md px-2 text-sm font-normal text-foreground/90 hover:bg-muted hover:text-foreground transition-colors"
          activeProps={{
            className: 'bg-accent text-accent-foreground',
          }}
        >
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span>{t('chat.sidebar.skills')}</span>
        </Link>
        <Link
          to="/agents"
          className="h-9 w-full flex items-center justify-start gap-2 rounded-md px-2 text-sm font-normal text-foreground/90 hover:bg-muted hover:text-foreground transition-colors"
          activeProps={{
            className: 'bg-accent text-accent-foreground',
          }}
        >
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span>{t('chat.sidebar.agents')}</span>
        </Link>
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
