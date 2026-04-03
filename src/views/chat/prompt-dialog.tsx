import { useCallback, useState } from 'react'
import { Editor } from '@/components/editor/editor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useI18n } from '@/i18n/provider'

export interface PromptDialogProps {
  children: React.ReactNode
  defaultValue?: string
  onSave?: (value: string) => void
  onChange?: (value: string) => void
}

export default function PromptDialog({ children, defaultValue = '', onSave, onChange }: PromptDialogProps) {
  const { t } = useI18n()
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
          <DialogTitle>{defaultValue ? t('prompt.dialog.editTitle') : t('prompt.dialog.addTitle')}</DialogTitle>
          <DialogDescription>{t('prompt.dialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="h-100">
          <Editor
            wrapperClassName="h-full"
            rootClassName="h-full"
            placeholder={t('prompt.inputPlaceholder')}
            value={content}
            onTextChange={handleChange}
            onError={(err) => {
              console.error(err)
            }}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('common.cancel')}</Button>
          </DialogClose>
          <Button type="submit" onClick={handleSave}>{t('prompt.dialog.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
