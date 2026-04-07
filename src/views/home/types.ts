import type { Sparkles } from 'lucide-react'

export type HomeMode = 'loading' | 'needsProvider' | 'starter' | 'active'

export interface StarterTemplate {
  title: string
  prompt: string
  summary: string
  icon: typeof Sparkles
}

export interface HomeModeCopy {
  kicker: string
  title: string
  subtitle: string
}

export interface HomeStatusBadge {
  label: string
  variant: 'secondary' | 'outline'
}
