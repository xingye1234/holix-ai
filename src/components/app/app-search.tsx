import { useNavigate } from '@tanstack/react-router'
import { Monitor, Moon, Plus, SearchIcon, Settings, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { usePlatform } from '@/hooks/platform'
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

  const runCommand = (command: () => void) => {
    setOpen(false)
    command()
  }

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

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
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
        </CommandList>
      </CommandDialog>
    </>
  )
}
