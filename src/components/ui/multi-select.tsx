import * as Checkbox from '@radix-ui/react-checkbox'
import * as Popover from '@radix-ui/react-popover'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

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
        <button
          type="button"
          data-size={size}
          className={cn(
            'border-input text-left text-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8',
            selectedLabels.length === 0 && 'text-muted-foreground',
            className,
          )}
          disabled={disabled}
        >
          <span className="line-clamp-1">{selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}</span>
          <ChevronDownIcon className="size-4 opacity-50" />
        </button>
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
