import type { Message } from '@/node/database/schema/chat'
import { useNavigate } from '@tanstack/react-router'
import { MessageSquare, Monitor, Moon, Plus, SearchIcon, Settings, Sun } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlatform } from '@/hooks/platform'
import logger from '@/lib/logger'
import { trpcClient } from '@/lib/trpc-client'
import { useTheme } from '../theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../ui/command'

export default function AppSearch() {
  const [open, setOpen] = useState(false)
  const { isMacOS } = usePlatform()
  const { setTheme } = useTheme()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const [searchResults, setSearchResults] = useState<Array<{ rank: number, message: Message }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(open => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    try {
      const results = await trpcClient.message.searchBm25({ keyword: query, limit: 10 })

      logger.info('Search results:', results)

      setSearchResults(results as Array<{ rank: number, message: Message }>)
    }
    catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    }
    finally {
      setIsSearching(false)
    }
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
  }

  const handleCompositionStart = () => {
    setIsComposing(true)
  }

  const handleCompositionEnd = () => {
    setIsComposing(false)
  }

  useEffect(() => {
    if (isComposing)
      return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(searchQuery)
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery, isComposing, performSearch])

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

  const handleSelectMessage = (chatUid: string) => {
    runCommand(() => navigate({ to: `/chat/$id`, params: { id: chatUid } }))
  }

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setSearchResults([])
    }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="app-no-drag group flex items-center gap-2 rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring w-64 max-w-full"
      >
        <SearchIcon className="size-4" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">{isMacOS ? '⌘' : 'Ctrl'}</span>
          K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} commandProps={{ shouldFilter: false }}>
        <CommandInput
          placeholder="Type a command or search messages..."
          value={searchQuery}
          onValueChange={handleSearchChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />
        <CommandList>
          <CommandEmpty>{isSearching ? 'Searching...' : 'No results found.'}</CommandEmpty>

          {searchResults.length > 0 && (
            <CommandGroup heading="Messages">
              {searchResults.map(({ message: msg }) => (
                <CommandItem
                  key={msg.uid}
                  value={`msg-${msg.uid}-${msg.content}`}
                  onSelect={() => handleSelectMessage(msg.chatUid)}
                >
                  <MessageSquare className="mr-2 size-4 shrink-0" />
                  <span className="truncate">{msg.content}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searchQuery.trim() === '' && (
            <>
              <CommandGroup heading="Actions">
                <CommandItem onSelect={() => runCommand(() => navigate({ to: '/' }))}>
                  <Plus className="mr-2 size-4" />
                  <span>New Chat</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => navigate({ to: '/setting' }))}>
                  <Settings className="mr-2 size-4" />
                  <span>Settings</span>
                  <CommandShortcut>
                    {isMacOS ? '⌘' : 'Ctrl'}
                    ,
                  </CommandShortcut>
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Theme">
                <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
                  <Sun className="mr-2 size-4" />
                  <span>Light Theme</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
                  <Moon className="mr-2 size-4" />
                  <span>Dark Theme</span>
                </CommandItem>
                <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
                  <Monitor className="mr-2 size-4" />
                  <span>System Theme</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
