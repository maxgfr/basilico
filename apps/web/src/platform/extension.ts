import { useEffect, useState } from 'react'
import { useApp } from '../store/app'

/**
 * Bridge to the Chrome extension, when it is installed.
 *
 * Without it, no notification can fire once the tab is closed: that would need
 * Web Push, hence a server. The extension sets a real system alarm instead.
 *
 * The app stays the single source of truth: it announces its deadline, the
 * extension merely alerts. The conversation goes through `window.postMessage`
 * and a content script, because the page has no reliable way of knowing the
 * extension's id.
 */

const FROM_APP = 'basilico-app'
const FROM_EXTENSION = 'basilico-extension'

type Announcement = { source: typeof FROM_EXTENSION; type: 'ready'; version: string }

function post(message: Record<string, unknown>): void {
  window.postMessage({ source: FROM_APP, ...message }, window.location.origin)
}

/** `null` while unknown, otherwise the detected extension version. */
export function useExtensionBridge(): string | null {
  const [version, setVersion] = useState<string | null>(null)

  const timer = useApp((s) => s.timer)
  const taskTitle = useApp((s) => s.tasks.find((t) => t.id === s.timer.taskId)?.title ?? null)

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return
      const data = event.data as Announcement | undefined
      if (data?.source !== FROM_EXTENSION || data.type !== 'ready') return
      setVersion(data.version)
    }

    window.addEventListener('message', onMessage)
    // The content script announces itself on load; if it did so before we were
    // listening, this ping makes it answer.
    post({ type: 'ping' })
    return () => window.removeEventListener('message', onMessage)
  }, [])

  useEffect(() => {
    if (version === null) return

    const live = timer.status === 'running' || timer.status === 'overtime'
    if (!live || timer.endsAt === null) {
      post({ type: 'clear' })
      return
    }
    post({
      type: 'sync',
      phase: { mode: timer.mode, endsAt: timer.endsAt, taskTitle },
    })
  }, [version, timer.status, timer.endsAt, timer.mode, taskTitle])

  return version
}
