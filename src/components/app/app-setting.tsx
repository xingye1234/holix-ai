import { useNavigate } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { Button } from '../ui/button'

export default function AppSetting({
  variant = 'header',
}: {
  variant?: 'header' | 'sidebar'
}) {
  const navigate = useNavigate()

  if (variant === 'sidebar') {
    return (
      <Button
        variant="ghost"
        className="h-11 w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground hover:bg-background/70 hover:text-foreground"
        onClick={() => navigate({ to: '/setting/general' })}
      >
        <Settings className="h-4 w-4" />
        <span>设置</span>
      </Button>
    )
  }

  return (
    <Button variant="link" size="icon" className="cursor-pointer" onClick={() => navigate({ to: '/setting/general' })}>
      <Settings />
    </Button>
  )
}
