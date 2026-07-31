import { useRef, useState } from 'react'
import { parseBackup, toCsv, toOpenPomodoro } from '@basilico/core'
import { useApp } from '../../store/app'
import { Button } from '../../ui/Button'
import { Row, Section } from '../../ui/Form'

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const stamp = () => new Date().toISOString().slice(0, 10)

export function DataSection() {
  const sessions = useApp((s) => s.sessions)
  const tasks = useApp((s) => s.tasks)
  const exportBackup = useApp((s) => s.exportBackup)
  const replaceAll = useApp((s) => s.replaceAll)
  const clearEverything = useApp((s) => s.clearEverything)

  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const onImport = async (file: File) => {
    const result = parseBackup(await file.text())
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error })
      return
    }
    replaceAll(result.backup)
    setMessage({
      tone: 'ok',
      text: `Importé : ${result.backup.sessions.length} sessions et ${result.backup.tasks.length} tâches.`,
    })
  }

  return (
    <Section
      title="Tes données"
      description="Tout est stocké dans ce navigateur. Un export régulier est la seule vraie sauvegarde."
    >
      <Row
        label="Sauvegarde complète"
        hint="Réglages, tâches et historique. C’est ce fichier qu’on réimporte."
      >
        <Button
          onClick={() =>
            download(
              `basilico-${stamp()}.json`,
              JSON.stringify(exportBackup(Date.now()), null, 2),
              'application/json',
            )
          }
        >
          Exporter en JSON
        </Button>
      </Row>

      <Row label="Historique des sessions" hint="Pour un tableur : une ligne par session.">
        <Button
          variant="ghost"
          disabled={sessions.length === 0}
          onClick={() => download(`basilico-sessions-${stamp()}.csv`, toCsv(sessions), 'text/csv')}
        >
          Exporter en CSV
        </Button>
      </Row>

      <Row
        label="Open Pomodoro Format"
        hint="Interopérable avec les autres outils qui parlent ce format. Focus terminés uniquement."
      >
        <Button
          variant="ghost"
          disabled={sessions.length === 0}
          onClick={() =>
            download(
              `basilico-openpomodoro-${stamp()}.json`,
              toOpenPomodoro(sessions, (id) => tasks.find((t) => t.id === id)?.title ?? null),
              'application/json',
            )
          }
        >
          Exporter
        </Button>
      </Row>

      <Row label="Importer" hint="Remplace intégralement les données actuelles.">
        <>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onImport(file)
              e.target.value = ''
            }}
          />
          <Button onClick={() => fileInput.current?.click()}>Choisir un fichier</Button>
        </>
      </Row>

      {message && (
        <output className={`text-sm ${message.tone === 'error' ? 'text-red-300' : 'text-focus'}`}>
          {message.text}
        </output>
      )}

      <Row
        label="Tout effacer"
        hint={`${sessions.length} sessions et ${tasks.length} tâches seront définitivement supprimées.`}
      >
        {confirmingReset ? (
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              onClick={() => {
                clearEverything()
                setConfirmingReset(false)
                setMessage({ tone: 'ok', text: 'Données effacées.' })
              }}
            >
              Confirmer la suppression
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
              Annuler
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmingReset(true)}>
            Effacer
          </Button>
        )}
      </Row>
    </Section>
  )
}
