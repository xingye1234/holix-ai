import { motion } from 'framer-motion'
import useUI from '@/store/ui'

export interface AppSideBarProps {
  children: React.ReactNode
}

export default function AppSideBar(props: AppSideBarProps) {
  const sidebarCollapsed = useUI(state => state.sidebarCollapsed)

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 0 : 320 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="flex flex-col overflow-hidden shrink-0 transition-all duration-300"
      style={{ minWidth: 0, backgroundColor: 'var(--region-sidebar)' }}
    >
      <div className="flex h-full w-(--app-sidebar-width) flex-col px-3 pb-3">
        {props.children}
      </div>
    </motion.aside>
  )
}
