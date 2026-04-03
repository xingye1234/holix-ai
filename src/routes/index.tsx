import { debounce } from '@tanstack/pacer/debouncer'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Coins } from 'lucide-react'
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

      if (!providerConfig.apiKey?.trim()) {
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
    <div className="w-full flex justify-center items-center">
      <div className="w-full max-w-3xl p-4 flex flex-col gap-4">
        <h2 className="text-center font-bold text-xl">{t('home.title')}</h2>
        <Input
          value={chatTitle}
          onChange={e => setChatTitle(e.target.value)}
          placeholder={t('home.chatTitlePlaceholder')}
          className="h-12 rounded-xl border-border/60 bg-card/70 px-4 text-sm shadow-sm transition-[color,box-shadow,border-color,background-color] focus-visible:border-primary/40 focus-visible:ring-primary/15 dark:bg-card/60"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey)
              onSend()
          }}
        />
        <Editor
          placeholder={t('home.inputPlaceholder')}
          ariaPlaceholder={t('home.inputPlaceholder')}
          rootClassName="min-h-[200px]"
          wrapperClassName="rounded-2xl"
          onError={(err) => {
            console.error(`editor:`, err ? err.message : 'unknown error')
          }}
          onTextChange={onTextChange}
          keyboard={{
            onEnter: onSend,
          }}
        />
        <div className="flex items-center gap-2">
          <ProviderModelSelector triggerOnInitialize onProviderChange={setProvider} onModelChange={setModel} />
          <div className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Coins className="w-4 h-4" />
            <span>{formatTokenCount(estimatedTokens)}</span>
          </div>
          <Button className="ml-auto" onClick={onSend} disabled={!canSend}>
            {hasTitle && !hasContent ? t('home.createChat') : t('common.send')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Index,
})
