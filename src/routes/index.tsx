import { debounce } from '@tanstack/pacer/debouncer'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Coins, Sparkles } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Editor } from '@/components/editor/editor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/provider'
import { command } from '@/lib/command'
import { getProvider } from '@/lib/provider'
import { estimateTokens, formatTokenCount } from '@/share/token'
import useChat from '@/store/chat'
import ProviderModelSelector from '@/views/shared/provider-model-selector'

function generateTitle(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/^(.{1,50}[。？！\n])/)
  if (match) {
    return match[1].replace(/\n/g, ' ').trim()
  }
  return trimmed.length > 50 ? `${trimmed.substring(0, 50)}...` : trimmed
}

function Index() {
  const [value, setValue] = useState('')
  const [chatTitle, setChatTitle] = useState('')
  const [provider, setProvider] = useState<string>('')
  const [model, setModel] = useState<string>('')
  const chat = useChat()
  const { t } = useI18n()
  const navigate = useNavigate()

  const onTextChange = useCallback(
    debounce(
      (text: string) => {
        setValue(text)
      },
      {
        wait: 300,
      },
    ),
    [],
  )

  const estimatedTokens = useMemo(() => estimateTokens(value), [value])

  // 只有标题时创建空会话（不发消息），有正文时正常发送
  const hasTitle = chatTitle.trim().length > 0
  const hasContent = value.trim().length > 0
  const canSend = (hasTitle || hasContent) && !!model && !!provider

  const onSend = useCallback(() => {
    if (!canSend)
      return

    const titleToUse = hasTitle
      ? chatTitle.trim()
      : generateTitle(value);

    (async () => {
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
        // 只有标题时不发消息，有正文时才发消息
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
      })
  }, [canSend, hasTitle, hasContent, chatTitle, value, model, provider, chat.createChat, t])

  return (
    <div className="relative min-h-full overflow-hidden bg-background w-full">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-20 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/7 blur-3xl" />
        <div className="absolute bottom-10 right-16 h-64 w-64 rounded-full bg-emerald-500/8 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-full w-full max-w-5xl items-center px-6 py-10 lg:px-10">
        <section className="mx-auto w-full max-w-3xl">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1 text-xs text-muted-foreground shadow-[0_8px_24px_-18px_rgba(0,0,0,0.18)] backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t('home.kicker')}
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground lg:text-5xl">
              {t('home.title')}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground lg:text-base">
              {t('home.subtitle')}
            </p>
          </div>

          <div className="rounded-[30px] border border-border/60 bg-card/78 p-4 shadow-[0_18px_48px_-34px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div className="text-sm font-medium text-foreground">{t('home.panelTitle')}</div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                <Coins className="h-3.5 w-3.5" />
                {formatTokenCount(estimatedTokens)}
              </div>
            </div>

            <div className="space-y-3">
              <Input
                value={chatTitle}
                onChange={e => setChatTitle(e.target.value)}
                placeholder={t('home.chatTitlePlaceholder')}
                className="h-12 rounded-2xl border-border/60 bg-background/72 px-4 text-sm shadow-none transition-[color,box-shadow,border-color,background-color] focus-visible:border-primary/40 focus-visible:ring-primary/15 dark:bg-background/60"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey)
                    onSend()
                }}
              />

              <Editor
                placeholder={t('home.inputPlaceholder')}
                ariaPlaceholder={t('home.inputPlaceholder')}
                rootClassName="min-h-[220px] bg-background/72 dark:bg-background/60"
                wrapperClassName="rounded-[24px]"
                onError={(err) => {
                  console.error(`editor:`, err ? err.message : 'unknown error')
                }}
                onTextChange={onTextChange}
                keyboard={{
                  onEnter: onSend,
                }}
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center">
              <ProviderModelSelector
                className="min-w-0 flex-1"
                triggerOnInitialize
                onProviderChange={setProvider}
                onModelChange={setModel}
              />
              <Button
                className="h-11 rounded-2xl px-5 sm:min-w-36"
                onClick={onSend}
                disabled={!canSend}
              >
                {hasTitle && !hasContent ? t('home.createChat') : t('common.send')}
              </Button>
            </div>

            <div className="mt-3 px-1 text-xs leading-6 text-muted-foreground">
              {t('home.contentTipDesc')}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Index,
})
