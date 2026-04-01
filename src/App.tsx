import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { ToolApprovalModal } from '@/components/tool-approval-modal'
import { Toaster } from '@/components/ui/sonner'
import { useChatUpdates, useInitChats } from '@/hooks/chat'
import { useMessageUpdates } from '@/hooks/message'
import { registerCommandHandler } from '@/lib/command'
import { I18nProvider } from './i18n/provider'
import logger from './lib/logger'
import { router } from './router'
import { useToolApprovalStore } from './store/tool-approval'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function App() {
  // 初始化所有数据
  useInitChats()

  // 监听所有更新事件
  useChatUpdates()
  useMessageUpdates()

  // 注册工具审批 callback handler
  // 服务端通过 updateAwait('tool.approval.request', ...) 触发，等待用户决策
  useEffect(() => {
    return registerCommandHandler('tool.approval.request', async (payload: any) => {
      const [request] = payload.args as [typeof payload.args[0]]
      return new Promise<boolean>((resolve) => {
        useToolApprovalStore.getState()._setPendingRequest({
          callbackId: '',
          toolName: request.toolName,
          skillName: request.skillName,
          description: request.description,
          args: request.args,
          resolve,
        })
      })
    })
  }, [])

  useEffect(() => {
    logger.info('App initialized and hooks set up.')
  }, [])

  return (
    <I18nProvider>
      <ThemeProvider>
        <TooltipProvider>
          <RouterProvider router={router} defaultPreload="intent" />
        </TooltipProvider>
        <Toaster position="top-center" />
        <ToolApprovalModal />
      </ThemeProvider>
    </I18nProvider>
  )
}
