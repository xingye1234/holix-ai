import { Pen, Trash } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@/components/ui/item'
import { useChatContext } from '@/context/chat'
import logger from '@/lib/logger'
import { trpcClient } from '@/lib/trpc-client'
import PromptDialog from './prompt-dialog'

export default function Prompts() {
  const { chat } = useChatContext()

  const prompts = useMemo(() => {
    if (!chat) {
      return []
    }
    return Array.isArray(chat.prompts) ? chat.prompts : JSON.parse(chat.prompts as unknown as string) || []
  }, [chat])

  const onSave = useCallback(
    (value: string) => {
      logger.info('保存提示词内容:', value)

      if (!chat) {
        logger.warn('No chat context available, cannot save prompt.')
        return
      }

      trpcClient.chat
        .updatePrompts({
          chatUid: chat?.uid ?? '',
          prompts: [...prompts, value],
        })
        .then((updatedChat) => {
          logger.info('提示词保存成功:', updatedChat)
          toast.success('提示词保存成功')
        })
        .catch((err) => {
          logger.error('提示词保存失败:', err)
          toast.error('提示词保存失败')
        })
    },
    [chat, prompts],
  )

  const onEdit = useCallback(
    (index: number, value: string) => {
      logger.info('编辑提示词内容:', { index, value })

      if (!chat) {
        logger.warn('No chat context available, cannot edit prompt.')
        return
      }

      const newPrompts = [...prompts]
      newPrompts[index] = value

      trpcClient.chat
        .updatePrompts({
          chatUid: chat.uid,
          prompts: newPrompts,
        })
        .then((updatedChat) => {
          logger.info('提示词编辑成功:', updatedChat)
          toast.success('提示词编辑成功')
        })
        .catch((err) => {
          logger.error('提示词编辑失败:', err)
          toast.error('提示词编辑失败')
        })
    },
    [chat, prompts],
  )

  const onDelete = useCallback(
    (index: number) => {
      logger.info('删除提示词:', index)

      if (!chat) {
        logger.warn('No chat context available, cannot delete prompt.')
        return
      }

      const newPrompts = prompts.filter((_: string, i: number) => i !== index)

      trpcClient.chat
        .updatePrompts({
          chatUid: chat.uid,
          prompts: newPrompts,
        })
        .then((updatedChat) => {
          logger.info('提示词删除成功:', updatedChat)
          toast.success('提示词删除成功')
        })
        .catch((err) => {
          logger.error('提示词删除失败:', err)
          toast.error('提示词删除失败')
        })
    },
    [chat, prompts],
  )

  return (
    <div className="h-full">
      <div className="space-y-2">
        {prompts.length === 0 && <div className="text-sm text-muted-foreground mt-4">暂无提示词，点击下方按钮添加。</div>}
        {
          prompts.length > 0 && prompts.map((prompt: string, index: number) => {
            return (
              <Item variant="outline" key={`${prompt}-${index}`}>
                <ItemContent>
                  <ItemTitle>
                    提示词
                    {index + 1}
                  </ItemTitle>
                  <ItemDescription>{prompt}</ItemDescription>
                </ItemContent>
                <ItemActions>
                  <PromptDialog defaultValue={prompt} onSave={value => onEdit(index, value)}>
                    <Button variant="outline" size="sm">
                      <Pen />
                    </Button>
                  </PromptDialog>

                  <Button variant="destructive" size="sm" onClick={() => onDelete(index)}>
                    <Trash />
                  </Button>
                </ItemActions>
              </Item>
            )
          })
        }
      </div>

      <PromptDialog onSave={onSave}>
        <Button variant="default" className="mt-4 w-full">
          添加提示词
        </Button>
      </PromptDialog>
    </div>
  )
}
