import type { MessageRenderProps } from './article-layout'
import { AlertCircle, Bot, OctagonX, User } from 'lucide-react'
import { useI18n } from '@/i18n/provider'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { formatWithLocalTZ } from '@/lib/time'
import { cn } from '@/lib/utils'
import useMessageSelection from '@/store/message-selection'
import { BlockRenderer } from './block-renderer'
import { MessageFooter } from './footer'
import { GeneratingIndicator } from './generating'
import { buildMessageRenderBlocks } from './message-blocks'

export function ChatLayout({
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
  pendingApprovalRequest,
  onDelete,
  onCancelGeneration,
  onPreview,
  onExport,
  canExport,
}: MessageRenderProps) {
  const { t } = useI18n()
  const isSelectionMode = useMessageSelection(s => s.isSelectionMode)
  const isSelected = useMessageSelection(s => s.isMessageSelected(id))
  const toggleMessageSelection = useMessageSelection(s => s.toggleMessageSelection)
  const blocks = buildMessageRenderBlocks({
    message,
    content,
    toolCallPairs,
    isStreaming,
    isError,
    isPending,
    generating,
    isToolRunning,
    runningTools,
    pendingApprovalRequest,
  })

  return (
    <div
      className={cn(
        'flex w-full max-w-3xl gap-3 mx-auto px-4 py-3 group transition-all duration-200 rounded-md',
        isUser ? 'flex-row-reverse' : 'flex-row',
        isSelected && 'bg-primary/10 border-l-4 border-primary shadow-sm',
        isSelectionMode && 'hover:bg-accent/20',
      )}
      data-message-id={id}
      data-message-index={index}
      onClick={() => isSelectionMode && toggleMessageSelection(id)}
    >
      {/* Avatar */}
      <div className="flex items-start gap-2">
        {isSelectionMode && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleMessageSelection(id)}
            className="mt-2"
          />
        )}
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
      </div>

      {/* 气泡 + 取消按钮 */}
      <div className={cn('flex flex-col gap-1.5 max-w-[85%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'relative min-w-16 max-w-full rounded-2xl px-4 py-3 text-sm transition-all duration-200',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-none'
              : 'bg-secondary text-secondary-foreground rounded-tl-none border border-border/50',
            isError && 'border-destructive/50 bg-destructive/10 text-destructive',
            isPending && 'opacity-80',
          )}
          style={{
            boxShadow: isUser ? 'var(--message-user-shadow)' : 'var(--message-ai-shadow)',
            ...(isUser ? {} : { borderColor: 'var(--message-ai-border)' }),
            ...(isError && !isUser ? { backgroundColor: 'var(--message-error-bg)' } : {}),
            ...(isPending && !isUser ? { backgroundColor: 'var(--message-thinking-bg)' } : {}),
          }}
        >
          {isError && (
            <div className="flex items-center gap-2 mb-2 text-destructive font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{t('message.generationError')}</span>
            </div>
          )}

          {generating && !content && blocks.length === 0
            ? (
                <GeneratingIndicator isPending={isPending} isToolRunning={isToolRunning} runningTools={runningTools} />
              )
            : (
                <BlockRenderer
                  blocks={blocks}
                  isUser={isUser}
                />
              )}

          {isError && message.error && (
            <div className="mt-2 text-xs opacity-70 border-t border-destructive/20 pt-2">
              {message.error}
            </div>
          )}

          {isUser && (
            <div className="flex items-center justify-end mt-1.5">
              <span className="text-[10px] opacity-40">{formatWithLocalTZ(message.createdAt, 'HH:mm')}</span>
            </div>
          )}
        </div>

        {!generating && (
          <MessageFooter
            hideMetadata={isUser}
            content={content}
            createdAt={message.createdAt}
            telemetry={message.telemetry}
            onPreview={onPreview}
            onExport={onExport}
            onDelete={onDelete}
            exportDisabled={!canExport}
          />
        )}

        {isStreaming && (
          <button
            type="button"
            onClick={onCancelGeneration}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium',
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
    </div>
  )
}
