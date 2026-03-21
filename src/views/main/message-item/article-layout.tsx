import type { Message } from '@/node/database/schema/chat'
import type { ToolCallPair } from './tool-call-card'
import { AlertCircle, Bot, OctagonX } from 'lucide-react'
import { useI18n } from '@/i18n/provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { formatWithLocalTZ } from '@/lib/time'
import { cn } from '@/lib/utils'
import useMessageSelection from '@/store/message-selection'
import { MessageFooter } from './footer'
import { GeneratingIndicator } from './generating'
import { MessageMarkdown } from './markdown'
import { ToolCallCard } from './tool-call-card'

export interface MessageRenderProps {
  id: string
  index: number
  message: Message
  content: string
  toolCallPairs: ToolCallPair[]
  isUser: boolean
  isError: boolean
  isStreaming: boolean
  isPending: boolean
  generating: boolean
  isToolRunning: boolean
  runningTools: string[]
  onDelete: () => void
  onCancelGeneration: () => void
  onPreview: () => void
  onExport: () => void
}

export function ArticleLayout({
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
  onDelete,
  onCancelGeneration,
  onPreview,
  onExport,
}: MessageRenderProps) {
  const { t } = useI18n()
  const isSelectionMode = useMessageSelection(s => s.isSelectionMode)
  const isSelected = useMessageSelection(s => s.isMessageSelected(id))
  const toggleMessageSelection = useMessageSelection(s => s.toggleMessageSelection)

  const toolCallList = !isUser && toolCallPairs.length > 0 && (
    <div className="flex flex-col gap-1.5 mb-2 w-full">
      {toolCallPairs.map(pair => (
        <ToolCallCard key={pair.request.id} pair={pair} isStreaming={isStreaming} />
      ))}
    </div>
  )

  return (
    <div
      className={cn(
        'w-full max-w-3xl mx-auto px-6 py-4 group transition-all duration-200 relative rounded-lg',
        isSelected && 'bg-primary/10 border-l-4 border-primary shadow-sm',
        isSelectionMode && 'hover:bg-accent/20 rounded-md',
      )}
      data-message-id={id}
      data-message-index={index}
    >
      {isUser
        ? (
            /* 用户消息：右对齐气泡 */
            <div className="flex flex-col items-end gap-0.5">
              <div className="flex justify-end items-start gap-2">
                {isSelectionMode && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleMessageSelection(id)}
                    className="mt-2"
                  />
                )}
                <div
                  className="max-w-[75%] bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-2.5 text-sm transition-all duration-200"
                  onClick={() => isSelectionMode && toggleMessageSelection(id)}
                  style={{ boxShadow: 'var(--message-user-shadow)' }}
                >
                  <p className="leading-relaxed whitespace-pre-wrap wrap-break-word">{content}</p>
                  <div className="flex items-center justify-end mt-1">
                    <span className="text-[10px] opacity-40">{formatWithLocalTZ(message.createdAt, 'HH:mm')}</span>
                  </div>
                </div>
              </div>
              <MessageFooter hideMetadata content={content} createdAt={message.createdAt} onPreview={onPreview} onExport={onExport} onDelete={onDelete} />
            </div>
          )
        : (
            /* AI 消息：全宽文章式 */
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                {isSelectionMode && (
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleMessageSelection(id)} />
                )}
                <Avatar className="w-6 h-6 border shadow-sm">
                  <AvatarImage src="" />
                  <AvatarFallback className="bg-secondary text-secondary-foreground">
                    <Bot className="w-3.5 h-3.5" />
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-medium text-muted-foreground">AI</span>
              </div>

              {toolCallList}

              <div
                className={cn(
                  'text-sm leading-relaxed transition-all duration-200',
                  isError && 'text-destructive',
                  isPending && 'opacity-70',
                )}
                onClick={() => isSelectionMode && toggleMessageSelection(id)}
                style={{
                  ...(isError ? { backgroundColor: 'var(--message-error-bg)', padding: '0.5rem', borderRadius: '0.5rem' } : {}),
                  ...(isPending ? { backgroundColor: 'var(--message-thinking-bg)', padding: '0.5rem', borderRadius: '0.5rem' } : {}),
                }}
              >
                {isError && (
                  <div className="flex items-center gap-2 mb-2 text-destructive font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{t('message.generationError')}</span>
                  </div>
                )}

                {generating && !content
                  ? (
                      <GeneratingIndicator isPending={isPending} isToolRunning={isToolRunning} runningTools={runningTools} />
                    )
                  : (
                      <MessageMarkdown
                        content={content || (isError ? (message.error ?? '') : '')}
                        isUser={false}
                        isStreaming={isStreaming && !!content}
                      />
                    )}

                {isError && message.error && (
                  <div className="mt-2 text-xs opacity-70 border-t border-destructive/20 pt-2">
                    {message.error}
                  </div>
                )}
              </div>

              {!generating && <MessageFooter content={content} createdAt={message.createdAt} onPreview={onPreview} onExport={onExport} onDelete={onDelete} />}

              {isStreaming && (
                <button
                  type="button"
                  onClick={onCancelGeneration}
                  className={cn(
                    'self-start flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium',
                    'text-muted-foreground border border-border/60 bg-background/80 backdrop-blur-sm',
                    'hover:text-destructive hover:border-destructive/50 hover:bg-destructive/5',
                    'transition-all duration-150 shadow-sm cursor-pointer select-none',
                  )}
                >
                  <OctagonX className="w-3 h-3 shrink-0" />
                  {t('message.stopGeneration')}
                </button>
              )}
            </div>
          )}
    </div>
  )
}
