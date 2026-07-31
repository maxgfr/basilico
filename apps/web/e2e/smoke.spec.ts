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
