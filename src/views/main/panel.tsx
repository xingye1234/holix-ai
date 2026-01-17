import { Button } from '@/components/ui/button'
import { useSettingsPanel } from '@/context/settings-panel'

export default function ChatPanel() {
  const { close } = useSettingsPanel()
  return (
    <div className="w-80 border-l bg-background flex flex-col">
      <div className="h-(--app-header-height) border-b px-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">设置</h2>
        <Button
          className="text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => close()}
          title="关闭"
          variant="ghost"
        >
          ✕
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <p className="text-sm text-muted-foreground">设置面板内容</p>
        {/* TODO: 添加设置选项 */}
      </div>
    </div>
  )
}
