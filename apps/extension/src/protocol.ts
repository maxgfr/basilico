import type { Mode } from '@basilico/core'

/**
 * Protocole entre l'application web et l'extension.
 *
 * L'extension est un **notificateur, pas un second minuteur**. L'app reste la
 * seule source de vérité : elle annonce son échéance, l'extension se contente de
 * poser une alarme et d'alerter. Deux minuteurs indépendants finiraient
 * inévitablement par diverger, et il faudrait alors arbitrer lequel a raison.
 *
 * Le pont passe par un content script et `window.postMessage` plutôt que par
 * `chrome.runtime.sendMessage(id, …)` : l'identifiant d'extension change entre
 * une installation en mode développeur et une publication au Store, et la page
 * n'a aucun moyen fiable de le connaître.
 */

export const FROM_APP = 'basilico-app'
export const FROM_EXTENSION = 'basilico-extension'

export type Phase = {
  mode: Mode
  /** Échéance absolue en ms epoch, `null` si rien ne tourne. */
  endsAt: number | null
  /** Titre de la tâche en cours, pour le corps de la notification. */
  taskTitle: string | null
}

export type AppMessage =
  | { source: typeof FROM_APP; type: 'sync'; phase: Phase }
  | { source: typeof FROM_APP; type: 'clear' }
  | { source: typeof FROM_APP; type: 'ping' }

export type ExtensionMessage =
  | { source: typeof FROM_EXTENSION; type: 'ready'; version: string }
  | { source: typeof FROM_EXTENSION; type: 'fired'; mode: Mode; at: number }

export const STORAGE_KEY = 'basilico:phase'

export const MODE_LABEL: Record<Mode, string> = {
  focus: 'Focus',
  shortBreak: 'Pause courte',
  longBreak: 'Pause longue',
}

export const NEXT_HINT: Record<Mode, string> = {
  focus: 'Focus terminé — prends ta pause.',
  shortBreak: 'Pause terminée — au travail.',
  longBreak: 'Longue pause terminée — au travail.',
}
