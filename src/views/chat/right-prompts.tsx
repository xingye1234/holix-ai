import { Button } from '@/components/ui/button'
import PromptDialog from './prompt-dialog'

export default function Prompts() {
  return (
    <div className="p-4 h-full">
      <div>提示词设置面板</div>

      <PromptDialog>
        <Button variant="default" className="mt-4 w-full">
          添加提示词
        </Button>
      </PromptDialog>
    </div>
  )
}
