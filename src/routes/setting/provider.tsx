import type { AIProvider } from '@/types/provider'
import { createFileRoute } from '@tanstack/react-router'
import { Plus, Star } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { TagInput } from '@/components/ui/tag-input'
import {
  addProvider,
  getDefaultProvider,
  getProviders,
  removeProvider,
  setDefaultProvider,
  updateProvider,
} from '@/lib/provider'

export const Route = createFileRoute('/setting/provider')({
  component: RouteComponent,
  loader: async () => {
    const [providers, defaultProvider] = await Promise.all([getProviders(), getDefaultProvider()])
    return { providers, defaultProvider }
  },
})

function RouteComponent() {
  const { providers: initialProviders, defaultProvider: initialDefaultProvider } = Route.useLoaderData()
  const [providers, setProviders] = useState<AIProvider[]>(initialProviders)
  const [defaultProviderState, setDefaultProviderState] = useState(initialDefaultProvider || providers[0]?.name || '')
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newProvider, setNewProvider] = useState<AIProvider>({
    name: '',
    baseUrl: '',
    apiKey: '',
    models: [],
    enabled: false,
    avatar: '🤖',
  })

  const handleUpdateProvider = useCallback(async (name: string, field: keyof AIProvider, value: any) => {
    try {
      const updated = await updateProvider(name, { [field]: value })
      setProviders(prev => prev.map(p => (p.name === name ? updated : p)))
    }
    catch (error) {
      console.error('Failed to update provider:', error)
    }
  }, [])

  const handleToggle = useCallback(async (name: string, enabled: boolean) => {
    try {
      const updated = await updateProvider(name, { enabled })
      setProviders(prev => prev.map(p => (p.name === name ? updated : p)))
    }
    catch (error) {
      console.error('Failed to toggle provider:', error)
    }
  }, [])

  const handleSetDefault = useCallback(async (name: string) => {
    try {
      await setDefaultProvider(name)
      setDefaultProviderState(name)
      toast.success('已设为默认供应商')
    }
    catch (error) {
      console.error('Failed to set default provider:', error)
      toast.error('设置默认供应商失败')
    }
  }, [])

  const handleAddProvider = useCallback(async () => {
    try {
      const created = await addProvider(newProvider)
      setProviders(prev => [...prev, created])
      setIsDialogOpen(false)
      setDefaultProviderState(created.name)
      await setDefaultProvider(created.name)
      setNewProvider({
        name: '',
        baseUrl: '',
        apiKey: '',
        models: [],
        enabled: false,
        avatar: '🤖',
      })

      toast.success('供应商添加成功')
    }
    catch (error) {
      console.error('Failed to add provider:', error)
      toast.error(`添加失败：${(error as Error).message}`)
    }
  }, [newProvider])

  if (providers.length === 0) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">暂无可用的 AI 供应商</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI 供应商配置</h1>
          <p className="text-muted-foreground mt-1">配置和管理您的 AI 模型供应商</p>
        </div>
        <Button size="sm" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-1.5" size={16} />
          新增
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {[...providers].sort((a, b) => {
          if (a.enabled !== b.enabled)
            return a.enabled ? -1 : 1
          if (a.name === defaultProviderState)
            return -1
          if (b.name === defaultProviderState)
            return 1
          return 0
        }).map(provider => (
          <div key={provider.name} className="flex flex-col rounded-xl border bg-card text-card-foreground shadow-sm">
            <div className="flex flex-row items-center justify-between p-6 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{provider.avatar}</span>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold leading-none tracking-tight">{provider.name}</h3>
                    {defaultProviderState === provider.name && (
                      <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">默认</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {defaultProviderState !== provider.name && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleSetDefault(provider.name)}
                    title="设为默认"
                  >
                    <Star size={16} />
                  </Button>
                )}
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={checked => handleToggle(provider.name, checked)}
                />
              </div>
            </div>
            <div className="p-6 pt-0 space-y-4 flex-1">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`baseUrl-${provider.name}`}>Base URL</Label>
                  <Input
                    id={`baseUrl-${provider.name}`}
                    type="url"
                    value={provider.baseUrl}
                    onChange={e => handleUpdateProvider(provider.name, 'baseUrl', e.target.value)}
                    placeholder="https://api.example.com/v1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`apiKey-${provider.name}`}>API Key</Label>
                  <Input
                    id={`apiKey-${provider.name}`}
                    type="password"
                    value={provider.apiKey}
                    onChange={e => handleUpdateProvider(provider.name, 'apiKey', e.target.value)}
                    placeholder="输入您的 API Key"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`models-${provider.name}`}>支持的模型</Label>
                  <TagInput
                    value={provider.models}
                    onChange={models => handleUpdateProvider(provider.name, 'models', models)}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center p-6 pt-0 mt-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="destructive" size="sm" className="w-full">删除供应商</Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <p className="text-sm">您确定要删除此供应商吗？此操作无法撤销。</p>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={async () => {
                          removeProvider(provider.name)
                            .then(async () => {
                              const remaining = providers.filter(p => p.name !== provider.name)
                              setProviders(remaining)

                              if (defaultProviderState === provider.name && remaining.length > 0) {
                                setDefaultProviderState(remaining[0].name)
                                await setDefaultProvider(remaining[0].name)
                              }

                              toast.success('供应商删除成功')
                            })
                            .catch((error) => {
                              console.error('Failed to delete provider:', error)
                              toast.error(`删除失败：${(error as Error).message}`)
                            })
                        }}
                      >
                        确认删除
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        ))}
      </div>

      {/* 新增供应商弹窗 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加新供应商</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-name" className="text-right">
                名称
              </Label>
              <Input
                id="new-name"
                value={newProvider.name}
                onChange={e => setNewProvider({ ...newProvider, name: e.target.value })}
                className="col-span-3"
                placeholder="OpenAI"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-avatar" className="text-right">
                头像
              </Label>
              <Input
                id="new-avatar"
                value={newProvider.avatar}
                onChange={e => setNewProvider({ ...newProvider, avatar: e.target.value })}
                className="col-span-3"
                placeholder="🤖"
                maxLength={2}
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-baseUrl" className="text-right">
                Base URL
              </Label>
              <Input
                id="new-baseUrl"
                value={newProvider.baseUrl}
                onChange={e => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
                className="col-span-3"
                placeholder="https://api.example.com/v1"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-apiKey" className="text-right">
                API Key
              </Label>
              <Input
                id="new-apiKey"
                type="password"
                value={newProvider.apiKey}
                onChange={e => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                className="col-span-3"
                placeholder="sk-xxxxx"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-models" className="text-right">
                模型列表
              </Label>
              <div className="col-span-3">
                <TagInput
                  value={newProvider.models}
                  onChange={models => setNewProvider({ ...newProvider, models })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddProvider} disabled={!newProvider.name || !newProvider.baseUrl}>
              添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
