import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search, SquarePen, Wrench, X } from 'lucide-react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import useChat from '@/store/chat'

function MenuItem(props: { icon: ReactNode, label: string, onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      className="h-9 w-full justify-start gap-2 rounded-md px-2 text-sm font-normal text-foreground/90 hover:bg-muted"
      onClick={props.onClick}
    >
      <span className="text-muted-foreground">{props.icon}</span>
      <span>{props.label}</span>
    </Button>
  )
}

export function AsideChatHeader() {
  const navigate = useNavigate()
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
        <MenuItem icon={<SquarePen className="h-4 w-4" />} label="新聊天" onClick={() => navigate({ to: '/' })} />
        <MenuItem icon={<Wrench className="h-4 w-4" />} label="技能" onClick={() => navigate({ to: '/skill-store' })} />
      </div>
    </header>
  )
}
