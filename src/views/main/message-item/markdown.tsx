/**
 * Markdown 渲染器
 * - 支持 shiki 语法高亮
 * - 流式输出时在末尾追加打字光标
 */
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer'

interface MessageMarkdownProps {
  content: string
  isUser: boolean
  /** 流式输出中，末尾显示打字光标 */
  isStreaming?: boolean
}

export function MessageMarkdown({ content, isUser, isStreaming = false }: MessageMarkdownProps) {
  return (
    <MarkdownRenderer
      content={content}
      isUser={isUser}
      isStreaming={isStreaming}
    />
  )
}
