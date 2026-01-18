import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSettingsPanel } from '@/context/settings-panel'
import { cn } from '@/lib/utils'
import Prompts from './right-prompts'
import RightWorkspace from './right-workspace'

export default function ChatPanel() {
  const { close } = useSettingsPanel()
  return (
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: 350 }}
      exit={{ width: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('h-full w-100 border-l bg-background flex flex-col overflow-hidden')}
    >
      <div className="w-100">
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
        <div className="flex-1 overflow-auto h-[calc(100vh-var(--app-header-height)-var(--app-header-height))]">
          <Tabs defaultValue="prompts" className="w-full p-2 h-full">
            <TabsList className="p-1 w-full">
              <TabsTrigger value="prompts">提示词</TabsTrigger>
              <TabsTrigger value="workspace">工作区</TabsTrigger>
            </TabsList>
            <TabsContent value="prompts">
              <Prompts />
            </TabsContent>
            <TabsContent value="workspace">
              <RightWorkspace />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </motion.div>
  )
}
