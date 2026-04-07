import { Package, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/provider'
import type { ExternalSkillSource, Skill } from '../types'
import { ImportExternalSkillsDialog } from './import-external-skills-dialog'
import { SkillCard } from './skill-card'

interface InstalledSkillsTabProps {
  skills: Skill[]
  builtinSkills: Skill[]
  userSkills: Skill[]
  disabledSkills: string[]
  externalSources: ExternalSkillSource[]
  importDialogOpen: boolean
  selectedExternalSource: string
  isImportingExternal: boolean
  onImportDialogOpenChange: (open: boolean) => void
  onSelectedExternalSourceChange: (value: string) => void
  onToggleSkillDisabled: (skillName: string, disabled: boolean) => void
  onImportExternalSkills: () => void | Promise<void>
}

function SkillSection({
  title,
  skills,
  disabledSkills,
  onToggleSkillDisabled,
}: {
  title: string
  skills: Skill[]
  disabledSkills: string[]
  onToggleSkillDisabled: (skillName: string, disabled: boolean) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <h2 className="px-4 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4">
        {skills.map(skill => (
          <SkillCard
            key={skill.name}
            skill={skill}
            disabled={disabledSkills.includes(skill.name)}
            onToggleDisabled={onToggleSkillDisabled}
          />
        ))}
      </div>
    </div>
  )
}

export function InstalledSkillsTab({
  skills,
  builtinSkills,
  userSkills,
  disabledSkills,
  externalSources,
  importDialogOpen,
  selectedExternalSource,
  isImportingExternal,
  onImportDialogOpenChange,
  onSelectedExternalSourceChange,
  onToggleSkillDisabled,
  onImportExternalSkills,
}: InstalledSkillsTabProps) {
  const { t } = useI18n()

  return (
    <div className="mt-6 space-y-6">
      <div className="flex justify-end">
        <ImportExternalSkillsDialog
          open={importDialogOpen}
          onOpenChange={onImportDialogOpenChange}
          sources={externalSources}
          selectedSource={selectedExternalSource}
          onSelectedSourceChange={onSelectedExternalSourceChange}
          isImporting={isImportingExternal}
          onImport={onImportExternalSkills}
        />
      </div>

      {skills.length === 0
        ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-24 text-muted-foreground">
              <Package className="size-16 opacity-20" />
              <div className="text-center">
                <p className="text-base font-medium">{t('settings.skills.empty')}</p>
                <p className="mt-1 text-sm">前往商店安装 Skills</p>
              </div>
              <Button variant="outline" onClick={() => {}} className="gap-2">
                <Sparkles className="h-4 w-4" />
                浏览商店
              </Button>
            </div>
          )
        : (
            <div className="space-y-8">
              {builtinSkills.length > 0 && (
                <SkillSection
                  title={t('settings.skills.builtin')}
                  skills={builtinSkills}
                  disabledSkills={disabledSkills}
                  onToggleSkillDisabled={onToggleSkillDisabled}
                />
              )}

              {userSkills.length > 0 && (
                <SkillSection
                  title={t('settings.skills.user')}
                  skills={userSkills}
                  disabledSkills={disabledSkills}
                  onToggleSkillDisabled={onToggleSkillDisabled}
                />
              )}
            </div>
          )}
    </div>
  )
}
