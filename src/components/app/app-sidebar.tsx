import { motion } from 'framer-motion'
import useUI from '@/store/ui'

export interface AppSideBarProps {
  children: React.ReactNode
}

export default function AppSideBar(props: AppSideBarProps) {
  const sidebarCollapsed = useUI(state => state.sidebarCollapsed)

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 0 : 260 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="border-r flex flex-col overflow-hidden shrink-0"
      style={{ minWidth: 0 }}
    >
      <div className="w-[260px] h-[calc(100vh-var(--app-header-height)-10px)] flex flex-col">
        {props.children}
      </div>
    </motion.aside>
  )
}
