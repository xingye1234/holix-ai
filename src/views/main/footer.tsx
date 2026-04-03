import type { AutocompleteSuggestion } from '@/components/editor/plugins/autocomplete'
import type { EditorHandle } from '@/components/editor/props'
import type { PendingMessage } from '@/node/database/schema/chat'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronsDown, Coins, FileText, Folder, Send } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Editor } from '@/components/editor/editor'
import { SelectionToggle } from '@/components/message-selection'
import { Button } from '@/components/ui/button'
import { useChatContext } from '@/context/chat'
import { useI18n } from '@/i18n/provider'
import { command } from '@/lib/command'
import { trpcClient } from '@/lib/trpc-client'
import useChat from '@/store/chat'
import ProviderModelSelector from '@/views/shared/provider-model-selector'
import { estimateTokens, formatTokenCount } from '../../share/token'
import DraftsView from './drafts'

export default function MainFooter() {
  const { t } = useI18n()
  const editorRef = useRef<EditorHandle>(null)
  const [value, setValue] = useState('')
  const { chat, pendingMessages, isAtBottom, scrollToBottomRef } = useChatContext()
  const updateChat = useChat(state => state.updateChat)
  const saveDraftInProgress = useRef(false)
  const onTextChange = useCallback((text: string) => {
    setValue(text)
  }, [])
  const estimatedTokens = useMemo(() => estimateTokens(value), [value])
  // ─── workspace 文件智能提示 ─────────────────────────────────────────────────
  const [workspaceFileSuggestions, setWorkspaceFileSuggestions] = useState<AutocompleteSuggestion[]>([])

  useEffect(() => {
    if (!chat?.uid || !chat.workspace || chat.workspace.length === 0) {
      setWorkspaceFileSuggestions([])
      return
    }

    let cancelled = false
    trpcClient.workspace.queryFiles({
      chatUid: chat.uid,
      query: '',
      maxResults: 200,
      onlyFiles: false,
    }).then(({ items }) => {
      if (cancelled)
        return
      setWorkspaceFileSuggestions(
        items.map(f => ({
          id: f.path,
          label: f.label,
          description: f.relativePath,
          icon: f.type === 'directory'
            ? <Folder className="w-4 h-4" />
            : <FileText className="w-4 h-4" />,
          type: f.type,
          insertText: `#${f.relativePath} `,
        })),
      )
    }).catch(() => {
      if (!cancelled)
        setWorkspaceFileSuggestions([])
    })

    return () => {
      cancelled = true
    }
  }, [chat?.uid, chat?.workspace])

  // sources 用 useMemo 稳定引用，避免每次渲染都重新注册 listener
  const autocompleteConfig = useMemo(
    () => workspaceFileSuggestions.length > 0
      ? {
          sources: [{
            trigger: '#' as const,
            title: t('message.workspaceFiles'),
            suggestions: workspaceFileSuggestions,
          }],
        }
      : undefined,
    [workspaceFileSuggestions],
  )

  const handleProviderModelChange = useCallback(
    async ({ provider, model }: { provider: string, model: string }) => {
      if (!chat)
        return

      try {
        await trpcClient.chat.update({
          uid: chat.uid,
          provider,
          model,
        })
        updateChat(chat.uid, {
          provider,
          model,
        })
      }
      catch (error) {
        console.error('Failed to update provider/model:', error)
      }
    },
    [chat, updateChat],
  )

  const onSend = useCallback(() => {
    if (!chat || value.trim().length === 0)
      return

    command('chat.message', {
      chatId: chat.uid,
      content: value,
    })

    // 清空输入框
    editorRef.current?.clear({ focus: true })
  }, [chat, value])

  const onSaveDraft = useCallback(() => {
    // Ctrl+S 保存草稿：弹窗确认并保存为 pendingMessage
    if (!chat || value.trim().length === 0 || saveDraftInProgress.current) {
      return true
    }

    saveDraftInProgress.current = true

    toast(t('message.saveDraftPrompt'), {
      position: 'bottom-center',
      action: {
        label: t('common.save'),
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

            toast.success(t('message.draftSaved'))
          }
          catch (err) {
            console.error('Failed to save draft:', err)
            toast.error(t('message.draftError'))
          }
          finally {
            saveDraftInProgress.current = false
          }
        },
      },

      cancel: {
        label: t('common.cancel'),
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

  const onDraftDelete = useCallback(
    async (draft: PendingMessage) => {
      if (!chat)
        return

      const updatedMessages = pendingMessages.filter(m => m.id !== draft.id)

      await trpcClient.chat.updatePendingMessages({
        chatUid: chat.uid,
        pendingMessages: updatedMessages,
      })
    },
    [pendingMessages, chat],
  )

  const onDraftEdit = useCallback((draft: PendingMessage) => {
    editorRef.current?.setText(draft.content, { focus: true })
    onDraftDelete(draft)
  }, [])

  const onDraftSend = useCallback((draft: PendingMessage) => {
    if (!chat)
      return

    if (draft.content.trim().length === 0)
      return

    command('chat.message', {
      chatId: chat.uid,
      content: draft.content,
    })

    onDraftDelete(draft)
  }, [pendingMessages])

  return (
    <footer className="relative w-full mx-auto mt-auto h-(--app-chat-footer-height) transition-colors duration-300">
      <div className="max-w-3xl mx-auto">
        {/* 回到底部浮动按钮：当用户滚动到远离底部时出现 */}
        <AnimatePresence>
          {!isAtBottom && (
            <motion.div
              key="scroll-to-bottom"
              className="absolute -top-11 left-1/2 z-10 -translate-x-1/2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 shadow-md gap-1.5 text-xs"
                onClick={() => scrollToBottomRef.current?.()}
              >
                <ChevronsDown className="h-3.5 w-3.5" />
                {t('message.scrollToBottom')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="h-(--app-chat-input-header-height) px-2 flex items-center justify-between">
          <div className="mr-auto">
            <DraftsView onEdit={onDraftEdit} onSend={onDraftSend} onDelete={onDraftDelete} />
          </div>
          <div className="text-sm text-muted-foreground flex ml-auto items-center gap-2">
            <Coins className="w-4 h-4" />
            <span>{formatTokenCount(estimatedTokens)}</span>
            <SelectionToggle />
          </div>
        </div>
        <div className="h-(--app-chat-input-height) my-(--app-chat-input-gap) px-2">
          <Editor
            ref={editorRef}
            placeholder={t('message.inputPlaceholder')}
            ariaPlaceholder={t('message.inputPlaceholder')}
            rootClassName="min-h-(--app-chat-input-height)"
            wrapperClassName="h-(--app-chat-input-height)"
            onError={(err) => {
              console.error(`editor:`, err ? err.message : 'unknown error')
            }}
            onTextChange={onTextChange}
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
            autocomplete={autocompleteConfig}
          />
        </div>

        <div className="flex items-center h-(--app-chat-input-footer-height) px-2 gap-2">
          {/* <AgentSelector
            value={selectedAgent}
            onChange={setSelectedAgent}
            disabled={!chat}
          /> */}
          <ProviderModelSelector
            initialProvider={chat?.provider}
            initialModel={chat?.model}
            onSelectionChange={handleProviderModelChange}
          />
          <Button className="ml-auto" disabled={!chat || value.trim().length === 0} onClick={onSend}>
            <Send />
            Send
          </Button>
        </div>
      </div>
    </footer>
  )
}
