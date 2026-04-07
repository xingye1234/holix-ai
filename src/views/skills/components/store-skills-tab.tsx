import { Download, Sparkles, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/provider'
import type { StoreSkillItem } from '../types'

interface StoreSkillsTabProps {
  skills: StoreSkillItem[]
}

export function StoreSkillsTab({ skills }: StoreSkillsTabProps) {
  const { t } = useI18n()

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border bg-gradient-to-br from-primary/10 via-background to-background p-8">
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-primary p-2.5">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold">{t('skillsPage.store.title')}</h2>
        </div>
        <p className="max-w-2xl text-muted-foreground">{t('skillsPage.store.description')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {skills.map(skill => (
          <article key={skill.id} className="group flex flex-col gap-4 rounded-xl border bg-card p-5 transition-all duration-300 hover:border-primary/50 hover:shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <div className="rounded-md bg-primary/10 p-1.5">
                    <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  </div>
                  <Badge variant="secondary" className="text-xs">{skill.category}</Badge>
                </div>
                <h3 className="text-base font-semibold transition-colors group-hover:text-primary">{skill.name}</h3>
              </div>
            </div>
            <p className="flex-1 text-sm leading-6 text-muted-foreground">{skill.desc}</p>
            <div className="flex items-center justify-between border-t pt-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(index => (
                  <Star
                    key={index}
                    className={`h-3.5 w-3.5 ${index <= 4 ? 'fill-amber-500 text-amber-500' : 'text-gray-300'}`}
                  />
                ))}
                <span className="ml-1.5 text-xs text-muted-foreground">4.8</span>
              </div>
              <Button size="sm" className="gap-1.5 shadow-sm">
                <Download className="h-3.5 w-3.5" />
                {t('skillsPage.store.install')}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
