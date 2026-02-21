import { useNavigate } from '@tanstack/react-router'
import { Settings } from 'lucide-react'
import { Button } from '../ui/button'

export default function AppSetting() {
  const navigate = useNavigate()
  return (
    <Button variant="link" size="icon" className="cursor-pointer" onClick={() => navigate({ to: '/setting/general' })}>
      <Settings />
    </Button>
  )
}
