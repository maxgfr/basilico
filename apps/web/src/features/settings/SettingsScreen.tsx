import { useEffect, useState } from 'react'
import { DURATION_PRESETS, applyPreset, type PresetName } from '@basilico/core'
import { useApp } from '../../store/app'
import { Button } from '../../ui/Button'
import { Choice, NumberField, Row, Section, Toggle } from '../../ui/Form'
import { sound } from '../../platform/sound'
import { permissionState, requestPermission } from '../../platform/notifications'
import type { AlarmName } from '../../platform/sound'
import { SHORTCUTS } from '../timer/shortcuts'
import { DataSection } from './DataSection'

export function SettingsScreen() {
  const settings = useApp((s) => s.settings)
  const update = useApp((s) => s.updateSettings)
  const [permission, setPermission] = useState(permissionState)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted)
  }, [])

  const preset = (Object.keys(DURATION_PRESETS) as PresetName[]).find((name) => {
    const p = DURATION_PRESETS[name]
    return (
      p.focus === settings.durations.focus &&
      p.shortBreak === settings.durations.shortBreak &&
      p.longBreak === settings.durations.longBreak
    )
  })

  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="sr-only">Réglages</h1>

      <Section title="Durées" description="Le rythme classique est 25/5, mais rien ne t’y oblige.">
        <Row label="Préréglage" hint="Applique les trois durées d’un coup.">
          <div className="bg-ink-900 flex rounded-lg p-1">
            {(Object.keys(DURATION_PRESETS) as PresetName[]).map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={preset === name}
                onClick={() => update(applyPreset(settings, name))}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-150 motion-reduce:transition-none ${
                  preset === name
                    ? 'bg-ink-800 text-ink-100'
                    : 'text-ink-600 hover:text-ink-300 hover:bg-ink-800/60'
                }`}
              >
                {DURATION_PRESETS[name].label}
              </button>
            ))}
          </div>
        </Row>

        <NumberField
          label="Focus"
          suffix="min"
          value={settings.durations.focus}
          onChange={(focus) => update({ durations: { ...settings.durations, focus } })}
        />
        <NumberField
          label="Pause courte"
          suffix="min"
          max={120}
          value={settings.durations.shortBreak}
          onChange={(shortBreak) => update({ durations: { ...settings.durations, shortBreak } })}
        />
        <NumberField
          label="Pause longue"
          suffix="min"
          value={settings.durations.longBreak}
          onChange={(longBreak) => update({ durations: { ...settings.durations, longBreak } })}
        />
        <NumberField
          label="Pause longue tous les"
          suffix="focus"
          max={12}
          value={settings.longBreakEvery}
          onChange={(longBreakEvery) => update({ longBreakEvery })}
        />
      </Section>

      <Section
        title="Rythme"
        description="Comment le minuteur se comporte quand une phase se termine."
      >
        <Choice
          label="Mode"
          hint={
            settings.mode === 'classic'
              ? 'Le minuteur s’arrête net à zéro.'
              : settings.mode === 'overtime'
                ? 'Le compteur continue au-delà de zéro : à toi de décider quand t’arrêter.'
                : 'Chronomètre libre, la pause proposée est proportionnelle au temps travaillé.'
          }
          value={settings.mode}
          onChange={(mode) => update({ mode })}
          options={[
            { value: 'classic', label: 'Classique' },
            { value: 'overtime', label: 'Overtime' },
            { value: 'flowtime', label: 'Flowtime' },
          ]}
        />
        <Toggle
          label="Enchaîner les pauses"
          hint="La pause démarre toute seule quand le focus se termine."
          checked={settings.autoStartBreaks}
          onChange={(autoStartBreaks) => update({ autoStartBreaks })}
        />
        <Toggle
          label="Enchaîner les focus"
          hint="Le focus suivant démarre tout seul à la fin de la pause."
          checked={settings.autoStartFocus}
          onChange={(autoStartFocus) => update({ autoStartFocus })}
        />
        <NumberField
          label="Objectif quotidien"
          suffix="min"
          min={0}
          max={1440}
          value={settings.dailyGoalMinutes}
          onChange={(dailyGoalMinutes) => update({ dailyGoalMinutes })}
        />
      </Section>

      <Section
        title="Affichage"
        description="Regarder les secondes s’égrener stresse beaucoup de gens. Tu peux les cacher."
      >
        <Choice
          label="Temps affiché"
          value={settings.display}
          onChange={(display) => update({ display })}
          options={[
            { value: 'exact', label: 'Exact' },
            { value: 'approximate', label: 'Approché' },
            { value: 'percent', label: '%' },
            { value: 'hidden', label: 'Caché' },
          ]}
        />
        <Choice
          label="Format d’heure"
          value={String(settings.hourFormat) as '12' | '24'}
          onChange={(value) => update({ hourFormat: value === '12' ? 12 : 24 })}
          options={[
            { value: '24', label: '24 h' },
            { value: '12', label: '12 h' },
          ]}
        />
      </Section>

      <Section title="Son" description="Programmé sur l’horloge audio : il sonne à l’heure.">
        <Toggle
          label="Sonnerie de fin"
          checked={settings.sound.enabled}
          onChange={(enabled) => update({ sound: { ...settings.sound, enabled } })}
        />
        <Choice
          label="Sonnerie"
          value={settings.sound.alarm as AlarmName}
          onChange={(alarm) => update({ sound: { ...settings.sound, alarm } })}
          options={[
            { value: 'chime', label: 'Carillon' },
            { value: 'bell', label: 'Cloche' },
            { value: 'blip', label: 'Bip' },
          ]}
        />
        <Row label="Volume">
          <div className="flex items-center gap-3">
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
            <Button
              size="sm"
              onClick={() =>
                void sound.unlock().then(() => {
                  sound.playNow(settings.sound.alarm as AlarmName, settings.sound.volume)
                })
              }
            >
              Écouter
            </Button>
          </div>
        </Row>
        <Toggle
          label="Tic-tac"
          hint="Le bruit du minuteur mécanique, pendant les focus."
          checked={settings.sound.ticking}
          onChange={(ticking) => update({ sound: { ...settings.sound, ticking } })}
        />
      </Section>

      <Section
        title="Alertes"
        description="Une notification système ne peut pas partir si l’onglet est fermé — ça demanderait un serveur."
      >
        <Toggle
          label="Notifications"
          checked={settings.notifications.enabled}
          onChange={(enabled) => update({ notifications: { ...settings.notifications, enabled } })}
        />
        <Row
          label="Autorisation du navigateur"
          hint={
            permission === 'granted'
              ? 'Accordée.'
              : permission === 'denied'
                ? 'Refusée. Seul toi peux la rétablir, dans les réglages du site de ton navigateur.'
                : permission === 'unsupported'
                  ? 'Ce navigateur ne gère pas les notifications.'
                  : 'Pas encore demandée.'
          }
        >
          <Button
            disabled={permission !== 'default'}
            onClick={() => void requestPermission().then(setPermission)}
          >
            {permission === 'granted' ? 'Accordée' : 'Autoriser'}
          </Button>
        </Row>
        <Toggle
          label="Prévenir avant la fin"
          hint="Une alerte 60 s avant la fin d’un focus, 30 s avant la fin d’une pause."
          checked={settings.notifications.staged}
          onChange={(staged) => update({ notifications: { ...settings.notifications, staged } })}
        />
        <Toggle
          label="Garder l’écran allumé"
          hint="Pendant les focus uniquement. Consomme de la batterie."
          checked={settings.wakeLock}
          onChange={(wakeLock) => update({ wakeLock })}
        />
      </Section>

      <Section
        title="Stockage"
        description="Le navigateur peut effacer les données des sites qu’il juge inactifs."
      >
        <Row
          label="Stockage persistant"
          hint={
            persisted === true
              ? 'Accordé : le navigateur ne supprimera pas tes données pour faire de la place.'
              : 'Non accordé. Installer l’app ou accepter les notifications améliore tes chances.'
          }
        >
          <Button
            disabled={persisted === true}
            onClick={() => void navigator.storage?.persist?.().then(setPersisted)}
          >
            {persisted === true ? 'Actif' : 'Demander'}
          </Button>
        </Row>
      </Section>

      <DataSection />

      <Section title="Raccourcis clavier">
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
