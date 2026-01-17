import { useChatContext } from '@/context/chat'

export default function RightWorkspace() {
  const { chat } = useChatContext()

  return (
    <div>
      <h2 className="text-lg font-medium mb-4">
        {chat?.title}
        {' '}
        工作空间
      </h2>
    </div>
  )
}
