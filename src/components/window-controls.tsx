import { Maximize2, Minimize2, Minus, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { usePlatform } from '@/hooks/platform'
import { onUpdate } from '@/lib/command'
import { close, minimize, toggleMaximize } from '@/lib/system'
import { cn } from '@/lib/utils'

function Button({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <button
      className={cn(className, 'flex items-center justify-center p-2 cursor-pointer')}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function WindowControls() {
  const { isMacOS } = usePlatform()

  const [isMaximized, setIsMaximized] = useState(false)

  const handleMinimize = useCallback(() => {
    minimize()
  }, [])

  const handleToggleMaximize = useCallback(() => {
    toggleMaximize()
  }, [])

  const handleClose = useCallback(() => {
    close()
  }, [])

  useEffect(() => {
    const off = onUpdate('window.maximize', (payload) => {
      setIsMaximized(payload.maximized)
    })
    return () => {
      off()
    }
  }, [])

  return (
    <>
      {isMacOS
        ? null
        : (
            <div className="flex items-center gap-2">
              <Button className="hover:bg-gray-200/60 rounded-sm" onClick={handleMinimize} aria-label="Minimize">
                <Minus size={14} />
              </Button>
              <Button className="hover:bg-gray-200/60 rounded-sm" onClick={handleToggleMaximize} aria-label="Maximize">
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </Button>
              <Button className="hover:bg-red-600 hover:text-white rounded-sm" onClick={handleClose} aria-label="Close">
                <X size={14} />
              </Button>
            </div>
          )}
    </>
  )
}

export default WindowControls
