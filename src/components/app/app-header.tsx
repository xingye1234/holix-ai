import { usePlatform } from '@/hooks/platform'
import { ChatLayoutToggle, SidebarToggleButton } from '@/views/chat/header'
import { ModeToggle } from '../mode-toggle'
import { Separator } from '../ui/separator'
import WindowControls from '../window-controls'
import AppSearch from './app-search'
import AppSetting from './app-setting'

export default function AppHeader() {
  const { isMacOS } = usePlatform()
  return (
    <header className="h-(--app-header-height) flex justify-between items-center app-drag-region relative">
      <div className={`h-full flex items-center gap-1 ${isMacOS ? 'pl-28' : 'pl-2'}`}>
        <h1 className="font-bold px-2">Holix AI</h1>
        <div className="app-no-drag flex items-center gap-0.5">
          <SidebarToggleButton />
          <ChatLayoutToggle />
        </div>
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <AppSearch />
      </div>

      <div className="pr-4 flex items-center gap-4">
        <ModeToggle />
        <AppSetting />
        {!isMacOS && (
          <div className="h-4 w-px">
            <Separator orientation="vertical" className="w-px" />
          </div>
        )}
        <WindowControls />
      </div>
    </header>
  )
}
