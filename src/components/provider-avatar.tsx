import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

const DEFAULT_PROVIDER_AVATAR = '🤖'

interface ProviderAvatarProps {
  avatar?: string
  name?: string
  className?: string
  fallbackClassName?: string
  textClassName?: string
}

interface ProviderAvatarPreset {
  id: string
  label: string
  avatar: string
}

function encodeSvg(markup: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`
}

function createPresetAvatar({
  bgFrom,
  bgTo,
  accent,
  symbol,
}: {
  bgFrom: string
  bgTo: string
  accent: string
  symbol: string
}) {
  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="g" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stop-color="${bgFrom}" />
          <stop offset="100%" stop-color="${bgTo}" />
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="28" fill="url(#g)" />
      <circle cx="72" cy="24" r="11" fill="${accent}" opacity="0.9" />
      <circle cx="22" cy="74" r="14" fill="white" opacity="0.15" />
      <path d="M20 60c10-17 22-26 37-26 11 0 20 4 28 11-8 19-23 31-42 31-11 0-18-6-23-16Z" fill="white" opacity="0.18" />
      <text x="48" y="56" text-anchor="middle" font-size="28" font-family="Arial, sans-serif" fill="white">${symbol}</text>
    </svg>
  `)
}

export const PROVIDER_AVATAR_PRESETS: ProviderAvatarPreset[] = [
  { id: 'sunrise', label: 'Sunrise', avatar: createPresetAvatar({ bgFrom: '#f97316', bgTo: '#ec4899', accent: '#fde68a', symbol: '✦' }) },
  { id: 'ocean', label: 'Ocean', avatar: createPresetAvatar({ bgFrom: '#0f766e', bgTo: '#2563eb', accent: '#99f6e4', symbol: '◌' }) },
  { id: 'forest', label: 'Forest', avatar: createPresetAvatar({ bgFrom: '#166534', bgTo: '#65a30d', accent: '#d9f99d', symbol: '◆' }) },
  { id: 'violet', label: 'Violet', avatar: createPresetAvatar({ bgFrom: '#6d28d9', bgTo: '#2563eb', accent: '#c4b5fd', symbol: '✶' }) },
  { id: 'ember', label: 'Ember', avatar: createPresetAvatar({ bgFrom: '#991b1b', bgTo: '#f97316', accent: '#fdba74', symbol: '⬢' }) },
  { id: 'slate', label: 'Slate', avatar: createPresetAvatar({ bgFrom: '#334155', bgTo: '#0f172a', accent: '#93c5fd', symbol: '⬡' }) },
]

export function isImageAvatar(avatar?: string | null) {
  if (!avatar)
    return false

  const value = avatar.trim()
  return value.startsWith('data:image/')
    || value.startsWith('blob:')
    || value.startsWith('http://')
    || value.startsWith('https://')
    || value.startsWith('/')
}

function getFallbackLabel(name?: string) {
  return name?.trim().charAt(0).toUpperCase() || DEFAULT_PROVIDER_AVATAR
}

export function ProviderAvatar({
  avatar,
  name,
  className,
  fallbackClassName,
  textClassName,
}: ProviderAvatarProps) {
  const hasImageAvatar = isImageAvatar(avatar)
  const textAvatar = !hasImageAvatar && avatar?.trim() ? avatar : DEFAULT_PROVIDER_AVATAR

  return (
    <Avatar className={cn('size-8 shrink-0 border', className)}>
      {hasImageAvatar && <AvatarImage src={avatar} alt={name ? `${name} avatar` : 'Provider avatar'} className="object-cover" />}
      <AvatarFallback className={cn('bg-muted text-foreground', fallbackClassName)}>
        <span className={cn('text-sm leading-none', textClassName)}>
          {hasImageAvatar ? getFallbackLabel(name) : textAvatar}
        </span>
      </AvatarFallback>
    </Avatar>
  )
}
