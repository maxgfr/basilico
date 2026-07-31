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
      text: `Imported ${result.backup.sessions.length} sessions and ${result.backup.tasks.length} tasks.`,
    })
  }

  return (
    <Section
      id="data"
      title="Your data"
      description="Everything lives in this browser. A regular export is the only real backup."
    >
      <Row
        label="Full backup"
        hint="Settings, tasks and history. This is the file you import back."
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
          Export JSON
        </Button>
      </Row>

      <Row label="Session history" hint="For a spreadsheet: one row per session.">
        <Button
          variant="ghost"
          disabled={sessions.length === 0}
          onClick={() => download(`basilico-sessions-${stamp()}.csv`, toCsv(sessions), 'text/csv')}
        >
          Export CSV
        </Button>
      </Row>

      <Row
        label="Open Pomodoro Format"
        hint="Interoperable with other tools that speak the format. Completed focus sessions only."
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
          Export
        </Button>
      </Row>

      <Row label="Import" hint="Replaces everything currently stored.">
        <>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label="Backup file to import"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onImport(file)
              e.target.value = ''
            }}
          />
          <Button onClick={() => fileInput.current?.click()}>Choose a file</Button>
        </>
      </Row>

      {message && (
        <output className={`text-sm ${message.tone === 'error' ? 'text-danger' : 'text-focus'}`}>
          {message.text}
        </output>
      )}

      <Row
        label="Erase everything"
        hint={`${sessions.length} sessions and ${tasks.length} tasks would be deleted for good.`}
      >
        {confirmingReset ? (
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              onClick={() => {
                clearEverything()
                setConfirmingReset(false)
                setMessage({ tone: 'ok', text: 'Data erased.' })
              }}
            >
              Yes, erase it all
            </Button>
            <Button variant="ghost" onClick={() => setConfirmingReset(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setConfirmingReset(true)}>
            Erase
          </Button>
        )}
      </Row>
    </Section>
  )
}
