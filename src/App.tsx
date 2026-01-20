import { RouterProvider } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { useChatUpdates, useInitChats } from '@/hooks/chat'
import { useMessageUpdates } from '@/hooks/message'
import logger from './lib/logger'
import { router } from './router'

export default function App() {
  // 初始化所有数据
  useInitChats()

  // 监听所有更新事件
  useChatUpdates()
  useMessageUpdates()

  logger.info('App initialized and hooks set up.')

  return (
    <ThemeProvider>
      <RouterProvider router={router} defaultPreload="intent" />
      <Toaster position="top-center" />
    </ThemeProvider>
  )
}
