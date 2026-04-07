import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/i18n/provider'
import type { ExternalSkillSource } from '../types'

interface ImportExternalSkillsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sources: ExternalSkillSource[]
  selectedSource: string
  onSelectedSourceChange: (value: string) => void
  isImporting: boolean
  onImport: () => void | Promise<void>
}

export function ImportExternalSkillsDialog({
  open,
  onOpenChange,
  sources,
  selectedSource,
  onSelectedSourceChange,
  isImporting,
  onImport,
}: ImportExternalSkillsDialogProps) {
  const { t } = useI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          {t('skillsPage.importExternal.open')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('skillsPage.importExternal.title')}</DialogTitle>
          <DialogDescription>{t('skillsPage.importExternal.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('skillsPage.importExternal.sourceLabel')}</Label>
            <Select value={selectedSource} onValueChange={onSelectedSourceChange}>
              <SelectTrigger>
                <SelectValue placeholder={t('skillsPage.importExternal.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {sources.map(source => (
                  <SelectItem key={source.path} value={source.path}>
                    {source.label}
                    {' '}
                    (
                    {source.skillCount}
                    )
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {sources.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('skillsPage.importExternal.empty')}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('skillsPage.importExternal.cancel')}
            </Button>
            <Button
              onClick={() => onImport()}
              disabled={isImporting || sources.length === 0}
            >
              {isImporting ? t('skillsPage.importExternal.importing') : t('skillsPage.importExternal.confirm')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
