import { useEffect, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, updateSettings } from '@/lib/db'
import { DEFAULT_SETTINGS, type Settings, type ThemePreference } from '@/lib/types'

const THEME_KEY = 'mt.theme'

/** Mirrors the choice into localStorage so index.html can apply it pre-paint. */
export function applyTheme(preference: ThemePreference) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = preference === 'dark' || (preference === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', dark)
  try {
    localStorage.setItem(THEME_KEY, preference)
  } catch {
    // Private browsing can reject writes; the in-memory class still applies.
  }
}

/**
 * The raw record, `undefined` until IndexedDB answers. Screens that seed a form
 * from the defaults need this so they do not build the form twice.
 */
export function useSettingsQuery(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('settings'), [])
}

export function useSettings(): Settings {
  const settings = useSettingsQuery()
  // Merged over the defaults, never substituted for them: a row written before
  // a setting existed is missing that key, and an undefined dim level or text
  // scale reaching the DOM is worse than a wrong one.
  const resolved = useMemo<Settings>(
    () => ({ ...DEFAULT_SETTINGS, ...(settings ?? {}) }),
    [settings],
  )

  useEffect(() => {
    applyTheme(resolved.theme)
  }, [resolved.theme])

  // Follow the OS while the preference is "system".
  useEffect(() => {
    if (resolved.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [resolved.theme])

  return resolved
}

export { updateSettings }
