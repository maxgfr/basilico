import type { Mode } from '@basilico/core'

/**
 * Protocol between the web app and the extension.
 *
 * The extension is a **notifier, not a second timer**. The app remains the
 * single source of truth: it announces its deadline, the extension merely sets
 * an alarm and alerts. Two independent timers would inevitably drift apart, and
 * you would then have to arbitrate which one is right.
 *
 * The bridge goes through a content script and `window.postMessage` rather than
 * `chrome.runtime.sendMessage(id, …)`: the extension id differs between a
 * developer-mode install and a Store publication, and the page has no reliable
 * way of knowing it.
 */

export const FROM_APP = 'basilico-app'
export const FROM_EXTENSION = 'basilico-extension'

export type Phase = {
  mode: Mode
  /** Absolute deadline in epoch ms, `null` when nothing is running. */
  endsAt: number | null
  /** Title of the current task, for the notification body. */
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
  shortBreak: 'Short break',
  longBreak: 'Long break',
}

export const NEXT_HINT: Record<Mode, string> = {
  focus: 'Focus finished — take your break.',
  shortBreak: 'Break over — back to work.',
  longBreak: 'Long break over — back to work.',
}
