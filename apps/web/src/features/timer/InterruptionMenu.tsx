import { useEffect, useRef, useState } from 'react'
import { useApp } from '../../store/app'
import { Button } from '../../ui/Button'

/**
 * The two ways a session survives an interruption, behind one trigger.
 *
 * These used to sit permanently under the timer with a paragraph of explanation,
 * on a screen whose entire job is to be quiet — and it still didn't land, people
 * asked what the controls meant anyway. Explaining a control in prose beside it
 * is the tell that the control isn't self-explanatory, so each action now
 * carries its own one-line meaning, read as you reach for it.
 *
 * Abandoning lives outside this menu: it ends the session rather than
 * annotating it, and burying an action of that weight one level down made it
 * read like a third kind of interruption.
 */
export function InterruptionMenu() {
  const timer = useApp((s) => s.timer)
  const interrupt = useApp((s) => s.interrupt)

  const [open, setOpen] = useState(false)
  const [top, setTop] = useState(0)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  const total = timer.interruptions.internal + timer.interruptions.external

  /**
   * The panel is fixed to the viewport and centred on it, not on the trigger.
   *
   * Centring on the trigger pushed it flush against the edge on a narrow screen,
   * and clamping the width didn't help — the overflow came from where it was
   * centred, not how wide it was. Only its vertical placement follows the
   * trigger, from a single measurement taken when it opens.
   */
  useEffect(() => {
    if (!open) return
    const box = trigger.current?.getBoundingClientRect()
    if (box) setTop(box.bottom + 8)
  }, [open])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Escape must hand focus back, or the keyboard is left nowhere.
      trigger.current?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (timer.mode !== 'focus' || timer.status === 'idle') return null

  return (
    <div ref={container} className="relative">
      <Button
        ref={trigger}
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        Interrupted?
        {total > 0 && (
          <span className="bg-ink-800 text-ink-300 tabular rounded-full px-1.5 text-xs">
            {total}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Interruptions"
          style={{ top }}
          className="border-ink-800 bg-ink-950 fixed left-1/2 z-20 w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-xl border p-2 shadow-2xl"
        >
          <MenuItem
            label="I interrupted myself"
            meaning="Note it and keep going — the session survives."
            count={timer.interruptions.internal}
            onClick={() => interrupt('internal')}
          />
          <MenuItem
            label="Someone interrupted me"
            meaning="Note it and keep going — the session survives."
            count={timer.interruptions.external}
            onClick={() => interrupt('external')}
          />
        </div>
      )}
    </div>
  )
}

function MenuItem({
  label,
  meaning,
  count,
  onClick,
}: {
  label: string
  meaning: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:bg-ink-900 focus-visible:outline-ink-300 block w-full rounded-lg px-3 py-2 text-left transition-colors duration-150 focus-visible:outline-2 motion-reduce:transition-none"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm">{label}</span>
        {count !== undefined && count > 0 && (
          <span className="text-ink-600 tabular text-xs">{count}</span>
        )}
      </span>
      <span className="text-ink-600 mt-0.5 block text-xs leading-relaxed">{meaning}</span>
    </button>
  )
}
