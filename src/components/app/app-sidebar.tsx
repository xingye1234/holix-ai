import { Sidebar, SidebarInset } from '../ui/sidebar'

export interface AppSideBarProps {
  children: React.ReactNode
}

export default function AppSideBar(props: AppSideBarProps) {
  return (
    <Sidebar collapsible="icon">
      <SidebarInset>
        {props.children}
      </SidebarInset>
    </Sidebar>
  )
}
