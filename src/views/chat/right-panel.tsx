import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSettingsPanel } from '@/context/settings-panel'
import { cn } from '@/lib/utils'
import RightContextSettings from './right-context-settings'
import Prompts from './right-prompts'
import RightWorkspace from './right-workspace'

export default function ChatPanel() {
  return (
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: 420 }}
      exit={{ width: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('h-full w-105 border-l flex flex-col overflow-hidden')}
    >
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="context" className="h-full flex flex-col">
            <TabsList className="m-2 p-1 grid grid-cols-3 shrink-0">
              <TabsTrigger value="context">上下文</TabsTrigger>
              <TabsTrigger value="prompts">提示词</TabsTrigger>
              <TabsTrigger value="workspace">工作区</TabsTrigger>
            </TabsList>
            <TabsContent value="context" className="mt-0 px-2 pb-2 overflow-auto">
              <RightContextSettings />
            </TabsContent>
            <TabsContent value="prompts" className="mt-0 px-2 pb-2 overflow-auto">
              <Prompts />
            </TabsContent>
            <TabsContent value="workspace" className="mt-0 px-2 pb-2 overflow-auto">
              <RightWorkspace />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </motion.div>
  )
}
