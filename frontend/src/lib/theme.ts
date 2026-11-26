import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'blue' | 'multicolor'
export type Font = 'sans' | 'serif'

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'light', label: 'White' },
  { id: 'dark', label: 'Dark' },
  { id: 'blue', label: 'Blue' },
  { id: 'multicolor', label: 'Multicolor' },
]

export const FONTS: { id: Font; label: string; sample: string }[] = [
  { id: 'sans', label: 'Modern', sample: 'Plus Jakarta Sans' },
  { id: 'serif', label: 'Classic', sample: 'Times New Roman' },
]

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const saved = localStorage.getItem(key) as T | null
    if (saved && allowed.includes(saved)) return saved
  } catch {
    /* storage unavailable */
  }
  return fallback
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* not a big deal */
  }
}

const systemTheme = (): Theme => (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

export function usePrefs() {
  const [theme, setTheme] = useState<Theme>(() =>
    read('chat.theme', THEMES.map((t) => t.id), systemTheme()),
  )
  const [font, setFont] = useState<Font>(() => read('chat.font', FONTS.map((f) => f.id), 'sans'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    save('chat.theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.dataset.font = font
    save('chat.font', font)
  }, [font])

  return { theme, setTheme, font, setFont }
}
