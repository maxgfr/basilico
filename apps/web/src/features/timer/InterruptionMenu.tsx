import { useApp } from '../../store/app'
import { Button } from '../../ui/Button'
import { MenuItem, useMenu } from '../../ui/Menu'

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
  const menu = useMenu('center')

  const total = timer.interruptions.internal + timer.interruptions.external

  if (timer.mode !== 'focus' || timer.status === 'idle') return null

  return (
    <div ref={menu.container} className="relative">
      <Button variant="ghost" {...menu.triggerProps}>
        Interrupted?
        {total > 0 && (
          <span className="bg-ink-800 text-ink-300 tabular rounded-full px-1.5 text-xs">
            {total}
          </span>
        )}
      </Button>

      {menu.open && (
        <div {...menu.panelProps} aria-label="Interruptions">
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
