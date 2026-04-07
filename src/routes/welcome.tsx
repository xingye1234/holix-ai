import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Boxes,
  MessageSquarePlus,
  Rocket,
  Settings2,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const onboardingSteps = [
  {
    title: '连接你的模型供应商',
    description: '先把 OpenAI、Anthropic、DeepSeek、Qwen 或 Ollama 接进来，工作台才真正可用。',
    icon: Settings2,
    accent: 'from-sky-500/20 to-cyan-500/5',
  },
  {
    title: '装配技能与 Agent',
    description: '把技能、MCP 和 Agent 组合成适合你日常工作的执行单元，而不是只停留在聊天。',
    icon: Boxes,
    accent: 'from-emerald-500/18 to-teal-500/5',
  },
  {
    title: '开始第一轮协作',
    description: '创建一个话题，把需求丢进去，让 Holix 帮你研究、写作、编码和推进任务。',
    icon: Rocket,
    accent: 'from-amber-500/18 to-orange-500/5',
  },
] as const

const scenarioCards = [
  {
    title: '多模型协作',
    description: '在同一个工作台里切换 provider / model，按任务选择更适合的能力。',
    icon: Sparkles,
  },
  {
    title: '技能驱动执行',
    description: '把文件系统、Shell、代码阅读等能力装进对话，让结果可执行而不只是回答。',
    icon: Wand2,
  },
  {
    title: 'Agent 工作流',
    description: '把常用角色沉淀成 Agent，减少重复配置，提高团队与个人复用效率。',
    icon: Bot,
  },
] as const

const starterPrompts = [
  '帮我梳理这个项目的结构，并告诉我从哪里开始改最安全。',
  '基于当前仓库，设计一个更完整的 provider onboarding 流程。',
  '为这个产品整理一份技能市场与 Agent 系统的能力地图。',
] as const

function WelcomePage() {
  const navigate = useNavigate()

  async function handleContinue(to: '/' | '/setting/provider' | '/skills' | '/agents' = '/') {
    localStorage.setItem('holix-welcomed', '1')
    await navigate({ to })
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.98)_0%,_rgba(247,249,252,0.96)_44%,_rgba(241,245,249,0.98)_100%)] dark:bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_28%),linear-gradient(180deg,_rgba(8,12,20,0.98)_0%,_rgba(10,15,24,0.96)_44%,_rgba(6,10,18,0.98)_100%)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="relative mx-auto flex min-h-full w-full max-w-7xl items-center px-5 py-8 sm:px-8 lg:px-12">
        <div className="absolute inset-x-0 top-0 -z-10 h-56 bg-[radial-gradient(circle,_rgba(56,189,248,0.18),_transparent_65%)] blur-3xl" />

        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.2fr)_380px] xl:gap-8">
          <motion.section
            className="rounded-[36px] border border-white/60 bg-white/72 p-6 shadow-[0_32px_80px_-44px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:border-white/10 dark:bg-white/6 sm:p-8 lg:p-10"
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Holix AI Workspace
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-[24px] bg-gradient-to-br from-sky-500 via-cyan-500 to-emerald-500 p-[1px] shadow-[0_20px_50px_-28px_rgba(14,165,233,0.8)]">
                <div className="flex h-full w-full items-center justify-center rounded-[23px] bg-background/95">
                  <img src="/logo.png" alt="Holix AI" className="h-11 w-11" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground/80">
                  Build With Models, Skills, Agents
                </p>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl xl:text-6xl">
                  不只是聊天窗口，
                  <br />
                  而是一套可执行的 AI 工作台。
                </h1>
              </div>
            </div>

            <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">
              Holix 把模型供应商、技能、MCP 和 Agent 组织在同一个桌面产品里。
              第一次进入时，你不必理解所有能力，只需要按顺序完成配置，然后开始第一轮协作。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                size="lg"
                className="h-12 rounded-2xl px-6"
                onClick={() => handleContinue('/')}
              >
                直接进入工作台
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-2xl px-6 bg-background/70"
                onClick={() => handleContinue('/setting/provider')}
              >
                <Settings2 className="h-4 w-4" />
                先配置 Provider
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 rounded-2xl px-5"
                onClick={() => handleContinue('/agents')}
              >
                <Bot className="h-4 w-4" />
                看看 Agent 空间
              </Button>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {scenarioCards.map(card => {
                const Icon = card.icon

                return (
                  <div
                    key={card.title}
                    className="rounded-[24px] border border-border/60 bg-background/70 p-5 shadow-[0_16px_40px_-32px_rgba(15,23,42,0.5)]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-base font-semibold text-foreground">{card.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
                  </div>
                )
              })}
            </div>

            <div className="mt-10 rounded-[28px] border border-border/60 bg-background/74 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MessageSquarePlus className="h-4 w-4 text-primary" />
                如果你想马上进入状态，可以从这些任务开始
              </div>
              <div className="mt-4 grid gap-3">
                {starterPrompts.map(prompt => (
                  <div
                    key={prompt}
                    className="rounded-2xl border border-border/50 bg-background/80 px-4 py-3 text-sm leading-6 text-muted-foreground"
                  >
                    {prompt}
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.aside
            className="flex flex-col gap-4"
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.08 }}
          >
            <div className="rounded-[32px] border border-white/55 bg-white/76 p-6 shadow-[0_28px_70px_-46px_rgba(15,23,42,0.48)] backdrop-blur-xl dark:border-white/10 dark:bg-white/7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-primary">上手路径</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight">先把第一步走对</h2>
                </div>
                <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  约 3 分钟
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {onboardingSteps.map((step, index) => {
                  const Icon = step.icon

                  return (
                    <div
                      key={step.title}
                      className={`rounded-[24px] border border-border/55 bg-gradient-to-br ${step.accent} p-[1px]`}
                    >
                      <div className="rounded-[23px] bg-background/92 p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Icon className="h-[18px] w-[18px]" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/80">
                              Step
                              {' '}
                              {index + 1}
                            </div>
                            <h3 className="mt-1 text-sm font-semibold text-foreground">{step.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-[32px] border border-border/60 bg-[linear-gradient(135deg,rgba(15,23,42,0.94),rgba(30,41,59,0.9))] p-6 text-slate-50 shadow-[0_28px_70px_-48px_rgba(15,23,42,0.8)]">
              <p className="text-sm font-medium text-sky-200">推荐下一步</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">先去完成 Provider 配置</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                这是让产品真正跑起来的第一环。配置完成后，你就可以回到主页直接创建话题并开始执行任务。
              </p>

              <div className="mt-5 flex flex-col gap-3">
                <Button
                  size="lg"
                  variant="secondary"
                  className="h-11 justify-between rounded-2xl bg-white text-slate-900 hover:bg-slate-100"
                  onClick={() => handleContinue('/setting/provider')}
                >
                  打开 Provider 设置
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-11 justify-between rounded-2xl border border-white/12 bg-white/6 text-slate-50 hover:bg-white/10"
                  onClick={() => handleContinue('/skills')}
                >
                  浏览技能市场
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
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
