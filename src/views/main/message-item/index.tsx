import {
  AlertCircle,
  Bot,
  Copy,
  OctagonX,
  Sparkles,
  User,
} from 'lucide-react'
import { memo, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { useMessageById } from '@/hooks/message'
import { command } from '@/lib/command'
import { formatWithLocalTZ } from '@/lib/time'
import { cn } from '@/lib/utils'
import { MessageFooter } from './footer'
import { GeneratingIndicator } from './generating'
import { MessageMarkdown } from './markdown'
import { pairToolCallSegments, ToolCallCard } from './tool-call-card'

interface MessageItemProps {
  id: string
  index: number
  onDelete?: (id: string) => void
}

// ✅ Telegram 架构：只有该消息更新时才重渲染
export const MessageItem = memo(({ id, index, onDelete }: MessageItemProps) => {
  const message = useMessageById(id)
  if (!message)
    return null

  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isError = message.status === 'error'
  const isStreaming = message.status === 'streaming'
  const isPending = message.status === 'pending'
  const generating = !isUser && (isStreaming || isPending)

  /** 最终展示内容 */
  const content = useMemo(() => {
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
  }, [message.content, message.draftContent])

  /** 配对好的工具调用（请求 + 结果） */
  const toolCallPairs = useMemo(() => {
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
    if (!message.draftContent)
      return []
    return pairToolCallSegments(message.draftContent)
  }, [message.draftContent, message.toolCalls])

  const handleCancelGeneration = useCallback(() => {
    if (message.requestId) {
      command('chat.abort', { requestId: message.requestId })
      toast.success('正在取消生成...')
    }
    else {
      toast.error('无法取消：缺少请求ID')
    }
  }, [message.requestId])

  const deleteHandler = useCallback(() => onDelete?.(id), [onDelete, id])

  // ── system 消息 ──────────────────────────────────────────────────────────
  if (isSystem) {
    return (
      <div className="flex justify-center my-4" data-message-index={index}>
        <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          {message.content}
        </div>
      </div>
    )
  }

  // ── 工具调用列表 ─────────────────────────────────────────────────────────
  const toolCallList = !isUser && toolCallPairs.length > 0 && (
    <div className="flex flex-col gap-1.5 mb-2 w-full">
      {toolCallPairs.map(pair => (
        <ToolCallCard
          key={pair.request.id}
          pair={pair}
          isStreaming={isStreaming}
        />
      ))}
    </div>
  )

  // ── 主体 ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={cn('flex w-full gap-3 px-4 py-3 group', isUser ? 'flex-row-reverse' : 'flex-row')}
      data-message-index={index}
    >
      {/* Avatar */}
      <Avatar className="w-8 h-8 border shrink-0 shadow-sm mt-0.5">
        {isUser
          ? (
              <>
                <AvatarImage src="" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <User className="w-4 h-4" />
                </AvatarFallback>
              </>
            )
          : (
              <>
                <AvatarImage src="" />
                <AvatarFallback className="bg-secondary text-secondary-foreground">
                  <Bot className="w-4 h-4" />
                </AvatarFallback>
              </>
            )}
      </Avatar>

      {/* 气泡 + 取消按钮 */}
      <div className={cn('flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start', 'max-w-[85%]')}>
        {/* 工具调用列表 */}
        {!isUser && toolCallList}

        {/* 内容气泡 */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'relative min-w-16 max-w-full rounded-2xl px-4 py-3 text-sm shadow-sm transition-colors',
                isUser
                  ? 'bg-primary text-primary-foreground rounded-tr-none'
                  : 'bg-secondary text-secondary-foreground rounded-tl-none border border-border/50',
                isError && 'border-destructive/50 bg-destructive/10 text-destructive',
                isPending && 'opacity-80',
              )}
            >
              {/* 错误标题 */}
              {isError && (
                <div className="flex items-center gap-2 mb-2 text-destructive font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>生成出错</span>
                </div>
              )}

              {/* 内容区 */}
              {generating && !content
                ? (
                  /* 无内容时：跳动点 */
                    <GeneratingIndicator isPending={isPending} />
                  )
                : isUser
                  ? (
                    /* 用户消息：纯文本，保留换行 */
                      <p className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">{content}</p>
                    )
                  : (
                    /* AI 消息：Markdown + 光标 */
                      <MessageMarkdown
                        content={content || (isError ? (message.error ?? '') : '')}
                        isUser={false}
                        isStreaming={isStreaming && !!content}
                      />
                    )}

              {/* 错误详情 */}
              {isError && message.error && (
                <div className="mt-2 text-xs opacity-70 border-t border-destructive/20 pt-2">
                  {message.error}
                </div>
              )}

              {/* 用户消息底部：仅时间 */}
              {isUser && (
                <div className="flex items-center justify-end mt-1.5">
                  <span className="text-[10px] opacity-40">{formatWithLocalTZ(message.createdAt, 'HH:mm')}</span>
                </div>
              )}

              {/* AI 消息底部：时间 + token + 操作（生成完成后才显示） */}
              {!isUser && !generating && (
                <MessageFooter content={content} createdAt={message.createdAt} />
              )}
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent>
            {!generating && (
              <>
                <ContextMenuItem
                  onClick={() => {
                    if (content)
                      navigator.clipboard.writeText(content)
                  }}
                >
                  <Copy className="w-3.5 h-3.5 mr-2" />
                  复制消息
                </ContextMenuItem>
                <ContextMenuItem variant="destructive" onClick={deleteHandler}>
                  删除消息
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>

        {/* 取消生成按钮——气泡下方，流式中显示 */}
        {isStreaming && (
          <button
            type="button"
            onClick={handleCancelGeneration}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium',
              'text-muted-foreground border border-border/60 bg-background/80 backdrop-blur-sm',
              'hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5',
              'transition-all duration-150 shadow-sm cursor-pointer select-none',
            )}
          >
            <OctagonX className="w-3 h-3 shrink-0" />
            停止生成
          </button>
        )}
      </div>
    </div>
  )
})
