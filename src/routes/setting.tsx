import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Item, ItemContent, ItemTitle } from '@/components/ui/item'
import { Separator } from '@/components/ui/separator'
import { useI18n } from '@/i18n/provider'

export const Route = createFileRoute('/setting')({
  component: AppLayoutComponent,
})

function AppLayoutComponent() {
  const { t } = useI18n()

  const settingList = [
    {
      name: t('settings.nav.general'),
      path: '/setting/general',
    },
    {
      name: t('settings.nav.provider'),
      path: '/setting/provider',
    },
    {
      name: t('settings.nav.skills'),
      path: '/setting/skills',
    },
    {
      name: t('settings.nav.skillLogs'),
      path: '/setting/skill-logs',
    },
    {
      name: t('settings.nav.help'),
      path: '/setting/help',
    },
  ]

  return (
    <div className="w-full h-[calc(100vh - var(--app-header-height))] overflow-auto">
      <div className="w-full px-6 lg:px-8 py-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
        <span className="text-neutral-600 text-sm mt-2">
          {t('settings.desc')}
        </span>
        <Separator className="my-4" />
        <div className="flex w-full h-full gap-4">
          <ul className="w-48 space-y-2 shrink-0">
            {settingList.map(setting => (
              <li key={setting.path}>
                <Item asChild>
                  <Link
                    to={setting.path}
                    activeProps={{
                      className: 'bg-zinc-200! dark:bg-zinc-700!',
                    }}
                  >
                    <ItemContent>
                      <ItemTitle>{setting.name}</ItemTitle>
                    </ItemContent>
                  </Link>
                </Item>
              </li>
            ))}
          </ul>
          <div className="text-neutral-700 flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
