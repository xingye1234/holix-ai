/**
 * Markdown 渲染器
 * - 支持 shiki 语法高亮
 * - 流式输出时在末尾追加打字光标
 */
import ReactMarkdown from 'react-markdown'
import { MarkdownCode, MarkdownPre } from '@/components/markdown/code-block'
import { rehypeShiki } from '@/lib/shiki'
import { cn } from '@/lib/utils'

interface MessageMarkdownProps {
  content: string
  isUser: boolean
  /** 流式输出中，末尾显示打字光标 */
  isStreaming?: boolean
}

export function MessageMarkdown({ content, isUser, isStreaming = false }: MessageMarkdownProps) {
  return (
    <div
      className={cn(
        'text-sm leading-relaxed wrap-break-word relative',
        // streaming-cursor-* 类让 CSS ::after 把光标注入到最后一个块元素内联末尾
        isStreaming && (isUser ? 'streaming-cursor-user' : 'streaming-cursor-ai'),
      )}
    >
      <ReactMarkdown
        // @ts-expect-error - rehypeShiki type mismatch with react-markdown
        rehypePlugins={[rehypeShiki]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mb-1.5">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold mb-1">{children}</h4>,
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
                isUser ? 'border-primary-foreground/50' : 'border-primary/50',
              )}
            >
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border/50 px-2 py-1 text-left font-semibold bg-muted/40">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-border/50 px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
