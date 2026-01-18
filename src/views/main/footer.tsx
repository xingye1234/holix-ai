import type { PendingMessage } from '@/node/database/schema/chat'
import { Coins, Send, Settings } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Editor } from '@/components/editor/editor'
import ProviderModelSelector from '@/components/provider-model-selector'
import { Button } from '@/components/ui/button'
import { useChatContext } from '@/context/chat'
import { useSettingsPanel } from '@/context/settings-panel'
import { command } from '@/lib/command'
import { trpcClient } from '@/lib/trpc-client'
import { estimateTokens, formatTokenCount } from '../../share/token'

export default function MainFooter() {
  const [value, setValue] = useState('')
  const { chat, pendingMessages } = useChatContext()
  const { toggle: toggleSettingsPanel } = useSettingsPanel()
  const saveDraftInProgress = useRef(false)
  const [_, setProvider] = useState<string | undefined>(
    chat?.provider ?? undefined,
  )
  const [__, setModel] = useState<string | undefined>(chat?.model ?? undefined)
  const onTextChange = useCallback((text: string) => {
    setValue(text)
  }, [])
  const estimatedTokens = useMemo(() => estimateTokens(value), [value])

  const handleProviderChange = useCallback(
    async (newProvider: string) => {
      setProvider(newProvider)
      if (chat) {
        try {
          await trpcClient.chat.update({
            uid: chat.uid,
            provider: newProvider,
          })
        }
        catch (error) {
          console.error('Failed to update provider:', error)
        }
      }
    },
    [chat],
  )

  const handleModelChange = useCallback(
    async (newModel: string) => {
      setModel(newModel)
      if (chat) {
        try {
          await trpcClient.chat.update({
            uid: chat.uid,
            model: newModel,
          })
        }
        catch (error) {
          console.error('Failed to update model:', error)
        }
      }
    },
    [chat],
  )

  const onSend = useCallback(() => {
    if (!chat || value.trim().length === 0)
      return
    // 这里可以调用发送消息的逻辑

    command('chat.message', {
      chatId: chat.uid,
      content: value,
    })

    setValue('')
  }, [chat, value])

  const onSaveDraft = useCallback(() => {
    // Ctrl+S 保存草稿：弹窗确认并保存为 pendingMessage
    if (!chat || value.trim().length === 0 || saveDraftInProgress.current) {
      return true
    }

    saveDraftInProgress.current = true

    toast('保存为草稿？', {
      position: 'bottom-center',
      action: {
        label: '保存',
        onClick: async () => {
          try {
            const pending: PendingMessage = {
              id: nanoid(),
              content: value,
              ready: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }

            await trpcClient.chat.updatePendingMessages({
              chatUid: chat.uid,
              pendingMessages: [...pendingMessages, pending],
            })

            toast.success('已保存为草稿')
          }
          catch (err) {
            console.error('Failed to save draft:', err)
            toast.error('保存草稿失败')
          }
          finally {
            saveDraftInProgress.current = false
          }
        },
      },

      cancel: {
        label: '取消',
        onClick() {
          saveDraftInProgress.current = false
        },
      },

      actionButtonStyle: {
        marginLeft: '15px',
      },
    })

    return true
  }, [chat, pendingMessages, value])

  return (
    <footer className="w-full mt-auto h-(--app-chat-footer-height) border-t">
      <div className="h-(--app-chat-input-header-height) border-b px-2 flex items-center justify-between">
        <div>
          1
        </div>
        <div className="text-sm text-muted-foreground flex ml-auto items-center gap-2">
          <Coins className="w-4 h-4" />
          <span>{formatTokenCount(estimatedTokens)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={toggleSettingsPanel}
            title="设置"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="h-(--app-chat-input-height) my-(--app-chat-input-gap) px-2">
        <Editor
          placeholder="请输入问题"
          ariaPlaceholder="请输入问题"
          rootClassName="min-h-(--app-chat-input-height)"
          wrapperClassName="h-(--app-chat-input-height)"
          onError={(err) => {
            console.error(`editor:`, err ? err.message : 'unknown error')
          }}
          onTextChange={onTextChange}
          textValue={value}
          keyboard={{
            onEnter: () => {
              onSend()
              return true
            },
            onShiftEnter: () => {
              // Shift+Enter 允许换行
              return false
            },
            onCtrlS: () => {
              onSaveDraft()
              return true
            },
          }}
        />
      </div>

      <div className="flex items-center h-(--app-chat-input-footer-height) px-2">
        <div>
          <ProviderModelSelector
            initialProvider={chat?.provider}
            initialModel={chat?.model}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
          />
        </div>
        <Button
          className="ml-auto"
          disabled={!chat || value.trim().length === 0}
          onClick={onSend}
        >
          <Send />
          Send
        </Button>
      </div>
    </footer>
  )
}
