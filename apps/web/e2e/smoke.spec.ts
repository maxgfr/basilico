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

test('a session that ended while away is caught up', async ({ page }) => {
  await page.getByRole('button', { name: 'Start' }).click()

  // Forty minutes pass: the session ended at its deadline, fifteen minutes ago.
  await page.clock.fastForward('40:00')

  await expect(page.getByText(/ended/)).toBeVisible()
  await expect(page.getByText(/15 minutes ago/)).toBeVisible()
  // Nothing chained on its own: the break waits for a decision.
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()

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

test('row actions are reachable on both pointer kinds', async ({ page }, testInfo) => {
  await page.getByLabel('Task title').fill('Reachable task')
  await page.getByRole('button', { name: 'Add' }).click()

  const rename = page.getByRole('button', { name: 'Rename Reachable task' })
  const more = page.getByRole('button', { name: 'Actions for Reachable task' })

  if (testInfo.project.name === 'mobile') {
    // No hover here, so a permanent disclosure is the only discoverable route.
    // The earlier CSS-only attempt left the hover overlay in the DOM, where it
    // reappeared on focus and swallowed this button's tap.
    await expect(more).toBeVisible()
    await expect(rename).toHaveCount(0)
    await more.tap()
    await expect(more).toHaveAttribute('aria-expanded', 'true')
    await expect(rename).toBeVisible()
  } else {
    // A pointer device keeps the hover overlay and never shows the disclosure,
    // so the same action is never announced twice.
    await expect(more).toHaveCount(0)
    await page.getByRole('listitem').filter({ hasText: 'Reachable task' }).hover()
    await expect(rename).toBeVisible()
  }
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
