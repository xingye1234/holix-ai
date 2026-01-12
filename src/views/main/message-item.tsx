/* eslint-disable style/multiline-ternary */
import type { Message } from '@/node/database/schema/chat'
import {
  AlertCircle,
  Bot,
  Brain,
  Check,
  Copy,
  Download,
  Loader2,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import { MarkdownCode, MarkdownPre } from '@/components/markdown/code-block'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useMessage } from '@/hooks/message'
import { command } from '@/lib/command'
import { rehypeShiki } from '@/lib/shiki'
import { formatWithLocalTZ } from '@/lib/time'
import { cn } from '@/lib/utils'

interface MessageItemProps {
  message: Message
  index: number
}

// ✅ Telegram 架构：MessageItem 自己订阅单个消息，完全隔离
// 只有该消息更新时才会重渲染，其他消息不受影响
export const MessageItem = memo(({
  message,
  index,
}: MessageItemProps) => {
  // 消息可能还未加载
  if (!message) {
    return null
  }
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isError = message.status === 'error'
  const isStreaming = message.status === 'streaming'
  const isPending = message.status === 'pending'

  const handleCancelGeneration = useCallback(() => {
    if (message.requestId) {
      command('chat.abort', { requestId: message.requestId })
      toast.success('正在取消生成...')
    }
    else {
      toast.error('无法取消：缺少请求ID')
    }
  }, [message.requestId])

  const content = useMemo(() => {
    if (message.error) {
      return message.content || ''
    }

    if (message.content) {
      return message.content
    }

    if (message.draftContent) {
      return message.draftContent
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(segment => segment.content)
        .join('')
    }

    return message.content || ''
  }, [message.content, message.error, message.draftContent])

  // 如果是 system 消息，暂时简单展示
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

  return (
    <div
      className={cn(
        'flex w-full gap-3 p-4 group',
        isUser ? 'flex-row-reverse' : 'flex-row',
      )}
      data-message-index={index}
    >
      {/* Avatar */}
      <Avatar className="w-8 h-8 border shrink-0 shadow-sm">
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

      {/* Content Bubble */}
      <div
        className={cn(
          'relative max-w-[85%] min-w-20 rounded-2xl px-4 py-3 text-sm shadow-sm transition-colors',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-none'
            : 'bg-secondary text-secondary-foreground rounded-tl-none border border-border/50',
          isError && 'border-destructive/50 bg-destructive/10 text-destructive',
          isPending && 'opacity-90',
        )}
      >
        {/* Status Indicator for AI */}
        {!isUser && (isStreaming || isPending) && (
          <div className="absolute -bottom-8 left-0 flex items-center gap-1.5 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-0.5 rounded-full border shadow-sm">
            {isStreaming ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span className="font-medium">Generating...</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 ml-1 hover:bg-destructive/20 hover:text-destructive rounded-full"
                  onClick={handleCancelGeneration}
                >
                  <X className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <>
                <Brain className="w-3 h-3 animate-pulse text-primary" />
                <span className="font-medium">Thinking...</span>
              </>
            )}
          </div>
        )}

        {/* Error Indicator */}
        {isError && (
          <div className="flex items-center gap-2 mb-2 text-destructive font-medium">
            <AlertCircle className="w-4 h-4" />
            <span>Error</span>
          </div>
        )}

        {/* Message Content */}
        <div className={cn('text-sm leading-relaxed wrap-break-word')}>
          {content ? (
            <ReactMarkdown
              // @ts-expect-error - rehypeShiki type mismatch with react-markdown
              rehypePlugins={[rehypeShiki]}
              components={{
                p: ({ children }) => (
                  <p className="mb-2 last:mb-0">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc pl-4 mb-2 last:mb-0">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 mb-2 last:mb-0">
                    {children}
                  </ol>
                ),
                li: ({ children }) => <li className="mb-1">{children}</li>,
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold mb-2">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold mb-2">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-bold mb-2">{children}</h3>
                ),
                code: MarkdownCode({ isUser }),
                pre: MarkdownPre({ isUser }),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="underline underline-offset-2 hover:opacity-80"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote
                    className={cn(
                      'border-l-2 pl-4 italic mb-2',
                      isUser
                        ? 'border-primary-foreground/50'
                        : 'border-primary/50',
                    )}
                  >
                    {children}
                  </blockquote>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <span className="italic opacity-50">
              {isStreaming ? '...' : 'No content'}
            </span>
          )}
        </div>

        {/* Error Message Detail */}
        {isError && message.error && (
          <div className="mt-2 text-xs opacity-80 border-t border-destructive/20 pt-2">
            {message.error}
          </div>
        )}

        {/* Footer: Time (and for AI: Token Count, Actions) */}
        {!isUser ? (
          <div
            className={cn(
              'flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-border/30',
            )}
          >
            <div className="flex items-center gap-2 text-[10px] opacity-60">
              <span>{formatWithLocalTZ(message.createdAt, 'HH:mm')}</span>
              {content && (
                <>
                  <span>•</span>
                  <span>
                    {Math.ceil(content.length / 4)}
                    {' '}
                    tokens
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                onClick={() => {
                  if (content) {
                    navigator.clipboard.writeText(content).then(() => {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    })
                  }
                }}
                title={copied ? '已复制' : '复制消息'}
              >
                {copied
                  ? (
                      <Check className="w-3 h-3 text-green-500" />
                    )
                  : (
                      <Copy className="w-3 h-3" />
                    )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                onClick={() => {
                  // TODO: 实现导出功能
                  console.log('Export message:', message.uid)
                }}
                title="导出消息"
              >
                <Download className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1 mt-2 select-none justify-end">
            <span className="text-[10px] opacity-40">
              {formatWithLocalTZ(message.createdAt, 'HH:mm')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
})
