import { useNavigate } from '@tanstack/react-router'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function AsideChatHeader() {
  const navigate = useNavigate()

  return (
    <header className="px-4 py-3 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10 h-(--app-chat-header-height)">
      <h2 className="font-semibold text-sm tracking-tight">Chats</h2>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">Search chats</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate({ to: '/' })}>
          <Plus className="h-4 w-4 text-muted-foreground" />
          <span className="sr-only">New chat</span>
        </Button>
      </div>
    </header>
  )
}
