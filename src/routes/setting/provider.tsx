import type { AIProvider } from '@/types/provider'
import { createFileRoute } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  const [activeTab, setActiveTab] = useState(initialDefaultProvider || providers[0]?.name || '')
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

  const handleTabChange = useCallback(async (value: string) => {
    setActiveTab(value)
    try {
      await setDefaultProvider(value)
    }
    catch (error) {
      console.error('Failed to set default provider:', error)
    }
  }, [])

  const handleAddProvider = useCallback(async () => {
    try {
      const created = await addProvider(newProvider)
      setProviders(prev => [...prev, created])
      setIsDialogOpen(false)
      setActiveTab(created.name)
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
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mb-4 h-12! max-w-full overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50">
          {providers.map(provider => (
            <TabsTrigger key={provider.name} value={provider.name} className="h-8">
              <span className="mr-1.5">{provider.avatar}</span>
              {provider.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {providers.map(provider => (
          <TabsContent key={provider.name} value={provider.name}>
            <div className="max-w-2xl space-y-6">
              {/* 启用开关 */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label className="text-base">启用供应商</Label>
                  <p className="text-sm text-muted-foreground mt-1">启用后可以使用此供应商的模型</p>
                </div>
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={checked => handleToggle(provider.name, checked)}
                />
              </div>

              {/* API 配置 */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="baseUrl">Base URL</Label>
                  <Input
                    id="baseUrl"
                    type="url"
                    value={provider.baseUrl}
                    onChange={e => handleUpdateProvider(provider.name, 'baseUrl', e.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={provider.apiKey}
                    onChange={e => handleUpdateProvider(provider.name, 'apiKey', e.target.value)}
                    placeholder="输入您的 API Key"
                    className="mt-1.5"
                  />
                </div>

                <div>
                  <Label htmlFor="models">支持的模型</Label>
                  <Input
                    id="models"
                    value={provider.models.join(', ')}
                    onChange={e =>
                      handleUpdateProvider(
                        provider.name,
                        'models',
                        e.target.value
                          .split(/[,，/|\s]+/)
                          .map(m => m.trim())
                          .filter(Boolean),
                      )}
                    placeholder="model-1, model-2, model-3"
                    className="mt-1.5"
                  />
                  <p className="text-xs text-muted-foreground mt-1.5">多个模型可用逗号、空格、/、| 等分隔</p>
                </div>
              </div>
              <div className="pt-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="danger">删除供应商</Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-4">
                      <p>您确定要删除此供应商吗？此操作无法撤销。</p>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="danger"
                          onClick={async () => {
                            removeProvider(provider.name)
                              .then(async () => {
                                const remaining = providers.filter(p => p.name !== provider.name)
                                setProviders(remaining)

                                // 如果删除的是当前激活的供应商，切换到剩余的第一个
                                if (activeTab === provider.name && remaining.length > 0) {
                                  setActiveTab(remaining[0].name)
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
          </TabsContent>
        ))}
      </Tabs>

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
              <Input
                id="new-models"
                value={newProvider.models.join(', ')}
                onChange={e =>
                  setNewProvider({
                    ...newProvider,
                    models: e.target.value
                      .split(/[,，/|\s]+/)
                      .map(m => m.trim())
                      .filter(Boolean),
                  })}
                className="col-span-3"
                placeholder="gpt-4, gpt-3.5-turbo"
              />
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
