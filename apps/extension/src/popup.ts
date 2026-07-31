import { MODE_LABEL, STORAGE_KEY, type Phase } from './protocol'

const APP_URL = 'https://maxgfr.github.io/basilico/'

/**
 * Le popup n'est qu'un cadran de lecture : il n'offre aucun contrôle du minuteur.
 *
 * C'est délibéré. Piloter le minuteur depuis deux endroits créerait deux sources
 * de vérité, et donc des divergences à arbitrer à chaque désynchronisation.
 * L'app décide, l'extension alerte.
 */

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

function render(phase: Phase | null): string {
  if (!phase || phase.endsAt === null) {
    return `
      <p class="hint">
        No session running. Start a focus in basilico and this extension takes over the
        alerts — even if you close the tab.
      </p>
      <a class="button" href="${APP_URL}" target="_blank" rel="noreferrer">Open basilico</a>`
  }

  const remaining = phase.endsAt - Date.now()
  return `
    <div class="time">${clock(remaining)}</div>
    <div class="mode">${MODE_LABEL[phase.mode]}${
      phase.taskTitle ? ` · ${phase.taskTitle}` : ''
    }</div>
    <p class="hint">The alarm is armed. You can close the tab.</p>
    <a class="button" href="${APP_URL}" target="_blank" rel="noreferrer">Open basilico</a>`
}

const root = document.getElementById('app')

async function refresh(): Promise<void> {
  if (!root) return
  const stored = await chrome.storage.session.get(STORAGE_KEY)
  root.innerHTML = render((stored[STORAGE_KEY] as Phase | undefined) ?? null)
}

void refresh()
// Le popup est éphémère : un rafraîchissement par seconde tant qu'il est ouvert suffit.
setInterval(() => void refresh(), 1000)
