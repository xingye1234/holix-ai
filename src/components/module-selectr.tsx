import { useEffect, useState } from 'react'
import { ANTHROPIC_MODELS, GEMINI_MODELS, OLLAMA_MODELS, OPENAI_CHAT_MODELS } from '@/share/models'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from './ui/select'

export interface ModuleSelectorProps {
  value?: string | undefined
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  persistKey?: string | null // if provided, persist selected model to localStorage
}

export default function ModuleSelector({
  value,
  onValueChange,
  placeholder = '选择模型',
  className,
  persistKey = 'holix:selectedModel',
}: ModuleSelectorProps) {
  // support controlled usage via value/onValueChange; otherwise fall back to internal state with persistence
  const [internal, setInternal] = useState<string | undefined>(() => {
    if (typeof value !== 'undefined')
      return value
    if (!persistKey)
      return undefined
    try {
      return localStorage.getItem(persistKey) ?? undefined
    }
    catch {
      return undefined
    }
  })

  // keep internal in sync when controlled value changes
  useEffect(() => {
    if (typeof value !== 'undefined') {
      setInternal(value)
    }
  }, [value])

  // persist when internal changes and persistKey set
  useEffect(() => {
    if (!persistKey)
      return
    try {
      if (internal) {
        localStorage.setItem(persistKey, internal)
        onValueChange?.(internal)
      }
    }
    catch {}
  }, [internal, persistKey])

  const current = typeof value === 'undefined' ? internal : value
  const handleChange = (v: string) => {
    if (onValueChange)
      onValueChange(v)
    else setInternal(v)
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className={className ?? 'w-56'}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>OpenAI</SelectLabel>
          {OPENAI_CHAT_MODELS.map(m => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Gemini</SelectLabel>
          {GEMINI_MODELS.map(m => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Anthropic</SelectLabel>
          {ANTHROPIC_MODELS.map(m => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Ollama</SelectLabel>
          {OLLAMA_MODELS.map(m => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
