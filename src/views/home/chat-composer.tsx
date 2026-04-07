import type { EditorHandle } from '@/components/editor/props'
import { Bot, Coins, Rocket } from 'lucide-react'
import { Editor } from '@/components/editor/editor'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import ProviderModelSelector from '@/views/shared/provider-model-selector'
import type { HomeMode, StarterTemplate } from './types'

interface HomeChatComposerProps {
  canSend: boolean
  chatTitle: string
  estimatedTokensLabel: string
  hasContent: boolean
  mode: HomeMode
  onChatTitleChange: (value: string) => void
  onModelChange: (value: string) => void
  onProviderChange: (value: string) => void
  onSend: () => void
  onTemplateApply: (template: StarterTemplate) => void
  onOpenAgents: () => void
  onOpenProviders: () => void
  onTextChange: (text: string) => void
  promptValue: string
  sendLabel: string
  editorPlaceholder: string
  editorRef: React.RefObject<EditorHandle | null>
  starterTemplates: readonly StarterTemplate[]
}

export function HomeChatComposer({
  canSend,
  chatTitle,
  editorPlaceholder,
  editorRef,
  estimatedTokensLabel,
  hasContent,
  mode,
  onChatTitleChange,
  onModelChange,
  onOpenAgents,
  onOpenProviders,
  onProviderChange,
  onSend,
  onTemplateApply,
  onTextChange,
  promptValue,
  sendLabel,
  starterTemplates,
}: HomeChatComposerProps) {
  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-[28px] border border-border/60 bg-card/76 p-4 shadow-[0_18px_48px_-34px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-5">
        <div className="mb-4 flex flex-col gap-3 rounded-[22px] border border-border/55 bg-background/55 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">
              {mode === 'starter' ? '开始第一条任务' : '快速发起新任务'}
            </div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              {mode === 'starter'
                ? '标题不必很长，先把任务抛给 Holix。'
                : '把标题、模型和提示词放在一条连续流程里，直接开始会话。'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
              <Coins className="h-3.5 w-3.5" />
              {estimatedTokensLabel}
            </div>
            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px]">
              {hasContent ? 'Prompt 已就绪' : '等待输入'}
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          <Editor
            ref={editorRef}
            placeholder={editorPlaceholder}
            ariaPlaceholder={editorPlaceholder}
            rootClassName="min-h-[260px] bg-background/72 dark:bg-background/60"
            wrapperClassName="rounded-[24px]"
            onError={(err) => {
              console.error('editor:', err ? err.message : 'unknown error')
            }}
            onTextChange={onTextChange}
            keyboard={{
              onEnter: onSend,
            }}
          />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px_auto]">
            <div className="min-w-0">
              <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
                标题
              </div>
              <Input
                value={chatTitle}
                onChange={e => onChatTitleChange(e.target.value)}
                placeholder="给这次任务一个简短标题"
                className="h-11 rounded-2xl border-border/60 bg-background/72 px-4 text-sm shadow-none transition-[color,box-shadow,border-color,background-color] focus-visible:border-primary/40 focus-visible:ring-primary/15 dark:bg-background/60"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey)
                    onSend()
                }}
              />
            </div>

            <div className="min-w-0">
              <div className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
                模型
              </div>
              <ProviderModelSelector
                className="min-w-0"
                triggerOnInitialize
                onProviderChange={onProviderChange}
                onModelChange={onModelChange}
              />
            </div>

            <div className="flex items-end">
              <Button
                className="h-11 w-full rounded-2xl px-6 lg:w-auto"
                onClick={onSend}
                disabled={!canSend}
              >
                {sendLabel}
              </Button>
            </div>
          </div>

          <div className="px-1 text-xs leading-5 text-muted-foreground">
            支持一句话开始，也可以先写上下文、目标和限制条件，再发送给模型。
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-border/60 bg-card/72 p-4 shadow-[0_18px_48px_-34px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
          <Rocket className="h-4 w-4 text-primary" />
          快捷提示词
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {starterTemplates.map((template) => {
            const Icon = template.icon
            const isActive = chatTitle === template.title && promptValue === template.prompt

            return (
              <button
                key={template.title}
                type="button"
                className={cn(
                  'w-full rounded-[18px] border px-4 py-4 text-left transition-colors',
                  isActive
                    ? 'border-primary/30 bg-primary/8'
                    : 'border-border/50 bg-background/82 hover:bg-background',
                )}
                onClick={() => onTemplateApply(template)}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">{template.title}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">{template.summary}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-[18px] border border-border/50 bg-background/72 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-foreground">继续扩展能力</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              你也可以去配置 Provider，或进入 Agent 空间整理常用工作流。
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="h-10 rounded-2xl" onClick={onOpenProviders}>
              打开 Provider 设置
            </Button>
            <Button variant="outline" className="h-10 rounded-2xl" onClick={onOpenAgents}>
              <Bot className="h-4 w-4" />
              Agent 空间
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
