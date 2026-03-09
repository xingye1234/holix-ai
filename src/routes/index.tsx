import { debounce } from '@tanstack/pacer/debouncer'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Coins } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Editor } from '@/components/editor/editor'
import ProviderModelSelector from '@/components/provider-model-selector'
import { Button } from '@/components/ui/button'
import { command } from '@/lib/command'
import { getProvider } from '@/lib/provider'
import { estimateTokens, formatTokenCount } from '@/share/token'
import { useI18n } from '@/i18n/provider'
import useChat from '@/store/chat'

// 从 value 中提取标题：取前面部分内容
function generateTitle(text: string) {
  const trimmed = text.trim()
  // 尝试在句号、问号、感叹号或换行符处断开
  const match = trimmed.match(/^(.{1,50}[。？！\n])/)
  if (match) {
    return match[1].replace(/\n/g, ' ').trim()
  }
  // 如果没有标点，直接截取前 50 个字符
  return trimmed.length > 50 ? `${trimmed.substring(0, 50)}...` : trimmed
}

function Index() {
  const [value, setValue] = useState('')
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

  const onSend = useCallback(() => {
    if (value.trim().length === 0)
      return
    if (!model || !provider)
      return

    const title = generateTitle(value);

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

      const newChat = await chat.createChat({ provider, model, title })

      if (newChat) {
        setTimeout(() => {
          command('chat.message', {
            chatId: newChat.uid,
            content: value,
          })
          navigate({
            to: '/chat/$id',
            params: { id: newChat.uid },
          })
        }, 100)
      }
    })()
      .catch((err) => {
        console.error('Failed to create chat:', err)
        toast.error(`${t('home.createChatFailed')}: ${err.message || err}`)
      })
      .finally(() => {
        setValue('')
      })
  }, [value, model, provider, chat.createChat, t])

  return (
    <div className="w-full flex justify-center items-center">
      <div className="w-full max-w-3xl p-4 flex flex-col gap-4">
        <h2 className="text-center font-bold text-xl">{t('home.title')}</h2>
        <Editor
          placeholder={t('home.inputPlaceholder')}
          ariaPlaceholder={t('home.inputPlaceholder')}
          rootClassName="min-h-[200px]"
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
          <Button className="ml-auto" onClick={onSend} disabled={!model || !provider || value.trim().length === 0}>
            {t('common.send')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/')({
  component: Index,
})
