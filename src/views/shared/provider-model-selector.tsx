import type { AIProvider } from '@/types/provider'
import { useCallback, useEffect, useState } from 'react'
import { ProviderAvatar } from '@/components/provider-avatar'
import { useI18n } from '@/i18n/provider'
import { getDefaultProvider, getProviders } from '@/lib/provider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface ProviderModelSelectorProps {
  initialProvider?: string
  initialModel?: string
  triggerOnInitialize?: boolean
  onSelectionChange?: (selection: { provider: string, model: string }) => void
  onProviderChange?: (provider: string) => void
  onModelChange?: (model: string) => void
  className?: string
}

interface ProviderOption {
  provider: AIProvider
  models: string[]
}

interface ProviderModelOption {
  provider: AIProvider
  model: string
  value: string
}

function getSelectableProviders(providers: AIProvider[]) {
  return providers
    .filter(provider => provider.enabled)
    .map((provider): ProviderOption => ({
      provider,
      models: provider.models
        .map(model => model.trim())
        .filter(Boolean),
    }))
    .filter(option => option.models.length > 0)
}

function buildSelectionValue(provider: string, model: string) {
  return `${encodeURIComponent(provider)}::${encodeURIComponent(model)}`
}

function parseSelectionValue(value: string) {
  const [provider = '', model = ''] = value.split('::')
  return {
    provider: decodeURIComponent(provider),
    model: decodeURIComponent(model),
  }
}

function flattenProviderOptions(providerOptions: ProviderOption[]): ProviderModelOption[] {
  return providerOptions.flatMap(option =>
    option.models.map(model => ({
      provider: option.provider,
      model,
      value: buildSelectionValue(option.provider.name, model),
    })),
  )
}

export default function ProviderModelSelector({
  initialProvider: propInitialProvider,
  initialModel: propInitialModel,
  triggerOnInitialize = false,
  onSelectionChange,
  onProviderChange,
  onModelChange,
  className,
}: ProviderModelSelectorProps) {
  const { t } = useI18n()
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([])
  const [selectedValue, setSelectedValue] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    setSelectedValue(
      propInitialProvider && propInitialModel
        ? buildSelectionValue(propInitialProvider, propInitialModel)
        : '',
    )

    const init = async () => {
      try {
        const [providerList, defaultProviderName] = await Promise.all([getProviders(), getDefaultProvider()])

        if (cancelled) {
          return
        }

        const selectableProviders = getSelectableProviders(providerList)
        setProviderOptions(selectableProviders)

        let targetProvider: ProviderOption | undefined
        if (propInitialProvider) {
          targetProvider = selectableProviders.find(p => p.provider.name === propInitialProvider)
        }
        if (!targetProvider) {
          targetProvider = selectableProviders.find(p => p.provider.name === defaultProviderName) || selectableProviders[0]
        }

        if (targetProvider) {
          const providerName = targetProvider.provider.name
          const availableModels = targetProvider.models
          let targetModel = ''
          if (propInitialModel && availableModels.includes(propInitialModel)) {
            targetModel = propInitialModel
          }
          else {
            targetModel = availableModels[0] || ''
          }

          if (targetModel) {
            setSelectedValue(buildSelectionValue(providerName, targetModel))
            if (triggerOnInitialize) {
              onSelectionChange?.({ provider: providerName, model: targetModel })
              onProviderChange?.(providerName)
              onModelChange?.(targetModel)
            }
          }
          else {
            setSelectedValue('')
          }
        }
        else {
          setSelectedValue('')
        }
      }
      catch (error) {
        if (!cancelled) {
          console.error('Failed to load providers:', error)
        }
      }
      finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [propInitialProvider, propInitialModel, triggerOnInitialize, onModelChange, onProviderChange, onSelectionChange])

  const handleSelectionChange = useCallback(
    (value: string) => {
      const nextSelection = parseSelectionValue(value)
      setSelectedValue(value)
      onSelectionChange?.(nextSelection)
      onProviderChange?.(nextSelection.provider)
      onModelChange?.(nextSelection.model)
    },
    [onModelChange, onProviderChange, onSelectionChange],
  )

  const selectionOptions = flattenProviderOptions(providerOptions)

  if (loading) {
    return <div className="h-10 w-72 animate-pulse rounded-md bg-muted" />
  }

  if (providerOptions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {t('selector.noAvailableProviderModel')}
      </div>
    )
  }

  return (
    <div className={className}>
      <Select value={selectedValue} onValueChange={handleSelectionChange}>
        <SelectTrigger className="w-72 max-w-full">
          <SelectValue placeholder={t('selector.selectProviderModel')} />
        </SelectTrigger>
        <SelectContent align="start">
          {selectionOptions.map(option => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex min-w-0 items-center gap-2">
                <ProviderAvatar
                  avatar={option.provider.avatar}
                  name={option.provider.name}
                  className="size-5 border-0"
                  fallbackClassName="bg-transparent"
                  textClassName="text-xs"
                />
                <span className="truncate">
                  {option.provider.name}
                  {' / '}
                  {option.model}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
