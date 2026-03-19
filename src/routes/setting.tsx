import { createFileRoute, Link, Outlet, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
    <div className="w-full h-full overflow-hidden">
      <div className="w-full px-6 lg:px-8 py-6 max-w-6xl mx-auto h-full flex flex-col min-h-0">
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
              {t('settings.btn')}
            </Button>
          )}
        </div>
        <span className="text-neutral-600 text-sm">
          {t('settings.desc')}
        </span>
        <Separator className="my-4" />
        <div className="flex w-full flex-1 min-h-0 gap-4 relative">
          <ul className="w-48 space-y-2 shrink-0 self-start">
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
          <div
            className="text-neutral-700 flex-1 min-w-0 min-h-0 overflow-y-auto"
          >
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
