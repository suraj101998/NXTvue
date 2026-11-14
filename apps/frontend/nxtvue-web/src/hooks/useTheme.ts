import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'

/** One theme for the whole app. It is light unless the user has switched to dark. */
const KEY = 'nxtvue_theme'
const listeners = new Set<() => void>()

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

let current: Theme = read()

/** Tailwind's `dark:` variant and the dark colour tokens follow the `dark` class on <html>. */
function apply(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
}
apply(current)

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // Another tab switched the theme.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    current = read()
    apply(current)
    onChange()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onStorage)
  }
}

function setTheme(next: Theme) {
  current = next
  apply(next)
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // Private mode: the choice then lasts until the page is closed.
  }
  listeners.forEach((l) => l())
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current, () => 'light' as Theme)
  const toggle = useCallback(() => setTheme(current === 'dark' ? 'light' : 'dark'), [])
  return { theme, toggle }
}
