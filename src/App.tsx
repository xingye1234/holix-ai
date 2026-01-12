import { RouterProvider } from '@tanstack/react-router'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { useChatUpdates, useInitChats } from '@/hooks/chat'
import { useMessageUpdates } from '@/hooks/message'
import { router } from './router'

export default function App() {
  // 初始化所有数据
  useInitChats()
  // useInitMessages()

  // 监听所有更新事件
  useChatUpdates()
  useMessageUpdates()

  return (
    <ThemeProvider>
      <RouterProvider router={router} defaultPreload="intent" />
      <Toaster position="top-center" />
    </ThemeProvider>
  )
}
