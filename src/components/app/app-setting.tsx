import { Link } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '../ui/sidebar'
import { useI18n } from '@/i18n/provider'

export default function AppSetting() {
  const { t } = useI18n()

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={window.location.pathname.startsWith('/setting')}>
            <Link to="/setting/general">
              <Settings />
              <span>{t('settings.title')}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

  )
}
