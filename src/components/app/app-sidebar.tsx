import { motion } from 'framer-motion'
import useUI from '@/store/ui'
import { SidebarInset, SidebarProvider } from '../ui/sidebar'

export interface AppSideBarProps {
  children: React.ReactNode
}

export default function AppSideBar(props: AppSideBarProps) {
  // const sidebarCollapsed = useUI(state => state.sidebarCollapsed)

  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': 'calc(var(--spacing) * 72)',
          '--header-height': 'calc(var(--spacing) * 12)',
        } as React.CSSProperties
      }
      className="flex h-full w-(--app-sidebar-width)  flex-col px-3 pb-3"
    >
      <SidebarInset>
        {props.children}
      </SidebarInset>
    </SidebarProvider>
  )
}
