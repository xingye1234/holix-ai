import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Item, ItemContent, ItemTitle } from '@/components/ui/item'
import { Separator } from '@/components/ui/separator'
import { useI18n } from '@/i18n/provider'
import { kyInstance } from '@/lib/ky'

export const Route = createFileRoute('/setting')({
  component: AppLayoutComponent,
})

function AppLayoutComponent() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)

  // 获取当前活跃的聊天ID
  useEffect(() => {
    kyInstance.get('config')
      .json<{ currentChatId?: string }>()
      .then((config) => {
        if (config.currentChatId) {
          setCurrentChatId(config.currentChatId)
        }
      })
      .catch(() => {
        // 忽略错误
      })
  }, [])

  const handleBackToChat = () => {
    if (currentChatId) {
      navigate({ to: '/chat/$id', params: { id: currentChatId } })
    }
    else {
      navigate({ to: '/' })
    }
  }

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
      name: t('settings.nav.mcp'),
      path: '/setting/mcp',
    },
    {
      name: t('settings.nav.help'),
      path: '/setting/help',
    },
  ]

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden">
      <div className="w-full px-6 lg:px-8 py-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-2">
          <h1 className="text-3xl font-bold">{t('settings.title')}</h1>
          {currentChatId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToChat}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              返回聊天
            </Button>
          )}
        </div>
        <span className="text-neutral-600 text-sm">
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
