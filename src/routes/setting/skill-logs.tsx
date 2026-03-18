import { createFileRoute } from '@tanstack/react-router'
import { Clock3, RefreshCw, ShieldX, Wrench } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { trpcClient } from '@/lib/trpc-client'

export const Route = createFileRoute('/setting/skill-logs')({
  component: RouteComponent,
  loader: async () => {
    const logs = await trpcClient.skill.invocationLogs({ limit: 500 })
    return { logs }
  },
})

function formatTime(ts: number) {
  return new Date(ts).toLocaleString()
}

function RouteComponent() {
  const loaderData = Route.useLoaderData()
  const [logs, setLogs] = useState(loaderData.logs)
  const [refreshing, setRefreshing] = useState(false)

  const stats = useMemo(() => {
    const rejectedCount = logs.filter(log => log.rejected).length
    return {
      total: logs.length,
      rejectedCount,
    }
  }, [logs])

  async function reload() {
    setRefreshing(true)
    try {
      const next = await trpcClient.skill.invocationLogs({ limit: 500 })
      setLogs(next)
    }
    finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Skill 执行记录</h1>
          <p className="text-sm text-muted-foreground mt-1">按执行时间倒序展示，最新记录在最上方。</p>
        </div>
        <Button variant="outline" size="sm" onClick={reload} disabled={refreshing}>
          <RefreshCw className={`size-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">
          总数:
          {stats.total}
        </Badge>
        <Badge variant="outline">
          拒绝:
          {stats.rejectedCount}
        </Badge>
      </div>

      <div className="h-[70vh] min-h-[420px] rounded-lg border bg-card">
        <Virtuoso
          data={logs}
          itemContent={(_, log) => (
            <div className="border-b px-4 py-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="font-mono">{log.skillName}</Badge>
                <Badge variant="outline" className="font-mono">
                  <Wrench className="size-3 mr-1" />
                  {log.toolName}
                </Badge>
                {log.rejected && (
                  <Badge variant="destructive">
                    <ShieldX className="size-3 mr-1" />
                    已拒绝
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground inline-flex items-center">
                  <Clock3 className="size-3 mr-1" />
                  {formatTime(log.createdAt)}
                </span>
              </div>

              {log.args && (
                <pre className="text-xs rounded-md bg-muted/40 p-2 overflow-auto">
                  {JSON.stringify(log.args, null, 2)}
                </pre>
              )}

              {log.result && (
                <pre className="text-xs rounded-md bg-muted/40 p-2 overflow-auto max-h-40">{log.result}</pre>
              )}

              {log.error && (
                <p className="text-xs text-destructive">
                  Error:
                  {log.error}
                </p>
              )}
            </div>
          )}
        />
      </div>
    </div>
  )
}
