import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

function WelcomePage() {
  const navigate = useNavigate()

  function handleStart() {
    localStorage.setItem('holix-welcomed', '1')
    navigate({ to: '/' })
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center gap-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <img src="/logo.png" alt="Holix AI" className="w-[72px] h-[72px]" />
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-bold">Holix AI</h1>
        <p className="text-muted-foreground text-center max-w-sm">
          欢迎使用 Holix AI，您的智能 AI 对话与协作助手
        </p>
      </div>
      <Button size="lg" onClick={handleStart}>
        开始使用
        <ArrowRight className="ml-2 w-4 h-4" />
      </Button>
    </motion.div>
  )
}

export const Route = createFileRoute('/welcome')({
  beforeLoad: () => {
    if (localStorage.getItem('holix-welcomed')) {
      throw redirect({ to: '/' })
    }
  },
  component: WelcomePage,
})
