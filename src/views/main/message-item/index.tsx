import { Sparkles } from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n/provider'
import { useMessageById } from '@/hooks/message'
import { command } from '@/lib/command'
import { hasExportableMessageContent, openMessagePreviewWindow, saveMessagesToFile } from '@/lib/message-utils'
import { cn } from '@/lib/utils'
import { useMessageStore } from '@/store/message'
import useMessageSelection from '@/store/message-selection'
import { useToolApprovalStore } from '@/store/tool-approval'
import useUI from '@/store/ui'
import { ArticleLayout } from './article-layout'
import { ChatLayout } from './chat-layout'
import { pairToolCallSegments } from './tool-call-card'

interface MessageItemProps {
  id: string
  index: number
}

// ✅ Telegram 架构：只有该消息更新时才重渲染
export const MessageItem = memo(({ id, index }: MessageItemProps) => {
  const { t } = useI18n()
  const message = useMessageById(id)
  const deleteMessage = useMessageStore(state => state.deleteMessage)
  const layoutMode = useUI(state => state.layoutMode)
  const isSelectionMode = useMessageSelection(state => state.isSelectionMode)
  const pendingApprovalRequest = useToolApprovalStore(state => state.pendingRequest)

  const content = useMemo(() => {
    if (!message)
      return ''
    if (message.content)
      return message.content
    if (message.draftContent) {
      return message.draftContent
        .filter(s => s.phase === 'answer')
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(s => s.content)
        .join('')
    }
    return ''
  }, [message?.content, message?.draftContent])

  const toolCallPairs = useMemo(() => {
    if (!message)
      return []
    if (message.toolCalls?.length) {
      return message.toolCalls.map((call) => {
        const request = {
          id: call.id,
          content: call.requestContent,
          phase: 'tool' as const,
          source: 'model' as const,
          createdAt: call.createdAt,
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          toolArgs: call.toolArgs,
        }
        const result = call.resultContent
          ? {
              id: `${call.id}-result`,
              content: call.resultContent,
              phase: 'tool' as const,
              source: 'tool' as const,
              createdAt: call.updatedAt,
              toolCallId: call.toolCallId,
            }
          : undefined
        return { request, result }
      })
    }
    return message.draftContent ? pairToolCallSegments(message.draftContent) : []
  }, [message?.draftContent, message?.toolCalls])

  const canExport = useMemo(() => hasExportableMessageContent(message), [message])

  const onCancelGeneration = useCallback(() => {
    if (message?.requestId) {
      command('chat.abort', { requestId: message.requestId })
      toast.success(t('message.canceling'))
    }
    else {
      toast.error(t('message.cancelError'))
    }
  }, [message?.requestId])

  const onPreview = useCallback(() => {
    if (!message || !canExport)
      return
    const win = openMessagePreviewWindow([{ id, role: message.role, content, createdAt: message.createdAt }])
    if (!win)
      toast.error(t('message.previewFailed'))
  }, [canExport, content, id, message?.createdAt, message?.role, t])

  const onExport = useCallback(async () => {
    if (!message || !canExport) {
      toast.error(t('message.noExportableContent'))
      return
    }
    const result = await saveMessagesToFile({
      messages: [{ id, role: message.role, content, createdAt: message.createdAt }],
      format: 'md',
      suggestedName: `message-${id}.md`,
    })
    if (result.canceled)
      toast.info(t('preview.exportCanceled'))
    else
      toast.success(t('preview.exportSuccess', { filePath: result.filePath }))
  }, [canExport, content, id, message?.createdAt, message?.role, t])

  const handleDelete = useCallback(async () => {
    const deleted = await deleteMessage(id)

    if (!deleted) {
      toast.error(t('message.deleteFailed'))
    }
  }, [deleteMessage, id, t])

  if (!message)
    return null

  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isError = message.status === 'error'
  const isStreaming = message.status === 'streaming'
  const isPending = message.status === 'pending'
  const generating = !isUser && (isStreaming || isPending)
  const isToolRunning = message.toolStatus?.running ?? false
  const runningTools = message.toolStatus?.tools ?? []

  if (isSystem) {
    return (
      <div
        className={cn('flex justify-center my-4 transition-all duration-200', isSelectionMode && 'opacity-50')}
        data-message-id={id}
        data-message-index={index}
      >
        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {message.content}
        </div>
      </div>
    )
  }

  const matchedPendingApprovalRequest = generating && pendingApprovalRequest
    ? (!pendingApprovalRequest.messageUid || pendingApprovalRequest.messageUid === message.uid
        ? pendingApprovalRequest
        : null)
    : null

  const layoutProps = {
    id,
    index,
    message,
    content,
    toolCallPairs,
    isUser,
    isError,
    isStreaming,
    isPending,
    generating,
    isToolRunning,
    runningTools,
    pendingApprovalRequest: matchedPendingApprovalRequest,
    onDelete: handleDelete,
    onCancelGeneration,
    onPreview,
    onExport,
    canExport,
  }

  if (layoutMode === 'article') {
    return <ArticleLayout {...layoutProps} />
  }

  return <ChatLayout {...layoutProps} />
})
