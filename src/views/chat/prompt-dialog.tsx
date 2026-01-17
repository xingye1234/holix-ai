import { Editor } from '@/components/editor/editor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export interface PromptDialogProps {
  children: React.ReactNode
}

export default function PromptDialog({ children }: PromptDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="lg:max-w-200">
        <DialogHeader>
          <DialogTitle>添加提示词</DialogTitle>
          <DialogDescription>添加你的提示词内容</DialogDescription>
        </DialogHeader>
        <div className="h-100">
          <Editor
            wrapperClassName="h-full"
            rootClassName="h-full"
            placeholder="在此输入提示词内容..."
            onError={(err) => {
              console.error(err)
            }}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button type="submit">保存更改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
