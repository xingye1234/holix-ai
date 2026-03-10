import { Link } from '@tanstack/react-router'
import { Search, SquarePen, Wrench, X } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import useChat from '@/store/chat'

export function AsideChatHeader() {
  const searchQuery = useChat(state => state.searchQuery)
  const setSearchQuery = useChat(state => state.setSearchQuery)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="px-3 py-3 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10 space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜索聊天..."
          className="h-9 pl-8 pr-8 w-full bg-muted/50 border-transparent focus-visible:bg-background"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-9 w-9 hover:bg-transparent text-muted-foreground hover:text-foreground"
            onClick={() => {
              setSearchQuery('')
              inputRef.current?.focus()
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-0.5">
        <Link
          to="/"
          className="h-9 w-full flex items-center justify-start gap-2 rounded-md px-2 text-sm font-normal text-foreground/90 hover:bg-muted hover:text-foreground"
          activeProps={{
            className: 'bg-accent text-accent-foreground',
          }}
        >
          <SquarePen className="h-4 w-4 text-muted-foreground" />
          <span>新聊天</span>
        </Link>
        <Link
          to="/skill-store"
          className="h-9 w-full flex items-center justify-start gap-2 rounded-md px-2 text-sm font-normal text-foreground/90 hover:bg-muted hover:text-foreground"
          activeProps={{
            className: 'bg-accent text-accent-foreground',
          }}
        >
          <Wrench className="h-4 w-4 text-muted-foreground" />
          <span>技能</span>
        </Link>
      </div>
    </header>
  )
}
