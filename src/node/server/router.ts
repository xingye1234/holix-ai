import { chatRouter } from './chat'
import { dialogRouter } from './dialog'
import { messageRouter } from './message'
import { router } from './trpc'

// 合并所有路由
export const appRouter = router({
  chat: chatRouter,
  message: messageRouter,
  dialog: dialogRouter,
})

// 导出类型
export type AppRouter = typeof appRouter
