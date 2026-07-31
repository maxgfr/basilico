import { useEffect, useState } from 'react'
import { DURATION_PRESETS, applyPreset, type PresetName, type Settings } from '@basilico/core'
import { useApp } from '../../store/app'
import { Button } from '../../ui/Button'
import { Choice, NumberField, OptionCards, Row, Section, StatusPill, Toggle } from '../../ui/Form'
import { ALARMS, sound } from '../../platform/sound'
import { permissionState, requestPermission } from '../../platform/notifications'
import type { AlarmName } from '../../platform/sound'
import { SHORTCUTS } from '../timer/shortcuts'
import { DataSection } from './DataSection'
import { useExtensionBridge } from '../../platform/extension'
import { formatDuration } from '../../lib/format'

const SECTIONS = [
  { id: 'timer', label: 'Timer' },
  { id: 'flow', label: 'Flow' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'sound', label: 'Sound' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'storage', label: 'Storage' },
  { id: 'data', label: 'Your data' },
  { id: 'shortcuts', label: 'Shortcuts' },
] as const

export function SettingsScreen() {
  const settings = useApp((s) => s.settings)
  const update = useApp((s) => s.updateSettings)
  const [permission, setPermission] = useState(permissionState)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const extensionVersion = useExtensionBridge()

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  // At zero the player returns without a sound, so the preview would be a
  // button that does nothing rather than one that says why.
  const muted = settings.sound.volume <= 0

  const preset = (Object.keys(DURATION_PRESETS) as PresetName[]).find((name) => {
    const p = DURATION_PRESETS[name]
    return (
      p.focus === settings.durations.focus &&
      p.shortBreak === settings.durations.shortBreak &&
      p.longBreak === settings.durations.longBreak
    )
  })

  return (
    <div className="mx-auto max-w-4xl py-6">
      <h1 className="sr-only">Settings</h1>
      <SectionNav />

      <Section
        id="timer"
        title="Timer"
        description="How long each phase lasts, and how often the long break comes round."
      >
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-ink-100 text-sm">Preset</span>
            {!preset && <span className="text-ink-600 text-xs">Custom</span>}
          </div>
          <div role="radiogroup" aria-label="Duration preset" className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(DURATION_PRESETS) as PresetName[]).map((name) => {
              const p = DURATION_PRESETS[name]
              const selected = preset === name
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update(applyPreset(settings, name))}
                  className={`focus-visible:outline-ink-300 rounded-xl border p-3 text-left transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none ${
                    selected
                      ? 'border-focus bg-ink-900'
                      : 'border-ink-800 hover:border-ink-600 hover:bg-ink-900/60'
                  }`}
                >
                  <span className="tabular block text-sm font-medium">{p.label}</span>
                  <span className="text-ink-600 mt-1 block text-xs">
                    {p.focus} min focus · {p.shortBreak} min break · {p.longBreak} min long
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <NumberField
          label="Focus"
          suffix="min"
          value={settings.durations.focus}
          onChange={(focus) => update({ durations: { ...settings.durations, focus } })}
        />
        <NumberField
          label="Short break"
          suffix="min"
          max={120}
          value={settings.durations.shortBreak}
          onChange={(shortBreak) => update({ durations: { ...settings.durations, shortBreak } })}
        />
        <NumberField
          label="Long break"
          suffix="min"
          value={settings.durations.longBreak}
          onChange={(longBreak) => update({ durations: { ...settings.durations, longBreak } })}
        />
        <NumberField
          label="Long break every"
          suffix="focus"
          max={12}
          value={settings.longBreakEvery}
          onChange={(longBreakEvery) => update({ longBreakEvery })}
        />

        <CycleSummary settings={settings} />
      </Section>

      <Section id="flow" title="Flow" description="What happens when a phase reaches zero.">
        <OptionCards
          label="Timer behaviour"
          value={settings.mode}
          onChange={(mode) => update({ mode })}
          options={[
            {
              value: 'classic',
              label: 'Classic',
              description: 'The timer stops dead at zero. The original technique.',
            },
            {
              value: 'overtime',
              label: 'Overtime',
              description: 'It keeps counting past zero, so you decide when to stop.',
            },
            {
              value: 'flowtime',
              label: 'Flowtime',
              description: 'No deadline at all; the break is sized from what you worked.',
            },
          ]}
        />

        <Toggle
          label="Never stop on its own"
          hint="Breaks and focus sessions both start themselves — an endless cycle you never restart by hand."
          checked={settings.autoStartBreaks && settings.autoStartFocus}
          onChange={(endless) => update({ autoStartBreaks: endless, autoStartFocus: endless })}
        />
        {!(settings.autoStartBreaks && settings.autoStartFocus) && (
          <div className="border-ink-800 flex flex-col gap-4 rounded-xl border p-4">
            <Toggle
              label="Start breaks automatically"
              checked={settings.autoStartBreaks}
              onChange={(autoStartBreaks) => update({ autoStartBreaks })}
            />
            <Toggle
              label="Start the next focus automatically"
              checked={settings.autoStartFocus}
              onChange={(autoStartFocus) => update({ autoStartFocus })}
            />
          </div>
        )}

        <NumberField
          label="Daily goal"
          hint="Shown as a progress bar on the stats page. Set to 0 to hide it."
          suffix="min"
          min={0}
          max={1440}
          value={settings.dailyGoalMinutes}
          onChange={(dailyGoalMinutes) => update({ dailyGoalMinutes })}
        />
      </Section>

      <Section
        id="appearance"
        title="Appearance"
        description="Watching the seconds tick down stresses a lot of people. You can hide them."
      >
        <OptionCards
          label="Theme"
          value={settings.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: 'system', label: 'Auto', description: 'Follows your device, live.' },
            { value: 'light', label: 'Light', description: 'Always the light palette.' },
            { value: 'dark', label: 'Dark', description: 'Always the dark palette.' },
          ]}
        />
        <Choice
          label="Time display"
          hint={displayHint(settings.display)}
          value={settings.display}
          onChange={(display) => update({ display })}
          options={[
            { value: 'exact', label: 'Exact' },
            { value: 'approximate', label: 'Rough' },
            { value: 'percent', label: '%' },
            { value: 'hidden', label: 'Hidden' },
          ]}
        />
      </Section>

      <Section
        id="sound"
        title="Sound"
        description="Scheduled on the audio clock, so it rings on time even in a throttled tab."
      >
        <Toggle
          label="Play a sound when a phase ends"
          checked={settings.sound.enabled}
          onChange={(enabled) => update({ sound: { ...settings.sound, enabled } })}
        />
        <Row
          label="Alarm"
          hint={
            muted
              ? 'The volume is at zero, so nothing will play.'
              : 'Pick one and hear it straight away.'
          }
        >
          <div className="flex items-center gap-3">
            <div role="radiogroup" aria-label="Alarm" className="flex flex-wrap gap-2">
              {ALARMS.map((alarm) => (
                <button
                  key={alarm}
                  type="button"
                  role="radio"
                  aria-checked={settings.sound.alarm === alarm}
                  onClick={() => {
                    update({ sound: { ...settings.sound, alarm } })
                    void sound.unlock().then(() => sound.playNow(alarm, settings.sound.volume))
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors duration-150 motion-reduce:transition-none ${
                    settings.sound.alarm === alarm
                      ? 'border-focus bg-ink-900 text-ink-100'
                      : 'border-ink-800 text-ink-600 hover:border-ink-600 hover:text-ink-300'
                  }`}
                >
                  {alarm}
                </button>
              ))}
            </div>
            {/* Next to the alarms rather than to the volume: it plays *this
                sound*, and beside the slider everyone read it as a volume test. */}
            <Button
              size="sm"
              aria-label="Play the alarm"
              disabled={muted}
              onClick={() =>
                void sound.unlock().then(() => {
                  sound.playNow(settings.sound.alarm as AlarmName, settings.sound.volume)
                })
              }
            >
              Play
            </Button>
          </div>
        </Row>
        <Row label="Volume">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(settings.sound.volume * 100)}
            aria-label="Volume"
            onChange={(e) =>
              update({ sound: { ...settings.sound, volume: Number(e.target.value) / 100 } })
            }
            className="accent-focus w-32"
          />
        </Row>
        <Toggle
          label="Ticking"
          hint="The mechanical timer sound, during focus sessions."
          checked={settings.sound.ticking}
          onChange={(ticking) => update({ sound: { ...settings.sound, ticking } })}
        />
      </Section>

      <Section
        id="alerts"
        title="Alerts"
        description="What reaches you when you’re looking elsewhere."
      >
        <Toggle
          label="System notifications"
          checked={settings.notifications.enabled}
          onChange={(enabled) => update({ notifications: { ...settings.notifications, enabled } })}
        />

        <div className="border-ink-800 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">Browser permission</span>
              <StatusPill
                tone={permission === 'granted' ? 'ok' : permission === 'denied' ? 'warn' : 'muted'}
              >
                {permission === 'granted'
                  ? 'Allowed'
                  : permission === 'denied'
                    ? 'Blocked'
                    : permission === 'unsupported'
                      ? 'Unsupported'
                      : 'Not asked yet'}
              </StatusPill>
            </div>
            <p className="text-ink-600 mt-1 text-xs">
              {permission === 'denied'
                ? 'Only you can undo this, from your browser’s site settings for this page.'
                : permission === 'granted'
                  ? 'basilico can post a notification when a phase ends.'
                  : 'Nothing is asked until you press the button.'}
            </p>
          </div>
          <Button
            disabled={permission !== 'default'}
            onClick={() => void requestPermission().then(setPermission)}
          >
            Allow notifications
          </Button>
        </div>

        <div className="border-ink-800 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm">Chrome extension</span>
              <StatusPill tone={extensionVersion ? 'ok' : 'muted'}>
                {extensionVersion ? `Installed · v${extensionVersion}` : 'Not installed'}
              </StatusPill>
            </div>
            <p className="text-ink-600 mt-1 text-xs">
              {extensionVersion
                ? 'Your sessions ring even when this tab is closed.'
                : 'Without it, no notification can fire once the tab is closed — the web can’t do that without a server. basilico catches up when you come back instead.'}
            </p>
          </div>
          {!extensionVersion && (
            <a
              href="https://github.com/maxgfr/basilico#chrome-extension"
              target="_blank"
              rel="noreferrer"
              className="text-ink-300 hover:text-ink-100 text-sm underline underline-offset-4"
            >
              How to install it
            </a>
          )}
        </div>

        <Toggle
          label="Warn me before the end"
          hint="A heads-up 60 s before a focus ends, 30 s before a break does."
          checked={settings.notifications.staged}
          onChange={(staged) => update({ notifications: { ...settings.notifications, staged } })}
        />
        <Toggle
          label="Keep the screen awake"
          hint="During focus sessions only. Uses battery."
          checked={settings.wakeLock}
          onChange={(wakeLock) => update({ wakeLock })}
        />
      </Section>

      <Section
        id="storage"
        title="Storage"
        description="Browsers delete data from sites they consider inactive."
      >
        <Row
          label="Persistent storage"
          hint={
            persisted === true
              ? 'Granted — your browser won’t evict this data to reclaim space.'
              : 'Not granted. Installing the app or allowing notifications improves your odds.'
          }
        >
          <div className="flex items-center gap-3">
            <StatusPill tone={persisted === true ? 'ok' : 'muted'}>
              {persisted === true ? 'Granted' : 'Best effort'}
            </StatusPill>
            <Button
              disabled={persisted === true}
              onClick={() => void navigator.storage?.persist?.().then(setPersisted)}
            >
              Request
            </Button>
          </div>
        </Row>
      </Section>

      <DataSection />

      <Section id="shortcuts" title="Keyboard shortcuts">
        <dl className="grid grid-cols-[5rem_1fr] gap-y-2 text-sm">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.keys} className="contents">
              <dt>
                <kbd className="border-ink-800 bg-ink-900 text-ink-300 rounded border px-2 py-0.5 text-xs">
                  {shortcut.keys}
                </kbd>
              </dt>
              <dd className="text-ink-600">{shortcut.label}</dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  )
}

function SectionNav() {
  return (
    <nav aria-label="Settings sections" className="mb-8">
      <ul className="flex flex-wrap gap-1.5">
        {SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="border-ink-800 text-ink-600 hover:border-ink-600 hover:text-ink-100 block rounded-full border px-3 py-1 text-xs transition-colors duration-150 motion-reduce:transition-none"
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * A summary of the full cycle. Four numbers taken separately don't tell you what
 * they add up to; this sentence does.
 */
function CycleSummary({ settings }: { settings: Settings }) {
  const { focus, shortBreak, longBreak } = settings.durations
  const n = settings.longBreakEvery
  const totalMs = (focus * n + shortBreak * (n - 1) + longBreak) * 60_000

  return (
    <p className="border-ink-800 bg-ink-900/40 text-ink-300 rounded-xl border p-4 text-sm">
      One full cycle: <strong className="text-ink-100 font-medium">{n}</strong> focus sessions of{' '}
      <strong className="text-ink-100 font-medium">{focus} min</strong>, separated by {n - 1} short
      breaks, then a {longBreak}-minute long break — about{' '}
      <strong className="text-ink-100 font-medium">{formatDuration(totalMs)}</strong> in total.
      {settings.autoStartBreaks && settings.autoStartFocus && ' It then starts over on its own.'}
    </p>
  )
}

function displayHint(display: Settings['display']): string {
  if (display === 'exact') return 'The full countdown, down to the second.'
  if (display === 'approximate') return 'Rounded to the minute: “about 24 minutes”.'
  if (display === 'percent') return 'How far along you are, as a percentage.'
  return 'No numbers at all — only the ring moves.'
}
