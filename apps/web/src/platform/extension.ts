import { useEffect, useState } from 'react'
import { useApp } from '../store/app'

/**
 * Pont vers l'extension Chrome, quand elle est installée.
 *
 * Sans elle, une notification ne peut pas partir onglet fermé : ça exigerait le
 * Web Push, donc un serveur. L'extension, elle, pose une vraie alarme système.
 *
 * L'application reste la seule source de vérité : elle annonce son échéance,
 * l'extension se contente d'alerter. Le dialogue passe par `window.postMessage`
 * et un content script, parce que la page n'a aucun moyen fiable de connaître
 * l'identifiant de l'extension.
 */

const FROM_APP = 'basilico-app'
const FROM_EXTENSION = 'basilico-extension'

type Announcement = { source: typeof FROM_EXTENSION; type: 'ready'; version: string }

function post(message: Record<string, unknown>): void {
  window.postMessage({ source: FROM_APP, ...message }, window.location.origin)
}

/** `null` tant qu'on ne sait pas, sinon la version de l'extension détectée. */
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
    // Le content script s'annonce au chargement ; s'il l'a fait avant qu'on
    // écoute, ce ping le fait répondre.
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
