import type { EditorHandle } from '@/components/editor/props'
import type { AIProvider } from '@/types/provider'
import { debounce } from '@tanstack/pacer/debouncer'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Bot, Sparkles, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/i18n/provider'
import { command } from '@/lib/command'
import { getDefaultProvider, getProvider, getProviders } from '@/lib/provider'
import { estimateTokens, formatTokenCount } from '@/share/token'
import useChat from '@/store/chat'
import { HomePage } from '@/views/home/page'
import type { HomeMode, HomeModeCopy, HomeStatusBadge, StarterTemplate } from '@/views/home/types'

function generateTitle(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^(.{1,50}[。？！\n])/)
  if (match) {
    return match[1].replace(/\n/g, ' ').trim()
  }
  return trimmed.length > 50 ? `${trimmed.substring(0, 50)}...` : trimmed
}

const starterTemplates: readonly StarterTemplate[] = [
  {
    title: '读懂当前仓库',
    prompt: '帮我梳理这个项目的结构、核心模块和建议的阅读顺序，并指出最值得先看的文件。',
    summary: '适合第一次把项目交给 Holix，让它先帮你建立上下文。',
    icon: Sparkles,
  },
  {
    title: '设计下一步功能',
    prompt: '基于当前产品和代码结构，给出下一步最值得实现的功能设计，包括用户价值、交互流程和技术切入点。',
    summary: '把产品想法快速转成可讨论、可落地的方案。',
    icon: Wand2,
  },
  {
    title: '创建专用 Agent',
    prompt: '为当前项目设计一个常用 Agent，包含职责、提示词、推荐技能和推荐模型组合。',
    summary: '适合开始沉淀重复工作流，减少每次手动配置。',
    icon: Bot,
  },
]

function isProviderReady(provider: AIProvider) {
  const hasModels = provider.models.some(model => model.trim().length > 0)
  const hasCredentials = provider.apiType === 'ollama' || provider.apiKey.trim().length > 0
  return provider.enabled && hasModels && hasCredentials
}

function getHomeMode(loadingProviders: boolean, readyProviders: AIProvider[], hasChats: boolean): HomeMode {
  if (loadingProviders)
    return 'loading'
  if (readyProviders.length === 0)
    return 'needsProvider'
  if (!hasChats)
    return 'starter'
  return 'active'
}

function getModeCopy(mode: HomeMode): HomeModeCopy {
  switch (mode) {
    case 'needsProvider':
      return {
        kicker: '先把工作台点亮',
        title: '先配置一个可用的 Provider，再开始第一轮协作。',
        subtitle: 'Holix 已经准备好工作流和界面，但现在还缺少真正可调用的模型。连接一个可用 Provider 后，首页会自动切换到可执行状态。',
      }
    case 'starter':
      return {
        kicker: '工作台已经就绪',
        title: '从一个清晰任务开始，建立你的第一条工作流。',
        subtitle: '你已经具备可用模型。现在最重要的不是继续配置，而是启动第一条真实任务，让 Holix 开始理解你的工作方式。',
      }
    case 'active':
      return {
        kicker: '继续推进你的工作',
        title: '新的任务可以马上开始，已有会话也能随时接力。',
        subtitle: 'Holix 已经进入持续协作状态。你可以继续发起新任务，也可以整理你的工作流配置。',
      }
    default:
      return {
        kicker: '正在准备工作台',
        title: '正在加载你的首页状态…',
        subtitle: 'Holix 正在检查可用 Provider 和最近会话。',
      }
  }
}

