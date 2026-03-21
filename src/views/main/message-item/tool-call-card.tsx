/**
 * ToolCallCard
 *
 * 展示单次工具调用的卡片，包含：
 * - 工具名称 + 状态图标（运行中 / 完成 / 被拒绝）
 * - 可折叠的调用参数（JSON 格式）
 * - 可折叠的执行结果
 */

import type { DraftSegment } from '@/node/database/schema/chat'
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, Terminal, XCircle } from 'lucide-react'
import { memo, useState } from 'react'
import { useI18n } from '@/i18n/provider'
import { cn } from '@/lib/utils'

/**
 * 一次完整（或进行中）的工具调用：包含请求侧段和可选的结果侧段
 */
export interface ToolCallPair {
  /** 工具调用请求段（source === 'model'） */
  request: DraftSegment
  /** 工具执行结果段（source === 'tool'），undefined 表示仍在执行中 */
  result?: DraftSegment
}

interface ToolCallCardProps {
  pair: ToolCallPair
  /** 是否处于流式生成中（影响"运行中"指示器显示） */
  isStreaming?: boolean
}

export const ToolCallCard = memo(({ pair, isStreaming }: ToolCallCardProps) => {
  const { t } = useI18n()
  const { request, result } = pair
  const [argsOpen, setArgsOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(true)

  const toolName = request.toolName ?? (() => {
    try {
      return JSON.parse(request.content)?.name ?? 'tool'
    }
    catch {
      return 'tool'
    }
  })()

  const toolArgs = request.toolArgs ?? (() => {
    try {
      return JSON.parse(request.content)?.args
    }
    catch {
      return undefined
    }
  })()

  const isDenied = result?.content?.startsWith('[操作被拒绝')
    || request.approvalStatus === 'denied'

  const isRunning = !result && isStreaming

  const statusIcon = isDenied
    ? <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
    : isRunning
      ? <Loader2 className="w-3.5 h-3.5 text-primary shrink-0 animate-spin" />
      : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />

  const argsStr = toolArgs
    ? JSON.stringify(toolArgs, null, 2)
    : null

  // 预处理结果内容：尝试 JSON 美化，fallback 保持原文
  const resultStr = result?.content ?? null
  const resultDisplay = resultStr
    ? (() => {
        try {
          const parsed = JSON.parse(resultStr)
          return JSON.stringify(parsed, null, 2)
        }
        catch {
          return resultStr
        }
      })()
    : null

  return (
    <div
      className={cn(
        'rounded-lg border border-border/50 bg-muted/30 text-xs overflow-hidden',
        isDenied && 'border-destructive/30 bg-destructive/5',
      )}
    >
      {/* 头部：工具名 + 状态 */}
      <div className="flex items-center gap-1.5 px-3 py-2">
        <Terminal className="w-3 h-3 text-muted-foreground shrink-0" />
        <span className="font-medium font-mono">{toolName}</span>
        <span className="ml-auto">{statusIcon}</span>
      </div>

      {/* 参数区（可折叠） */}
      {argsStr && (
        <div className="border-t border-border/40">
          <button
            type="button"
            className="flex w-full items-center gap-1 px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setArgsOpen(v => !v)}
          >
            {argsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span className="text-[10px] uppercase tracking-wide">参数</span>
          </button>
          {argsOpen && (
            <pre className="px-3 pb-2 text-[10px] leading-relaxed text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
              {argsStr}
            </pre>
          )}
        </div>
      )}

      {/* 结果区（可折叠） */}
      {resultDisplay && (
        <div className="border-t border-border/40">
          <button
            type="button"
            className="flex w-full items-center gap-1 px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setResultOpen(v => !v)}
          >
            {resultOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span className="text-[10px] uppercase tracking-wide">
              {isDenied ? t('message.toolDenied') : t('message.toolResult')}
            </span>
          </button>
          {resultOpen && (
            <pre
              className={cn(
                'px-3 pb-2 text-[10px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all max-h-48',
                isDenied ? 'text-destructive/80' : 'text-muted-foreground',
              )}
            >
              {resultDisplay}
            </pre>
          )}
        </div>
      )}
    </div>
  )
})

ToolCallCard.displayName = 'ToolCallCard'

// ─── 工具：将 draftContent 中的 tool 段配对 ──────────────────────────────────

/**
 * 将 draftContent 中的 tool 段按 toolCallId 配对，得到有序的 ToolCallPair 列表。
 * 未能找到匹配结果段的请求段将被视为"运行中"。
 */
export function pairToolCallSegments(
  segments: DraftSegment[],
): ToolCallPair[] {
  const toolSegments = segments.filter(s => s.phase === 'tool')

  // 请求段（model 侧）
  const requests = toolSegments.filter(s => s.source === 'model')
  // 结果段（tool 侧），以 toolCallId 为索引
  const resultsByCallId = new Map<string, DraftSegment>()
  for (const s of toolSegments) {
    if (s.source === 'tool' && s.toolCallId) {
      resultsByCallId.set(s.toolCallId, s)
    }
  }

  return requests.map((req) => {
    const result = req.toolCallId ? resultsByCallId.get(req.toolCallId) : undefined
    return { request: req, result }
  })
}
