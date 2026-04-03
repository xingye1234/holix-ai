import type { ComponentPropsWithoutRef } from 'react'
import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/provider'
import { cn } from '@/lib/utils'

interface CodeBlockProps extends ComponentPropsWithoutRef<'code'> {
  isUser?: boolean
}

interface PreBlockProps extends ComponentPropsWithoutRef<'pre'> {
  isUser?: boolean
}

function extractNodeText(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number')
    return String(node)

  if (Array.isArray(node))
    return node.map(extractNodeText).join('')

  if (node && typeof node === 'object' && 'props' in node) {
    const child = (node as { props?: { children?: unknown } }).props?.children
    return extractNodeText(child)
  }

  return ''
}

/**
 * 内联代码组件
 */
export function InlineCode({
  children,
  className,
  isUser,
  ...props
}: CodeBlockProps) {
  const codeClass = isUser
    ? 'bg-primary-foreground/20'
    : 'bg-muted-foreground/20'

  return (
    <code
      className={cn(
        'px-1 py-0.5 rounded font-mono text-xs',
        codeClass,
        className,
      )}
      {...props}
    >
      {children}
    </code>
  )
}

/**
 * 代码块组件（由 shiki 处理语法高亮）
 */
export function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <code className={className} {...props}>
      {children}
    </code>
  )
}

/**
 * Pre 包装器组件（带复制按钮 + 折叠展开）
 */
export function PreBlock({
  children,
  isUser,
  className,
  ...props
}: PreBlockProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  const codeText = useMemo(() => extractNodeText(children), [children])
  const lineCount = useMemo(() => codeText.split('\n').length, [codeText])

  const shouldCollapse = lineCount > 18
  const [expanded, setExpanded] = useState(!shouldCollapse)

  useEffect(() => {
    setExpanded(!shouldCollapse)
  }, [shouldCollapse, codeText])

  const handleCopy = () => {
    const text = preRef.current?.textContent || codeText

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="relative group">
      <pre
        ref={preRef}
        className={cn(
          'p-3 rounded-lg mb-2 overflow-x-auto text-xs border transition-all duration-200',
          isUser ? 'bg-primary-foreground/10' : 'bg-muted/50',
          !expanded && shouldCollapse && 'max-h-80 overflow-y-hidden',
          className,
        )}
        {...props}
      >
        {children}
      </pre>

      {!expanded && shouldCollapse && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 h-10 bg-linear-to-t from-background/90 to-transparent" />
      )}

      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {shouldCollapse && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => setExpanded(prev => !prev)}
            title={expanded ? t('message.code.collapse') : t('message.code.expand')}
          >
            {expanded
              ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    {t('message.code.collapse')}
                  </>
                )
              : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    {t('message.code.expand')}
                  </>
                )}
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 opacity-80 hover:opacity-100"
          onClick={handleCopy}
          title={copied ? t('message.code.copied') : t('message.code.copy')}
        >
          {copied
            ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              )
            : (
                <Copy className="w-3.5 h-3.5" />
              )}
        </Button>
      </div>
    </div>
  )
}

/**
 * 用于 ReactMarkdown 的 code 组件
 */
export function MarkdownCode({ isUser }: { isUser: boolean }) {
  return function Code({
    children,
    className,
    ...props
  }: ComponentPropsWithoutRef<'code'>) {
    const inline = !String(children).includes('\n')

    if (inline) {
      return (
        <InlineCode isUser={isUser} className={className} {...props}>
          {children}
        </InlineCode>
      )
    }

    return (
      <CodeBlock className={className} {...props}>
        {children}
      </CodeBlock>
    )
  }
}

/**
 * 用于 ReactMarkdown 的 pre 组件
 */
export function MarkdownPre({ isUser }: { isUser: boolean }) {
  return function Pre({
    children,
    className,
    ...props
  }: ComponentPropsWithoutRef<'pre'>) {
    return (
      <PreBlock isUser={isUser} className={className} {...props}>
        {children}
      </PreBlock>
    )
  }
}
