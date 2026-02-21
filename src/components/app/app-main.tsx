import { useRouterState } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'

export default function AppMain({
  children,
}: {
  children?: React.ReactNode
}) {
  const pathname = useRouterState({ select: s => s.location.pathname })

  return (
    <main className="flex h-[calc(100vh-var(--app-header-height)-1px)] w-(--app-chat-width) overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          className="flex size-full"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
