import { NotepadTextDashed, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Item, ItemActions, ItemContent } from '@/components/ui/item'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useChatContext } from '@/context/chat'

export default function DraftsView() {
  const { pendingMessages } = useChatContext()
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <NotepadTextDashed />
          草稿 (
          {pendingMessages.length}
          )
        </Button>
      </PopoverTrigger>
      <PopoverContent asChild>
        <div className="w-80 space-y-2 max-h-100 overflow-y-auto">
          {pendingMessages.map((draft, index) => {
            return (
              <Item key={draft.id + index} variant="outline" size="sm">
                <ItemContent>
                  <p className="max-w-80 truncate text-sm text-stone-600">{draft.content}</p>
                </ItemContent>
                <ItemActions>
                  <Button variant="outline" size="sm">
                    <Send size={12} />
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
