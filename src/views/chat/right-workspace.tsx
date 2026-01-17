import { useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
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

  const selectFiles = useCallback(async () => {
    const { canceled, filePaths } = await trpcClient.dialog.selectFile({})
    if (canceled) {
      return
    }

    console.log('用户选择的文件路径:', filePaths)
  }, [])

  const selectFolder = useCallback(async () => {
    const { canceled, filePaths } = await trpcClient.dialog.selectFolder({})
    if (canceled) {
      return
    }

    console.log('用户选择的文件路径:', filePaths)
  }, [])

  return (
    <div className="size-full">
      <h2 className="text-lg font-medium mb-4">
        {chat?.title}
        {' '}
        工作空间
      </h2>

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
