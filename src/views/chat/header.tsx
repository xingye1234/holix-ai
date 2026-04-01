import { Link } from '@tanstack/react-router'
import { AlignJustify, Bot, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/provider'
import useUI from '@/store/ui'
import { SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

export function AsideChatHeader() {
  const { t } = useI18n()

  return (
    <SidebarHeader className="pb-3 pt-(--app-header-height)">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
          >
            <Link to="/">
              <Plus className="h-4 w-4" />
              <span>{t('chat.sidebar.newChat')}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem className="space-y-1">
          <SidebarMenuButton asChild>
            <Link to="/skill-store">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span>{t('chat.sidebar.skills')}</span>
            </Link>
          </SidebarMenuButton>
          {/* <SidebarMenuButton
            to="/agents"
            className="flex h-10 w-full items-center justify-start gap-2 rounded-xl px-3 text-sm font-medium text-foreground/90 transition-colors hover:bg-background/70 hover:text-foreground"
            activeProps={{
              className: 'bg-background text-foreground shadow-xs',
            }}
          >
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span>{t('chat.sidebar.agents')}</span>
          </SidebarMenuButton> */}
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
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
      className="h-8 w-8 rounded-lg text-muted-foreground/80 hover:bg-background/80 hover:text-foreground"
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
      className="h-8 w-8 rounded-lg text-muted-foreground/80 hover:bg-background/80 hover:text-foreground"
      onClick={toggleSidebar}
    >
      {sidebarCollapsed
        ? <PanelLeftOpen className="h-4 w-4" />
        : <PanelLeftClose className="h-4 w-4" />}
    </Button>
  )
}
