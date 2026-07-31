import { expect, test } from '@playwright/test'

const START = new Date('2026-07-31T09:00:00')

test.beforeEach(async ({ page }) => {
  // Horloge contrôlée : on teste un focus de 25 minutes sans attendre 25 minutes,
  // et surtout on vérifie que l'échéance absolue fait foi.
  await page.clock.install({ time: START })
  await page.goto('/')
})

test('a completed focus credits the task and fills the stats', async ({ page }) => {
  await page.getByLabel('Task title').fill('Write the core')
  await page.getByRole('button', { name: 'Add' }).click()

  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByRole('timer')).toContainText('24:5')

  await page.clock.fastForward('25:01')

  // La pause s'enchaîne, et la session vient d'être enregistrée.
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

  // Le rechargement ne remet pas le compteur à 25 : c'est l'échéance qui compte.
  await expect(page.getByRole('timer')).toContainText('19:5')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('a session that ended while away is caught up', async ({ page }) => {
  await page.getByRole('button', { name: 'Start' }).click()

  // Quarante minutes passent : la session s'est terminée à son échéance, quinze
  // minutes plus tôt.
  await page.clock.fastForward('40:00')

  await expect(page.getByText(/ended/)).toBeVisible()
  await expect(page.getByText(/15 minutes ago/)).toBeVisible()
  // Rien ne s'est enchaîné tout seul : la pause attend une décision.
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()

  // Et le message survit au rechargement : c'est justement quelqu'un qui avait
  // fermé son onglet qui doit le lire.
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
