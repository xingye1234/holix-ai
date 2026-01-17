import type { Workspace } from '@/node/database/schema/chat'
import { File, Folder, Pen, Trash } from 'lucide-react'
import { useCallback, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { useChatContext } from '@/context/chat'
import { setTRPCOptions, trpcClient } from '@/lib/trpc-client'

export default function RightWorkspace() {
  const { chat } = useChatContext()

  // 设置全局超时时间
  useEffect(() => {
    setTRPCOptions({ timeout: 60000 * 30 }) // 10分钟超时
    return () => {
      setTRPCOptions({ timeout: 15000 }) // 恢复默认15秒超时
    }
  }, [])

  const workspace = useMemo((): Workspace[] => {
    if (!chat || !chat.workspace) {
      return []
    }

    return typeof chat.workspace === 'string' ? JSON.parse(chat.workspace) : chat.workspace
  }, [chat])

  const selectFiles = useCallback(async () => {
    if (!chat) {
      return
    }

    const { canceled, filePaths } = await trpcClient.dialog.selectFile({})
    if (canceled) {
      return
    }

    trpcClient.chat.updateWorkspace({
      chatUid: chat.uid,
      workspace: [
        ...workspace,
        ...filePaths.map(path => ({
          type: 'file' as 'file' | 'directory',
          value: path,
        })),
      ],
    })
  }, [workspace])

  const selectFolder = useCallback(async () => {
    if (!chat) {
      return
    }

    const { canceled, filePaths } = await trpcClient.dialog.selectFolder({})

    if (canceled) {
      return
    }

    trpcClient.chat.updateWorkspace({
      chatUid: chat.uid,
      workspace: [
        ...workspace,
        {
          type: 'directory',
          value: filePaths[0],
        },
      ],
    })
  }, [workspace])

  const onDelete = useCallback(
    (index: number) => {
      if (!chat) {
        return
      }

      const newWorkspace = workspace.filter((_: Workspace, i: number) => i !== index)

      trpcClient.chat.updateWorkspace({
        chatUid: chat.uid,
        workspace: newWorkspace,
      })
    },
    [workspace, chat],
  )

  const onEdit = useCallback(
    (index: number) => {
      if (!chat) {
        return
      }
      const current = workspace[index]
      if (!current) {
        return
      }
      if (current.type === 'file') {
        trpcClient.dialog.selectFile({}).then(({ canceled, filePaths }) => {
          if (canceled || filePaths.length === 0) {
            return
          }
          const newWorkspace = [...workspace]
          newWorkspace[index] = {
            ...newWorkspace[index],
            value: filePaths[0],
          }
          trpcClient.chat.updateWorkspace({
            chatUid: chat.uid,
            workspace: newWorkspace,
          })
        })
      }

      if (current.type === 'directory') {
        trpcClient.dialog.selectFolder({}).then(({ canceled, filePaths }) => {
          if (canceled || filePaths.length === 0) {
            return
          }

          const newWorkspace = [...workspace]

          newWorkspace[index] = {
            ...newWorkspace[index],
            value: filePaths[0],
          }

          trpcClient.chat.updateWorkspace({
            chatUid: chat.uid,
            workspace: newWorkspace,
          })
        })
      }
    },
    [workspace, chat],
  )

  return (
    <div className="size-full space-y-4">
      <div className="space-y-2">
        {workspace.length === 0 && (
          <div className="text-sm text-muted-foreground mt-4">暂无提示词，点击下方按钮添加。</div>
        )}
        {workspace.length > 0
          && workspace.map((workspace, index: number) => {
            return (
              <Item variant="outline" key={`${workspace.value}-${index}`}>
                <ItemContent>
                  <ItemTitle>{workspace.type === 'file' ? <File size={12} /> : <Folder size={12} />}</ItemTitle>
                  <ItemDescription>{workspace.value}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="outline" size="sm" onClick={() => onEdit(index)}>
                    <Pen />
                  </Button>

                  <Button variant="danger" size="sm" onClick={() => onDelete(index)}>
                    <Trash />
                  </Button>
                </ItemActions>
              </Item>
            )
          })}
      </div>

      <ButtonGroup className="w-full">
        <Button className="w-1/2" onClick={selectFiles}>
          选择文件
        </Button>
        <Button className="w-1/2" onClick={selectFolder}>
          选择文件夹
        </Button>
      </ButtonGroup>
    </div>
  )
}
