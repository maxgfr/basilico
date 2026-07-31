import { useEffect } from 'react'
import { useApp } from '../../store/app'
import { sound } from '../../platform/sound'
import { navigate } from '../../lib/router'

export const SHORTCUTS = [
  { keys: 'Space', label: 'Start or pause' },
  { keys: 'R', label: 'Reset the current phase' },
  { keys: 'S', label: 'Skip to the next phase' },
  { keys: 'I', label: 'Log an internal interruption' },
  { keys: 'E', label: 'Log an external interruption' },
  { keys: 'T', label: 'Go to stats' },
] as const

/** True while the user is typing: we don't hijack their keystrokes. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  )
}

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTyping(event.target)) return

      const store = useApp.getState()
      const now = Date.now()

      switch (event.key) {
        case ' ':
          event.preventDefault()
          // A key press counts as a user gesture: the right moment to unlock the
          // audio context, otherwise the alarm would be silent.
          void sound.unlock()
          store.toggle(now)
          break
        case 'r':
        case 'R':
          store.resetPhase(now)
          break
        case 's':
        case 'S':
          store.skipPhase(now)
          break
        case 'i':
        case 'I':
          store.interrupt('internal')
          break
        case 'e':
        case 'E':
          store.interrupt('external')
          break
        case 't':
        case 'T':
          navigate('stats')
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
