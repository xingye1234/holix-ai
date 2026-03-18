import type { AutocompleteSuggestion } from '@/components/editor/plugins/autocomplete'
import type { EditorHandle } from '@/components/editor/props'
import type { PendingMessage } from '@/node/database/schema/chat'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronsDown, Coins, FileText, Folder, Send, Settings } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Editor } from '@/components/editor/editor'
import { SelectionToggle } from '@/components/message-selection'
import ProviderModelSelector from '@/components/provider-model-selector'
import { Button } from '@/components/ui/button'
import { useChatContext } from '@/context/chat'
import { useSettingsPanel } from '@/context/settings-panel'
import { command } from '@/lib/command'
import { trpcClient } from '@/lib/trpc-client'
import { estimateTokens, formatTokenCount } from '../../share/token'
import DraftsView from './drafts'

export default function MainFooter() {
  const editorRef = useRef<EditorHandle>(null)
  const [value, setValue] = useState('')
  const { chat, pendingMessages, isAtBottom, scrollToBottomRef } = useChatContext()
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
            title: '工作区文件',
            suggestions: workspaceFileSuggestions,
          }],
        }
      : undefined,
    [workspaceFileSuggestions],
  )

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

    // 清空输入框
    editorRef.current?.clear({ focus: true })
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
    <footer className="relative w-full mt-auto h-(--app-chat-footer-height) border-t transition-colors duration-300" style={{ backgroundColor: 'var(--region-input)', borderColor: 'var(--border)' }}>
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
              回到底部
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="h-(--app-chat-input-header-height) border-b px-2 flex items-center justify-between">
        <div className="mr-auto">
          <DraftsView onEdit={onDraftEdit} onSend={onDraftSend} onDelete={onDraftDelete} />
        </div>
        <div className="text-sm text-muted-foreground flex ml-auto items-center gap-2">
          <Coins className="w-4 h-4" />
          <span>{formatTokenCount(estimatedTokens)}</span>
          <SelectionToggle />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={toggleSettingsPanel} title="设置">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div className="h-(--app-chat-input-height) my-(--app-chat-input-gap) px-2">
        <Editor
          ref={editorRef}
          placeholder="请输入问题"
          ariaPlaceholder="请输入问题"
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

      <div className="flex items-center h-(--app-chat-input-footer-height) px-2">
        <div>
          <ProviderModelSelector
            initialProvider={chat?.provider}
            initialModel={chat?.model}
            onProviderChange={handleProviderChange}
            onModelChange={handleModelChange}
          />
        </div>
        <Button className="ml-auto" disabled={!chat || value.trim().length === 0} onClick={onSend}>
          <Send />
          Send
        </Button>
      </div>
    </footer>
  )
}
