import type { MessageRenderBlock } from './message-blocks'
import { ApprovalBlockCard } from './approval-block-card'
import { CommandBlockCard } from './command-block-card'
import { MessageMarkdown } from './markdown'
import { StatusBlockRow } from './status-block-row'
import { TimelineBlockCard } from './timeline-block-card'
import { ToolCallCard } from './tool-call-card'

interface BlockRendererProps {
  blocks: MessageRenderBlock[]
  isUser: boolean
}

export function BlockRenderer({ blocks, isUser }: BlockRendererProps) {
  return (
    <div className="flex w-full flex-col gap-2">
      {blocks.map((block) => {
        if (block.type === 'markdown') {
          if (isUser) {
            return (
              <p key={block.id} className="text-sm leading-relaxed whitespace-pre-wrap wrap-break-word">
                {block.content}
              </p>
            )
          }

          return (
            <MessageMarkdown
              key={block.id}
              content={block.content}
              isUser={false}
              isStreaming={block.isStreaming}
            />
          )
        }

        if (block.type === 'tool') {
          return (
            <ToolCallCard
              key={block.id}
              pair={block.pair}
              isStreaming={block.status === 'running'}
            />
          )
        }

        if (block.type === 'approval') {
          return <ApprovalBlockCard key={block.id} block={block} />
        }

        if (block.type === 'command') {
          return <CommandBlockCard key={block.id} block={block} />
        }

        if (block.type === 'timeline') {
          return <TimelineBlockCard key={block.id} block={block} />
        }

        return <StatusBlockRow key={block.id} block={block} />
      })}
    </div>
  )
}
