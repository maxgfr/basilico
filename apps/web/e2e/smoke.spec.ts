import { expect, test } from '@playwright/test'

const START = new Date('2026-07-31T09:00:00')

test.beforeEach(async ({ page }) => {
  // Horloge contrôlée : on teste un focus de 25 minutes sans attendre 25 minutes,
  // et surtout on vérifie que l'échéance absolue fait foi.
  await page.clock.install({ time: START })
  await page.goto('/')
})

test('un focus complet crédite la tâche et remplit les statistiques', async ({ page }) => {
  await page.getByLabel('Titre de la tâche').fill('Écrire le noyau')
  await page.getByRole('button', { name: 'Ajouter' }).click()

  await page.getByRole('button', { name: 'Démarrer' }).click()
  await expect(page.getByRole('timer')).toContainText('24:5')

  await page.clock.fastForward('25:01')

  // La pause s'enchaîne, et la session vient d'être enregistrée.
  await expect(page.getByRole('timer')).toContainText('04:5')
  await expect(page.getByRole('timer')).toHaveAccessibleName(/Pause courte/)
  await expect(page.getByTitle(/1 pomodoro sur 1/).first()).toBeVisible()

  await page.getByRole('link', { name: 'Statistiques' }).click()
  await expect(page.getByText('Pomodoros aujourd’hui')).toBeVisible()
  await expect(page.getByRole('table', { name: /Quatorze derniers jours/ })).toBeAttached()
})

test('l’état survit à un rechargement et le temps continue de courir', async ({ page }) => {
  await page.getByRole('button', { name: 'Démarrer' }).click()
  await page.clock.fastForward('05:00')
  await page.reload()

  // Le rechargement ne remet pas le compteur à 25 : c'est l'échéance qui compte.
  await expect(page.getByRole('timer')).toContainText('19:5')
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('une session terminée pendant une absence est rattrapée', async ({ page }) => {
  await page.getByRole('button', { name: 'Démarrer' }).click()

  // Quarante minutes passent : la session s'est terminée à son échéance, quinze
  // minutes plus tôt.
  await page.clock.fastForward('40:00')

  await expect(page.getByText(/s’est terminé/)).toBeVisible()
  await expect(page.getByText(/il y a 15 minutes/)).toBeVisible()
  // Rien ne s'est enchaîné tout seul : la pause attend une décision.
  await expect(page.getByRole('button', { name: 'Démarrer' })).toBeVisible()

  // Et le message survit au rechargement : c'est justement quelqu'un qui avait
  // fermé son onglet qui doit le lire.
  await page.reload()
  await expect(page.getByText(/il y a 15 minutes/)).toBeVisible()
})

test('export puis suppression puis import restituent l’état', async ({ page }) => {
  await page.getByLabel('Titre de la tâche').fill('Tâche à sauvegarder')
  await page.getByRole('button', { name: 'Ajouter' }).click()

  await page.getByRole('link', { name: 'Réglages' }).click()
  const download = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter en JSON' }).click(),
  ]).then(([event]) => event)
  const path = await download.path()

  await page.getByRole('button', { name: 'Effacer' }).click()
  await page.getByRole('button', { name: 'Confirmer la suppression' }).click()
  await expect(page.getByText('Données effacées.')).toBeVisible()

  await page.getByRole('button', { name: 'Choisir un fichier' }).click()
  await page.locator('input[type="file"]').setInputFiles(path)
  await expect(page.getByText(/Importé : 0 sessions et 1 tâches/)).toBeVisible()

  await page.getByRole('link', { name: 'Minuteur' }).click()
  await expect(page.getByText('Tâche à sauvegarder')).toBeVisible()
})