function Index() {
  const [value, setValue] = useState('')
  const [chatTitle, setChatTitle] = useState('')
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [providersLoading, setProvidersLoading] = useState(true)
  const [readyProviders, setReadyProviders] = useState<AIProvider[]>([])
  const [defaultProviderName, setDefaultProviderName] = useState('')

  const chat = useChat()
  const chats = useChat(state => state.chats)
  const initialized = useChat(state => state.initialized)
  const init = useChat(state => state.init)
  const { t } = useI18n()
  const navigate = useNavigate()
  const editorRef = useRef<EditorHandle>(null)

  useEffect(() => {
    if (!initialized) {
      init().catch((error) => {
        console.error('Failed to init chats:', error)
      })
    }
  }, [init, initialized])

  useEffect(() => {
    let cancelled = false

    const loadProviderState = async () => {
      try {
        setProvidersLoading(true)
        const [providerList, defaultProvider] = await Promise.all([getProviders(), getDefaultProvider()])
        if (cancelled)
          return

        setDefaultProviderName(defaultProvider)
        setReadyProviders(providerList.filter(isProviderReady))
      }
      catch (error) {
        if (!cancelled) {
          console.error('Failed to load providers:', error)
          setReadyProviders([])
        }
      }
      finally {
        if (!cancelled) {
          setProvidersLoading(false)
        }
      }
    }

    loadProviderState()

    return () => {
      cancelled = true
    }
  }, [])

  const onTextChange = useCallback(
    debounce(
      (text: string) => {
        setValue(text)
      },
      { wait: 300 },
    ),
    [],
  )

  const estimatedTokens = useMemo(() => estimateTokens(value), [value])
  const hasTitle = chatTitle.trim().length > 0
  const hasContent = value.trim().length > 0
  const canSend = (hasTitle || hasContent) && !!model && !!provider
  const homeMode = getHomeMode(providersLoading, readyProviders, chats.length > 0)
  const modeCopy = getModeCopy(homeMode)
  const readyProviderCount = readyProviders.length

  const statusBadges = useMemo((): HomeStatusBadge[] => {
    const badgeItems: HomeStatusBadge[] = [
      {
        label: readyProviderCount > 0 ? `${readyProviderCount} 个 Provider 已就绪` : '暂无可用 Provider',
        variant: readyProviderCount > 0 ? 'secondary' : 'outline',
      },
      {
        label: chats.length > 0 ? `${chats.length} 条历史会话` : '还没有历史会话',
        variant: chats.length > 0 ? 'secondary' : 'outline',
      },
    ]

    if (defaultProviderName) {
      badgeItems.push({
        label: `默认：${defaultProviderName}`,
        variant: 'outline',
      })
    }

    return badgeItems
  }, [chats.length, defaultProviderName, readyProviderCount])

  const onSend = useCallback(() => {
    if (!canSend)
      return

    const titleToUse = hasTitle
      ? chatTitle.trim()
      : generateTitle(value)

    ;(async () => {
      const providerConfig = await getProvider(provider)
      if (!providerConfig) {
        throw new Error(`Provider ${provider} not found`)
      }

      if (!providerConfig.models.includes(model)) {
        throw new Error(`Model ${model} not supported by provider ${provider}`)
      }

      if (providerConfig.apiType !== 'ollama' && !providerConfig.apiKey?.trim()) {
        throw new Error(`Provider ${provider} is not configured`)
      }

      const newChat = await chat.createChat({
        provider,
        model,
        title: titleToUse,
      })

      if (newChat) {
        navigate({
          to: '/chat/$id',
          params: { id: newChat.uid },
        })
        if (hasContent) {
          setTimeout(() => {
            command('chat.message', {
              chatId: newChat.uid,
              content: value,
            })
          }, 100)
        }
      }
    })()
      .catch((err: any) => {
        console.error('Failed to create chat:', err)
        toast.error(`${t('home.createChatFailed')}: ${err.message || err}`)
      })
      .finally(() => {
        setValue('')
        setChatTitle('')
        editorRef.current?.clear()
      })
  }, [canSend, chat, chatTitle, hasContent, hasTitle, model, navigate, provider, t, value])

  const applyTemplate = useCallback((template: StarterTemplate) => {
    setChatTitle(template.title)
    setValue(template.prompt)
    editorRef.current?.setText(template.prompt, { focus: true })
  }, [])

  return (
    <HomePage
      canSend={canSend}
      chatTitle={chatTitle}
      defaultProviderName={defaultProviderName}
      editorPlaceholder={t('home.inputPlaceholder')}
      editorRef={editorRef}
      estimatedTokensLabel={formatTokenCount(estimatedTokens)}
      hasContent={hasContent}
      mode={homeMode}
      modeCopy={modeCopy}
      onChatTitleChange={setChatTitle}
      onModelChange={setModel}
      onOpenAgents={() => navigate({ to: '/agents' })}
      onOpenProviders={() => navigate({ to: '/setting/provider' })}
      onOpenSkills={() => navigate({ to: '/skills' })}
      onProviderChange={setProvider}
      onSend={onSend}
      onTemplateApply={applyTemplate}
      onTextChange={onTextChange}
      promptValue={value}
      readyProviderCount={readyProviderCount}
      sendLabel={hasTitle && !hasContent ? t('home.createChat') : t('common.send')}
      starterTemplates={starterTemplates}
      statusBadges={statusBadges}
    />
  )
}

export const Route = createFileRoute('/')({
  component: Index,
})
