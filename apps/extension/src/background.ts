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
 * The extension's service worker.
 *
 * It does not count time: `chrome.alarms` does that for it, and survives the
 * service worker shutting down — precisely what a page's `setTimeout` cannot do
 * once the tab is closed.
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
  // `when` takes an absolute deadline: no drift to catch up on.
  chrome.alarms.create(ALARM, { when: phase.endsAt })
  await paintBadge(phase)
}

async function stop(): Promise<void> {
  await chrome.alarms.clear(ALARM)
  await chrome.storage.session.remove(STORAGE_KEY)
  await paintBadge(null)
}

/**
 * An MV3 service worker cannot play sound: the Web Audio API does not exist in
 * its context. The offscreen document is the sanctioned way around that.
 */
async function playAlarm(): Promise<void> {
  try {
    const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })
    if (existing.length === 0) {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN,
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Ring the end of a focus session.',
      })
    }
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'play' })
  } catch {
    // Without sound the notification still does the job: nothing is broken.
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
      title: `${MODE_LABEL[mode]} finished`,
      message: phase?.taskTitle ? `${NEXT_HINT[mode]} (${phase.taskTitle})` : NEXT_HINT[mode],
      priority: 2,
      requireInteraction: true,
    })

    await playAlarm()
    await stop()
  })()
})

// Clicking the notification opens the app: that is where the session lives.
chrome.notifications.onClicked.addListener((id) => {
  if (!id.startsWith(ALARM)) return
  void chrome.tabs.create({ url: 'https://maxgfr.github.io/basilico/' })
  chrome.notifications.clear(id)
})

// Messages from the page, relayed by the content script.
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

// The badge refreshes when the popup opens, not continuously: waking the service
// worker every minute for a badge would cost more than it is worth.
chrome.runtime.onStartup.addListener(() => void stop())
chrome.runtime.onInstalled.addListener(() => void stop())
