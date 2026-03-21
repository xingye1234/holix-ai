import { Bot, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/provider'
import { trpcClient } from '@/lib/trpc-client'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface Agent {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  favorite?: boolean
  useCount?: number
}

export function AgentSelector({
  value,
  onChange,
  disabled = false,
}: {
  value?: string
  onChange?: (agentName: string | undefined) => void
  disabled?: boolean
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)

  // Load agents
  useEffect(() => {
    setLoading(true)
    trpcClient.agent.list()
      .then(setAgents)
      .catch(() => {
        // Ignore errors
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  // Handle selection
  const handleSelect = (agentName: string | undefined) => {
    onChange?.(agentName)
    setOpen(false)

    // Track usage if an agent was selected
    if (agentName) {
      trpcClient.agent.trackUsage({ name: agentName }).catch(() => {
        // Ignore tracking errors
      })
    }
  }

  const selectedAgent = value ? agents.find(a => a.name === value) : null

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={value ? 'default' : 'outline'}
            size="sm"
            disabled={disabled || loading}
            className="h-8 gap-1.5 px-2.5"
          >
            {selectedAgent
              ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    <span className="text-xs">{selectedAgent.name}</span>
                  </>
                )
              : (
                  <>
                    <Bot className="h-3.5 w-3.5" />
                    <span className="text-xs">{t('chat.sidebar.agents')}</span>
                  </>
                )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder={t('agents.list.searchPlaceholder')} />
            <CommandList>
              <CommandEmpty>{loading ? '加载中...' : '无匹配 Agent'}</CommandEmpty>
              <CommandGroup heading="选择 Agent">
                <CommandItem
                  value="__none"
                  onSelect={() => handleSelect(undefined)}
                >
                  <Bot className="h-4 w-4 mr-2" />
                  <span>不使用 Agent</span>
                </CommandItem>
                {agents.map(agent => (
                  <CommandItem
                    key={agent.id}
                    value={agent.name}
                    onSelect={() => handleSelect(agent.name)}
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{agent.name}</span>
                          {agent.favorite && (
                            <span className="text-red-500">★</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {agent.description || '无描述'}
                        </p>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
