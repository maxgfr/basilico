import { useEffect, useState } from 'react'
import { useApp } from '../../store/app'
import { Button } from '../../ui/Button'

/**
 * One line, before the session: what is this focus for?
 *
 * Only offered while the timer is idle and on a focus phase — asking mid-session
 * would interrupt exactly what the tool exists to protect.
 */
export function IntentionField() {
  const timer = useApp((s) => s.timer)
  const setIntention = useApp((s) => s.setIntention)

  if (timer.status !== 'idle' || timer.mode !== 'focus') return null

  return (
    <input
      value={timer.intention ?? ''}
      onChange={(e) => setIntention(e.target.value === '' ? null : e.target.value)}
      placeholder="What is this session for? (optional)"
      aria-label="Session intention"
      className="border-ink-800 bg-ink-900/60 placeholder:text-ink-600 focus:border-ink-600 h-10 w-full max-w-sm rounded-lg border px-3 text-center text-sm outline-none"
    />
  )
}

const RATINGS = [1, 2, 3, 4, 5] as const

/**
 * After a focus session: how did it go, and anything worth remembering.
 *
 * This is the only write the append-only log accepts, and it is deliberately
 * dismissible: a prompt you cannot skip becomes a toll on every single session.
 */
export function SessionLog() {
  const lastEnded = useApp((s) => s.lastEnded)
  const annotate = useApp((s) => s.annotateLast)
  const dismiss = useApp((s) => s.dismissEnded)
  const [note, setNote] = useState('')

  const record = lastEnded?.record
  const id = record?.id

  // A fresh session means a fresh note field, otherwise the previous one's text
  // would be sitting there waiting to be attributed to the wrong session.
  useEffect(() => setNote(''), [id])

  if (!record || record.mode !== 'focus' || record.outcome === 'skipped') return null

  return (
    <div className="border-ink-800 bg-ink-900/40 flex w-full max-w-md flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">How did that session go?</span>
        <Button variant="ghost" size="sm" onClick={dismiss}>
          Dismiss
        </Button>
      </div>

      {record.intention && (
        <p className="text-ink-600 text-xs">
          Intention: <span className="text-ink-300">{record.intention}</span>
        </p>
      )}

      <div role="radiogroup" aria-label="Session rating" className="flex items-center gap-1.5">
        {RATINGS.map((value) => {
          const selected = record.rating === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${value} out of 5`}
              onClick={() => annotate({ rating: selected ? null : value })}
              className={`tabular focus-visible:outline-ink-300 h-8 w-8 rounded-lg border text-sm transition-colors duration-150 focus-visible:outline-2 motion-reduce:transition-none ${
                selected
                  ? 'border-focus bg-focus/15 text-focus'
                  : 'border-ink-800 text-ink-600 hover:border-ink-600 hover:text-ink-300'
              }`}
            >
              {value}
            </button>
          )
        })}
      </div>

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          annotate({ note: note.trim() === '' ? null : note.trim() })
          setNote('')
        }}
      >
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={record.note ?? 'Anything worth remembering?'}
          aria-label="Session note"
          className="border-ink-800 bg-ink-950 placeholder:text-ink-600 focus:border-ink-600 h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none"
        />
        <Button type="submit" size="sm" disabled={note.trim() === ''}>
          Save
        </Button>
      </form>

      {record.note && note === '' && <p className="text-focus text-xs">Saved: {record.note}</p>}
    </div>
  )
}
