import { expect, test } from '@playwright/test'

const START = new Date('2026-07-31T09:00:00')

test.beforeEach(async ({ page }) => {
  // Controlled clock: we test a 25-minute focus without waiting 25 minutes, and
  // above all we verify that the absolute deadline is what counts.
  await page.clock.install({ time: START })
  await page.goto('/')
})

test('a completed focus credits the task and fills the stats', async ({ page }) => {
  await page.getByLabel('Task title').fill('Write the core')
  await page.getByRole('button', { name: 'Add' }).click()

  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('timer')).toContainText('24:5')

  await page.clock.fastForward('25:01')

  // The break chains on, and the session has just been recorded.
  await expect(page.getByRole('timer')).toContainText('04:5')
  await expect(page.getByRole('timer')).toHaveAccessibleName(/Short break/)
  await expect(page.getByTitle(/1 of 1 estimated/).first()).toBeVisible()

  await page
    .getByRole('navigation', { name: 'Sections', exact: true })
    .getByRole('link', { name: 'Stats' })
    .click()
  await expect(page.getByText('Pomodoros today')).toBeVisible()
  await expect(page.getByRole('table', { name: /Last fourteen days/ })).toBeAttached()
})

test('state survives a reload and time keeps running', async ({ page }) => {
  await page.getByRole('button', { name: 'Start' }).click()
  await page.clock.fastForward('05:00')
  await page.reload()

  // Reloading does not reset the counter to 25: the deadline is what counts.
  await expect(page.getByRole('timer')).toContainText('19:5')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('a session that ended while away is caught up, and the cycle carries on', async ({ page }) => {
  await page.getByRole('button', { name: 'Start' }).click()

  // Forty minutes pass: the session ended at its deadline, fifteen minutes ago.
  await page.clock.fastForward('40:00')

  await expect(page.getByText(/ended/)).toBeVisible()
  await expect(page.getByText(/15 minutes ago/)).toBeVisible()

  // The cycle is set to never stop on its own, so an absence doesn't break it:
  // the break is already running, started on return rather than back-dated.
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(page.getByRole('timer')).toHaveAccessibleName(/Short break/)
  await expect(page.getByRole('timer')).toContainText('04:5')

  // And the message survives a reload: the person who closed their tab is
  // precisely the one who needs to read it.
  await page.reload()
  await expect(page.getByText(/15 minutes ago/)).toBeVisible()
})

test('export then erase then import restores the state', async ({ page }) => {
  await page.getByLabel('Task title').fill('Task to back up')
  await page.getByRole('button', { name: 'Add' }).click()

  await page
    .getByRole('navigation', { name: 'Sections', exact: true })
    .getByRole('link', { name: 'Settings' })
    .click()
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ]).then(([event]) => event)
  const path = await download.path()

  await page.getByRole('button', { name: 'Erase' }).click()
  await page.getByRole('button', { name: 'Yes, erase it all' }).click()
  await expect(page.getByText('Data erased.')).toBeVisible()

  await page.getByRole('button', { name: 'Choose a file' }).click()
  await page.locator('input[type="file"]').setInputFiles(path)
  await expect(page.getByText(/Imported 0 sessions and 1 tasks/)).toBeVisible()

  await page
    .getByRole('navigation', { name: 'Sections', exact: true })
    .getByRole('link', { name: 'Timer' })
    .click()
  await expect(page.getByText('Task to back up')).toBeVisible()
})

test('row actions live in one menu, identical on every device', async ({ page }) => {
  await page.getByLabel('Task title').fill('Reachable task')
  await page.getByRole('button', { name: 'Add' }).click()

  const more = page.getByRole('button', { name: 'Actions for Reachable task' })
  const menu = page.getByRole('dialog', { name: 'Actions for Reachable task' })

  // Permanently visible and the same everywhere: hover is not an affordance a
  // phone has, and the two branches this replaces could drift apart.
  await expect(more).toBeVisible()
  const box = await more.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(44)
  expect(box?.height).toBeGreaterThanOrEqual(44)

  await more.click()
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Edit' })).toBeVisible()

  // Every destructive action says what it costs before you reach it.
  await expect(menu).toContainText('Cannot be undone')

  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(more).toBeFocused()
})

test('a task carries a description you can come back to', async ({ page }) => {
  await page.getByLabel('Task title').fill('Ship the parser')
  await page.getByRole('button', { name: 'Add' }).click()

  await page.getByRole('button', { name: 'Actions for Ship the parser' }).click()
  await page.getByRole('button', { name: 'Edit' }).click()

  await page
    .getByLabel('Description of Ship the parser')
    .fill('Behind the flag, and only the parser')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByText('Behind the flag, and only the parser')).toBeVisible()

  // And it survives a reload, like the rest of the list.
  await page.reload()
  await expect(page.getByText('Behind the flag, and only the parser')).toBeVisible()
})

