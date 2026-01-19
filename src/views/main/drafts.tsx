import type { PendingMessage } from '@/node/database/schema/chat'
import { Delete, NotepadTextDashed, Send } from 'lucide-react'
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Item, ItemActions, ItemContent } from '@/components/ui/item'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useChatContext } from '@/context/chat'
import { trpcClient } from '@/lib/trpc-client'

export default function DraftsView({
  onEdit,
  onSend,
  onDelete,
}: {
  onEdit?: (draft: PendingMessage) => void
  onSend?: (draft: PendingMessage) => void
  onDelete?: (draft: PendingMessage) => void
}) {
  const { pendingMessages } = useChatContext()

  return pendingMessages.length === 0
    ? null
    : (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <NotepadTextDashed />
              草稿 (
              {pendingMessages.length}
              )
            </Button>
          </PopoverTrigger>
          <PopoverContent asChild side="top">
            <div className="w-80 space-y-2 max-h-100 overflow-y-auto">
              {pendingMessages.map((draft) => {
                return (
                  <Item
                    key={draft.id}
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      onEdit?.(draft)
                    }}
                  >
                    <ItemContent>
                      <p className="max-w-80 truncate text-sm text-stone-600">{draft.content}</p>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          onSend?.(draft)
                        }}
                      >
                        <Send size={12} />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          onDelete?.(draft)
                        }}
                      >
                        <Delete size={12} />
                      </Button>
                    </ItemActions>
                  </Item>
                )
              })}
            </div>
          </PopoverContent>
        </Popover>
      )
}
