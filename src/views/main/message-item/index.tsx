import {
  AlertCircle,
  Bot,
  Copy,
  OctagonX,
  Sparkles,
  User,
  Wrench,
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

  /** 当前活跃的工具调用（最新一条 model 侧未完成的） */
  const activeToolCall = useMemo(() => {
    if (!generating || !message.draftContent)
      return null
    const toolSegs = message.draftContent.filter(s => s.phase === 'tool')
    if (!toolSegs.length)
      return null
    return toolSegs[toolSegs.length - 1]
  }, [generating, message.draftContent])

  const toolCallCount = useMemo(() => {
    if (!message.draftContent)
      return 0
    return message.draftContent.filter(s => s.phase === 'tool' && s.source === 'tool').length
  }, [message.draftContent])

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

  // ── 工具调用标签 ─────────────────────────────────────────────────────────
  const toolBadge = isStreaming && activeToolCall && activeToolCall.source === 'model' && (
    <div className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full mb-2 border border-border/40">
      <Wrench className="w-2.5 h-2.5 shrink-0 animate-pulse text-primary" />
      <span className="truncate max-w-40">
        {(() => {
          try {
            return JSON.parse(activeToolCall.content)?.name ?? 'tool'
          }
          catch {
            return 'tool'
          }
        })()}
      </span>
      {toolCallCount > 0 && (
        <span className="opacity-50">
          ·
          {' '}
          {toolCallCount}
          {' '}
          done
        </span>
      )}
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
        {/* 工具调用 badge */}
        {!isUser && toolBadge}

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
