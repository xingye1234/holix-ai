import { useCallback, useState } from 'react'
import { Editor } from '@/components/editor/editor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

export interface PromptDialogProps {
  children: React.ReactNode
  defaultValue?: string
  onSave?: (value: string) => void
  onChange?: (value: string) => void
}

export default function PromptDialog({ children, defaultValue = '', onSave, onChange }: PromptDialogProps) {
  const [content, setContent] = useState(defaultValue)
  const [open, setOpen] = useState(false)

  const handleSave = useCallback(() => {
    onSave?.(content)
    setOpen(false)
  }, [content, onSave])

  const handleChange = useCallback((value: string) => {
    setContent(value)
    onChange?.(value)
    return true
  }, [onChange])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            value={content}
            onTextChange={handleChange}
            onError={(err) => {
              console.error(err)
            }}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button type="submit" onClick={handleSave}>保存更改</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
