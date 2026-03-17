import { CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import useMessageSelection from '@/store/message-selection'

export function SelectionToggle() {
  const isSelectionMode = useMessageSelection(state => state.isSelectionMode)
  const toggleSelectionMode = useMessageSelection(state => state.toggleSelectionMode)

  return (
    <Button
      variant={isSelectionMode ? 'default' : 'ghost'}
      size="sm"
      onClick={toggleSelectionMode}
      className={isSelectionMode ? 'gap-2' : 'gap-2'}
    >
      <CheckSquare className="w-4 h-4" />
      <span className="hidden sm:inline">
        {isSelectionMode ? '取消选择' : '选择消息'}
      </span>
    </Button>
  )
}
