import { Package, Sparkles } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '@/i18n/provider'
import { updateConfig } from '@/lib/config'
import { trpcClient } from '@/lib/trpc-client'
import { InstalledSkillsTab } from './components/installed-skills-tab'
import { StoreSkillsTab } from './components/store-skills-tab'
import type { ConfigData, ExternalSkillSource, Skill, StoreSkillItem } from './types'

interface SkillsPageProps {
  skills: Skill[]
  externalSources: ExternalSkillSource[]
  config: ConfigData
}

export function SkillsPage({
  skills,
  externalSources,
  config,
}: SkillsPageProps) {
  const { t } = useI18n()
  const [skillsState, setSkillsState] = useState(skills)
  const [externalSourcesState, setExternalSourcesState] = useState(externalSources)
  const [disabledSkills, setDisabledSkills] = useState<string[]>(config.disabledSkills ?? [])
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [selectedExternalSource, setSelectedExternalSource] = useState(externalSources[0]?.path ?? '')
  const [isImportingExternal, setIsImportingExternal] = useState(false)

  const builtinSkills = skillsState.filter(skill => skill.isBuiltin)
  const userSkills = skillsState.filter(skill => !skill.isBuiltin)

  const refreshSkills = useCallback(async () => {
    const [nextSkills, nextExternalSources] = await Promise.all([
      trpcClient.skill.list(),
      trpcClient.skill.externalSources(),
    ])

    setSkillsState(nextSkills)
    setExternalSourcesState(nextExternalSources)
    setSelectedExternalSource((current) => {
      if (current && nextExternalSources.some(source => source.path === current))
        return current
      return nextExternalSources[0]?.path ?? ''
    })
  }, [])

  const handleToggleSkillDisabled = useCallback(async (skillName: string, disabled: boolean) => {
    const next = disabled
      ? Array.from(new Set([...disabledSkills, skillName]))
      : disabledSkills.filter(name => name !== skillName)

    setDisabledSkills(next)
    await updateConfig('disabledSkills', next)
    toast.success(disabled ? `已禁用 ${skillName}` : `已启用 ${skillName}`)
  }, [disabledSkills])

  const handleImportExternalSkills = useCallback(async () => {
    if (!selectedExternalSource) {
      toast.error(t('skillsPage.importExternal.selectRequired'))
      return
    }

    setIsImportingExternal(true)
    try {
      const result = await trpcClient.skill.importFromExternal({ sourcePath: selectedExternalSource })
      await refreshSkills()
      setImportDialogOpen(false)
      toast.success(t('skillsPage.importExternal.imported', { count: result.installed.length }))
    }
    catch (error) {
      toast.error(error instanceof Error ? error.message : t('skillsPage.importExternal.importFailed'))
    }
    finally {
      setIsImportingExternal(false)
    }
  }, [refreshSkills, selectedExternalSource, t])

  const storeSkills: StoreSkillItem[] = [
    {
      id: 'writing-assistant',
      name: t('skillsPage.store.items.writing.name'),
      desc: t('skillsPage.store.items.writing.desc'),
      category: t('skillsPage.store.items.writing.category'),
    },
    {
      id: 'data-analyst',
      name: t('skillsPage.store.items.data.name'),
      desc: t('skillsPage.store.items.data.desc'),
      category: t('skillsPage.store.items.data.category'),
    },
    {
      id: 'frontend-helper',
      name: t('skillsPage.store.items.frontend.name'),
      desc: t('skillsPage.store.items.frontend.desc'),
      category: t('skillsPage.store.items.frontend.category'),
    },
  ]

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto max-w-6xl p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{t('skillsPage.title')}</h1>
          <p className="mt-2 text-muted-foreground">{t('skillsPage.description')}</p>
        </div>

        <Tabs defaultValue="installed" className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="installed" className="gap-2">
              <Package className="h-4 w-4" />
              {t('skillsPage.tabs.installed')}
              {skillsState.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {skillsState.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="store" className="gap-2">
              <Sparkles className="h-4 w-4" />
              {t('skillsPage.tabs.store')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="installed">
            <InstalledSkillsTab
              skills={skillsState}
              builtinSkills={builtinSkills}
              userSkills={userSkills}
              disabledSkills={disabledSkills}
              externalSources={externalSourcesState}
              importDialogOpen={importDialogOpen}
              selectedExternalSource={selectedExternalSource}
              isImportingExternal={isImportingExternal}
              onImportDialogOpenChange={setImportDialogOpen}
              onSelectedExternalSourceChange={setSelectedExternalSource}
              onToggleSkillDisabled={handleToggleSkillDisabled}
              onImportExternalSkills={handleImportExternalSkills}
            />
          </TabsContent>

          <TabsContent value="store">
            <StoreSkillsTab skills={storeSkills} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
