import { createFileRoute } from '@tanstack/react-router'
import { Download, Sparkles, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/skill-store')({
  component: SkillStorePage,
})

const skills = [
  {
    id: 'writing-assistant',
    name: '写作助手',
    desc: '优化文案、扩写内容、润色语气，适合日常写作和内容创作。',
    category: '效率',
  },
  {
    id: 'data-analyst',
    name: '数据分析师',
    desc: '快速生成数据分析思路、汇总结论，并给出可执行建议。',
    category: '分析',
  },
  {
    id: 'frontend-helper',
    name: '前端助手',
    desc: '协助完成组件开发、样式调整与页面结构优化。',
    category: '开发',
  },
]

function SkillStorePage() {
  return (
    <div className="w-full h-[calc(100vh-var(--app-header-height))] overflow-auto">
      <div className="w-full max-w-5xl mx-auto p-6 space-y-6">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <h1 className="text-xl font-semibold">技能商店</h1>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">浏览并安装你需要的技能。这里先提供一个简易商店示例页面。</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map(skill => (
            <article key={skill.id} className="rounded-xl border bg-card p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">{skill.name}</h2>
                <Badge variant="secondary">{skill.category}</Badge>
              </div>

              <p className="text-sm text-muted-foreground leading-6 flex-1">{skill.desc}</p>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center text-amber-500 text-xs gap-1">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  <span>4.8</span>
                </div>
                <Button size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  安装
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
