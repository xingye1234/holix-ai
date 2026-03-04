/**
 * ToolApprovalModal
 *
 * 全局弹窗：当高风险 skill 的工具被 AI 请求调用时展示，
 * 让用户查看调用参数后决定批准或拒绝。
 */

import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToolApprovalStore } from '@/store/tool-approval'

export function ToolApprovalModal() {
  const { pendingRequest, approve, deny } = useToolApprovalStore()

  const handleApprove = useCallback(() => {
    approve()
  }, [approve])

  const handleDeny = useCallback(() => {
    deny()
  }, [deny])

  if (!pendingRequest)
    return null

  const argsStr = Object.keys(pendingRequest.args).length > 0
    ? JSON.stringify(pendingRequest.args, null, 2)
    : null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) deny() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            高风险操作需要确认
          </DialogTitle>
          <DialogDescription>
            AI 正在请求执行以下操作，请确认是否允许。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Skill + 工具信息 */}
          <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-muted-foreground">Skill:</span>
              <span className="font-medium font-mono">{pendingRequest.skillName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground ml-6">工具:</span>
              <span className="font-medium font-mono">{pendingRequest.toolName}</span>
            </div>
            {pendingRequest.description && (
              <p className="text-xs text-muted-foreground ml-6 leading-relaxed">
                {pendingRequest.description}
              </p>
            )}
          </div>

          {/* 调用参数 */}
          {argsStr && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                调用参数
              </p>
              <pre className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-all max-h-40 text-foreground">
                {argsStr}
              </pre>
            </div>
          )}

          {/* 警告提示 */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              此操作来自标记为高风险的 Skill，可能对您的文件系统或系统配置产生不可逆的影响。
              请仔细核对参数后再决定。
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleDeny}
            className="text-muted-foreground"
          >
            拒绝
          </Button>
          <Button
            variant="destructive"
            onClick={handleApprove}
          >
            批准执行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
