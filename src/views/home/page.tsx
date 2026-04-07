import type { EditorHandle } from '@/components/editor/props'
import type { HomeMode, HomeModeCopy, HomeStatusBadge, StarterTemplate } from './types'
import { HomeChatComposer } from './chat-composer'
import { HomeProviderEmptyState } from './provider-empty-state'
import { HomeStatusCard } from './status-card'

interface HomePageProps {
  canSend: boolean
  chatTitle: string
  defaultProviderName: string
  editorPlaceholder: string
  editorRef: React.RefObject<EditorHandle | null>
  estimatedTokensLabel: string
  hasContent: boolean
  mode: HomeMode
  modeCopy: HomeModeCopy
  onChatTitleChange: (value: string) => void
  onModelChange: (value: string) => void
  onOpenAgents: () => void
  onOpenProviders: () => void
  onOpenSkills: () => void
  onProviderChange: (value: string) => void
  onSend: () => void
  onTemplateApply: (template: StarterTemplate) => void
  onTextChange: (text: string) => void
  promptValue: string
  readyProviderCount: number
  sendLabel: string
  starterTemplates: readonly StarterTemplate[]
  statusBadges: HomeStatusBadge[]
}

export function HomePage({
  canSend,
  chatTitle,
  defaultProviderName,
  editorPlaceholder,
  editorRef,
  estimatedTokensLabel,
  hasContent,
  mode,
  modeCopy,
  onChatTitleChange,
  onModelChange,
  onOpenAgents,
  onOpenProviders,
  onOpenSkills,
  onProviderChange,
  onSend,
  onTemplateApply,
  onTextChange,
  promptValue,
  readyProviderCount,
  sendLabel,
  starterTemplates,
  statusBadges,
}: HomePageProps) {
  return (
    <div className="relative min-h-full w-full overflow-auto bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-18 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/7 blur-3xl" />
        <div className="absolute bottom-10 right-16 h-72 w-72 rounded-full bg-emerald-500/8 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-5xl px-6 py-10 lg:px-10">
        <div className="flex w-full flex-col gap-5">
          <HomeStatusCard
            defaultProviderName={defaultProviderName}
            mode={mode}
            modeCopy={modeCopy}
            readyProviderCount={readyProviderCount}
            statusBadges={statusBadges}
          />

          {mode === 'needsProvider'
            ? (
                <HomeProviderEmptyState
                  onOpenProviders={onOpenProviders}
                  onOpenSkills={onOpenSkills}
                />
              )
            : (
                <HomeChatComposer
                  canSend={canSend}
                  chatTitle={chatTitle}
                  editorPlaceholder={editorPlaceholder}
                  editorRef={editorRef}
                  estimatedTokensLabel={estimatedTokensLabel}
                  hasContent={hasContent}
                  mode={mode}
                  onChatTitleChange={onChatTitleChange}
                  onModelChange={onModelChange}
                  onOpenAgents={onOpenAgents}
                  onOpenProviders={onOpenProviders}
                  onProviderChange={onProviderChange}
                  onSend={onSend}
                  onTemplateApply={onTemplateApply}
                  onTextChange={onTextChange}
                  promptValue={promptValue}
                  sendLabel={sendLabel}
                  starterTemplates={starterTemplates}
                />
              )}
        </div>
      </div>
    </div>
  )
}
