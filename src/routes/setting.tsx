import { createFileRoute, Link, Outlet } from '@tanstack/react-router'
import { Item, ItemContent, ItemTitle } from '@/components/ui/item'
import { Separator } from '@/components/ui/separator'

export const Route = createFileRoute('/setting')({
  component: AppLayoutComponent,
})

const settingList = [
  {
    name: '常规设置',
    path: '/setting/general',
  },
  {
    name: '供应商设置',
    path: '/setting/provider',
  },
]

function AppLayoutComponent() {
  return (
    <div className="w-full h-[calc(100vh - var(--app-header-height))] overflow-auto">
      <div className="w-full px-6 lg:px-8 py-6 max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold">Setting</h1>
        <span className="text-neutral-600 text-sm mt-2">
          Manage your application settings here. Select a category from the
          sidebar to get started.
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