test('switch knobs stay inside their track', async ({ page }) => {
  await page.goto('/#/settings')

  const geometry = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[role=switch]')].map((sw) => {
        const track = sw.getBoundingClientRect()
        const knob = (sw.firstElementChild as HTMLElement).getBoundingClientRect()
        return { checked: sw.getAttribute('aria-checked') === 'true', track, knob }
      }),
    )

  const toggle = page.getByRole('switch').first()
  for (const _ of [0, 1]) {
    // The knob slides over 150 ms; measuring mid-flight reads the old side.
    await page.waitForTimeout(300)
    for (const { checked, track, knob } of await geometry()) {
      // The knob used to escape the track entirely: absolutely positioned with no
      // horizontal anchor, it started from the button's centred static position
      // and the translate pushed it past the right edge — in both states.
      expect(knob.left).toBeGreaterThanOrEqual(track.left)
      expect(knob.right).toBeLessThanOrEqual(track.right)
      // And it must actually move, otherwise the state isn't readable at a glance.
      const nearerLeft = knob.left - track.left < track.right - knob.right
      expect(nearerLeft).toBe(!checked)
    }
    await toggle.click()
  }
})

test('the interruption menu explains itself and closes politely', async ({ page }) => {
  await page.getByRole('button', { name: 'Start' }).click()

  const trigger = page.getByRole('button', { name: /Interrupted\?/ })
  await trigger.click()
  const menu = page.getByRole('dialog', { name: 'Interruptions' })
  await expect(menu).toBeVisible()

  // Each action states what it does, rather than a paragraph pinned to the page.
  await expect(menu).toContainText('the session survives')
  // Abandoning is not in here: it ends the session rather than annotating it.
  await expect(menu.getByText('Abandon this one')).toHaveCount(0)

  await page.getByRole('button', { name: /Someone interrupted me/ }).click()
  await expect(trigger).toContainText('1')
  // Counting an interruption must not end the session — abandoning is for that.
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(trigger).toBeFocused()
})

test('the cycle never hands control back on its own', async ({ page }) => {
  // The reported bug: Start, then Skip twice, and the timer sat on "Start".
  await page.getByRole('button', { name: 'Start' }).click()

  for (const mode of ['Short break', 'Focus', 'Short break', 'Focus']) {
    await page.getByRole('button', { name: 'Skip' }).click()
    // The phase advanced *and* it is running: "Pause" is only shown when it is.
    await expect(page.getByRole('timer')).toHaveAttribute('aria-label', new RegExp(`^${mode},`))
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  }
})

test('a focus session can be ended by hand and still count', async ({ page }) => {
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Done — count it' }).click()

  // It chains straight into the break, and the pomodoro is on the board.
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(page.getByText('How did that session go?')).toBeVisible()
})

test('today and the backlog are two different lists', async ({ page }) => {
  await page.getByLabel('Task title').fill('Do it now')
  await page.getByRole('button', { name: 'Add' }).click()

  const today = page.getByRole('region', { name: 'Today' })
  const backlogList = page.getByRole('region', { name: 'Backlog' })
  // A task you just typed is almost always one you are about to do, so it lands
  // on today rather than making you fish it back out of an inventory.
  await expect(today.getByText('Do it now')).toBeVisible()
  // The backlog is there before anything is in it: it is half the model, and
  // hidden until it happened to be non-empty nobody could discover it.
  await expect(backlogList).toBeVisible()
  await expect(backlogList.getByText('Do it now')).toHaveCount(0)

  await page.getByRole('button', { name: 'Actions for Do it now' }).click()
  await page.getByRole('button', { name: 'Move to the backlog' }).click()

  await expect(backlogList.getByText('Do it now')).toBeVisible()
  await expect(today.getByText('Do it now')).toHaveCount(0)
})

test('an archived task can still be found and brought back', async ({ page }) => {
  await page.getByLabel('Task title').fill('Someday maybe')
  await page.getByRole('button', { name: 'Add' }).click()

  await page.getByRole('button', { name: 'Actions for Someday maybe' }).click()
  await page.getByRole('button', { name: 'Archive' }).click()

  // Archiving used to take a task out of every screen there is.
  const drawer = page.getByText('1 archived')
  await expect(drawer).toBeVisible()
  await drawer.click()

  await page.getByRole('button', { name: 'Restore' }).click()
  await expect(
    page.getByRole('region', { name: 'Backlog' }).getByText('Someday maybe'),
  ).toBeVisible()
})
