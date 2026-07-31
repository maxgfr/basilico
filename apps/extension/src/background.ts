import {
  FROM_APP,
  MODE_LABEL,
  NEXT_HINT,
  STORAGE_KEY,
  type AppMessage,
  type Phase,
} from './protocol'

const ALARM = 'basilico-phase-end'
const OFFSCREEN = 'offscreen.html'

/**
 * Service worker de l'extension.
 *
 * Il ne compte pas le temps : `chrome.alarms` le fait pour lui, et survit à
 * l'arrêt du service worker — c'est précisément ce qu'un `setTimeout` dans une
 * page ne sait pas faire quand l'onglet est fermé.
 */

async function readPhase(): Promise<Phase | null> {
  const stored = await chrome.storage.session.get(STORAGE_KEY)
  return (stored[STORAGE_KEY] as Phase | undefined) ?? null
}

async function paintBadge(phase: Phase | null): Promise<void> {
  if (!phase || phase.endsAt === null) {
    await chrome.action.setBadgeText({ text: '' })
    return
  }
  const minutes = Math.max(0, Math.ceil((phase.endsAt - Date.now()) / 60_000))
  await chrome.action.setBadgeText({ text: minutes > 99 ? '99+' : String(minutes) })
  await chrome.action.setBadgeBackgroundColor({ color: '#2f6f55' })
}

async function schedule(phase: Phase): Promise<void> {
  await chrome.alarms.clear(ALARM)
  await chrome.storage.session.set({ [STORAGE_KEY]: phase })

  if (phase.endsAt === null || phase.endsAt <= Date.now()) {
    await paintBadge(null)
    return
  }
  // `when` accepte une échéance absolue : aucune dérive à rattraper.
  chrome.alarms.create(ALARM, { when: phase.endsAt })
  await paintBadge(phase)
}

async function stop(): Promise<void> {
  await chrome.alarms.clear(ALARM)
  await chrome.storage.session.remove(STORAGE_KEY)
  await paintBadge(null)
}

/**
 * Un service worker MV3 ne peut pas jouer de son : l'API Web Audio n'existe pas
 * dans son contexte. Le document offscreen est le seul moyen prévu pour ça.
 */
async function playAlarm(): Promise<void> {
  try {
    const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
    if (existing.length === 0) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Faire sonner la fin d’une session de focus.',
      })
    }
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'play' })
  } catch {
    // Sans son, la notification suffit : on ne casse rien pour autant.
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM) return

  void (async () => {
    const phase = await readPhase()
    const mode = phase?.mode ?? 'focus'

    chrome.notifications.create(`${ALARM}-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: `${MODE_LABEL[mode]} terminé`,
      message: phase?.taskTitle ? `${NEXT_HINT[mode]} (${phase.taskTitle})` : NEXT_HINT[mode],
      priority: 2,
      requireInteraction: true,
    })

    await playAlarm()
    await stop()
  })()
})

// Ouvrir l'app quand on clique la notification : c'est là que la session vit.
chrome.notifications.onClicked.addListener((id) => {
  if (!id.startsWith(ALARM)) return
  void chrome.tabs.create({ url: 'https://maxgfr.github.io/basilico/' })
  chrome.notifications.clear(id)
})

// Messages venus de la page, relayés par le content script.
chrome.runtime.onMessage.addListener(
  (message: AppMessage & { target?: string }, _sender, reply) => {
    if (message.target === 'offscreen') return
    if (message.source !== FROM_APP) return

    if (message.type === 'sync') {
      void schedule(message.phase).then(() => reply({ ok: true }))
      return true
    }
    if (message.type === 'clear') {
      void stop().then(() => reply({ ok: true }))
      return true
    }
    if (message.type === 'ping') {
      reply({ ok: true, version: chrome.runtime.getManifest().version })
      return true
    }
    return undefined
  },
)

// Le badge se rafraîchit à l'ouverture du popup, pas en continu : réveiller le
// service worker toutes les minutes pour une pastille coûterait plus que ça ne vaut.
chrome.runtime.onStartup.addListener(() => void stop())
chrome.runtime.onInstalled.addListener(() => void stop())
