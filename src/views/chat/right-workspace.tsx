import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { useChatContext } from '@/context/chat'
import { trpcClient } from '@/lib/trpc-client'

export default function RightWorkspace() {
  const { chat } = useChatContext()

  const selectFiles = useCallback(async () => {
    const { canceled, filePaths } = await trpcClient.dialog.selectFile({})

    if (canceled) {
      console.log('用户取消了文件选择')
      return
    }

    console.log('用户选择的文件路径:', filePaths)
  }, [])

  const selectFolder = useCallback(async () => {
    const { canceled, filePaths } = await trpcClient.dialog.selectFolder({})

    if (canceled) {
      console.log('用户取消了文件选择')
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
