export interface AppSideBarProps {
  children: React.ReactNode
}

export default function AppSideBar(props: AppSideBarProps) {
  return (
    <aside className="w-(--app-sidebar-width) border-r flex flex-col">
      <div className="h-[calc(100vh-var(--app-header-height)-10px)] flex flex-col">{props.children}</div>
    </aside>
  )
}
