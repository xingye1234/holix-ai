/**
 * 通用 Markdown 渲染器
 * - 支持 shiki 语法高亮
 * - 可配置样式主题
 * - 支持流式输出光标
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MarkdownCode, MarkdownPre } from '@/components/markdown/code-block'
import { rehypeShiki } from '@/lib/shiki'
import { cn } from '@/lib/utils'

interface MarkdownRendererProps {
  content: string
  /** 是否为用户消息（影响样式） */
  isUser?: boolean
  /** 流式输出中，末尾显示打字光标 */
  isStreaming?: boolean
  /** 自定义类名 */
  className?: string
  /** 紧凑模式（减少间距） */
  compact?: boolean
}

export function MarkdownRenderer({
  content,
  isUser = false,
  isStreaming = false,
  className,
  compact = false,
}: MarkdownRendererProps) {
  return (
    <div
      className={cn(
        'text-sm leading-relaxed wrap-break-word relative',
        // streaming-cursor-* 类让 CSS ::after 把光标注入到最后一个块元素内联末尾
        isStreaming && (isUser ? 'streaming-cursor-user' : 'streaming-cursor-ai'),
        className,
      )}
    >
      <ReactMarkdown
        // @ts-expect-error - rehypeShiki type mismatch with react-markdown
        rehypePlugins={[rehypeShiki]}
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className={cn('mb-2 last:mb-0', compact && 'mb-1')}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul className={cn('list-disc pl-4 mb-2 last:mb-0', compact && 'mb-1 pl-3')}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className={cn('list-decimal pl-4 mb-2 last:mb-0', compact && 'mb-1 pl-3')}>{children}</ol>
          ),
          li: ({ children }) => (
            <li className={cn('mb-1', compact && 'mb-0.5')}>{children}</li>
          ),
          h1: ({ children }) => (
            <h1 className={cn('text-lg font-bold mb-2', compact && 'text-base mb-1.5')}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className={cn('text-base font-bold mb-2', compact && 'text-sm mb-1.5')}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className={cn('text-sm font-bold mb-1.5', compact && 'text-xs mb-1')}>{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className={cn('text-sm font-semibold mb-1', compact && 'text-xs mb-0.5')}>{children}</h4>
          ),
          code: MarkdownCode({ isUser }),
          pre: MarkdownPre({ isUser }),
          a: ({ children, href }) => (
            <a
              href={href}
              className="underline underline-offset-2 hover:opacity-80 text-primary"
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
                compact && 'pl-3 mb-1',
                isUser ? 'border-primary-foreground/50' : 'border-primary/50',
              )}
            >
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className={cn('overflow-x-auto mb-3 rounded-md border border-border/50', compact && 'mb-2')}>
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-muted/60">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/40">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-muted/30 transition-colors">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-1.5 text-left font-semibold text-foreground border-b border-border/50 whitespace-nowrap">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 text-muted-foreground">{children}</td>
          ),
          hr: () => (
            <hr className={cn('my-4 border-border', compact && 'my-2')} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
