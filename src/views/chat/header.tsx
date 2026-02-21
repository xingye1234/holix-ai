import { useNavigate } from '@tanstack/react-router'
import { Plus, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import useChat from '@/store/chat'

export function AsideChatHeader() {
  const navigate = useNavigate()
  const [isSearching, setIsSearching] = useState(false)
  const searchQuery = useChat(state => state.searchQuery)
  const setSearchQuery = useChat(state => state.setSearchQuery)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isSearching && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isSearching])

  return (
    <header className="px-4 py-3 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-10 h-(--app-chat-header-height)">
      {isSearching
        ? (
            <div className="flex items-center w-full gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="搜索聊天..."
                  className="h-8 pl-8 pr-8 w-full bg-muted/50 border-transparent focus-visible:bg-background"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-8 w-8 hover:bg-transparent text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setSearchQuery('')
                      inputRef.current?.focus()
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  setIsSearching(false)
                  setSearchQuery('')
                }}
              >
                取消
              </Button>
            </div>
          )
        : (
            <>
              <h2 className="font-semibold text-sm tracking-tight">Chats</h2>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsSearching(true)}>
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span className="sr-only">Search chats</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate({ to: '/' })}>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  <span className="sr-only">New chat</span>
                </Button>
              </div>
            </>
          )}
    </header>
  )
}
