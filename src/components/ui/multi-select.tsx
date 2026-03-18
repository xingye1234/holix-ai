import * as Checkbox from '@radix-ui/react-checkbox'
import * as Popover from '@radix-ui/react-popover'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { SelectTrigger } from './select'

interface Option { value: string, label: React.ReactNode }

export interface MultiSelectProps {
  options: Option[]
  value?: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  size?: 'sm' | 'default'
  className?: string
  disabled?: boolean
}

export function MultiSelect({
  options,
  value = [],
  onChange,
  placeholder = '请选择...',
  size = 'default',
  className,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const toggle = React.useCallback(
    (v: string) => {
      const next = value.includes(v) ? value.filter(x => x !== v) : [...value, v]
      onChange(next)
    },
    [onChange, value],
  )

  const selectedLabels = options
    .filter(o => value.includes(o.value))
    .map(o => String(o.label))

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <SelectTrigger size={size} className={cn(className)} disabled={disabled}>
          <span data-slot="select-value">
            {selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}
          </span>
          <ChevronDownIcon className="size-4 opacity-50" />
        </SelectTrigger>
      </Popover.Trigger>

      <Popover.Content sideOffset={8} align="start" className="z-50">
        <div className="min-w-[12rem] max-h-60 overflow-auto rounded-md border bg-popover p-2 shadow-md">
          {options.map((opt) => {
            const checked = value.includes(opt.value)
            return (
              <div
                key={opt.value}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 hover:bg-accent/60 rounded-sm',
                )}
              >
                <Checkbox.Root
                  checked={checked}
                  onCheckedChange={() => toggle(opt.value)}
                  className="size-5 inline-flex items-center justify-center rounded-sm border bg-transparent"
                >
                  <Checkbox.Indicator>
                    <CheckIcon className="size-4" />
                  </Checkbox.Indicator>
                </Checkbox.Root>

                <button
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className="flex-1 text-left text-sm"
                >
                  {opt.label}
                </button>
              </div>
            )
          })}
        </div>
      </Popover.Content>
    </Popover.Root>
  )
}

export default MultiSelect
