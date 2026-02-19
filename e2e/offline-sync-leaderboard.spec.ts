import { expect, test } from '@playwright/test'

test('queues score offline, syncs on reconnect, then shows leaderboard entry', async ({ context, page }) => {
  test.setTimeout(60000)
  let syncSeen = false

  await page.addInitScript(() => {
    localStorage.setItem('authToken', 'e2e-auth-token')
    localStorage.setItem('userId', 'e2e-user-1')
  })

  await page.route('**/auth/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        user: {
          id: 'e2e-user-1',
          email: 'e2e-user@example.com',
          name: 'TestUser',
          authType: 'google',
        },
      }),
    })
  })

  await page.route('**/sync/daily-scores', async (route) => {
    syncSeen = true
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        synced: 1,
        created: 1,
        updated: 0,
        skippedWorseOrDuplicate: 0,
        rejectedReplay: 0,
        message: 'Synced 1 entries',
      }),
    })
  })

  await page.route('**/sync/achievements', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, synced: 0 }),
    })
  })

  await page.route('**/leaderboard/daily**', async (route) => {
    const payload = syncSeen
      ? {
          date: '2026-02-18',
          count: 1,
          entries: [
            {
              rank: 1,
              userId: 'e2e-user-1',
              displayName: 'TestUser',
              score: 95,
              timeTaken: 10000,
            },
          ],
        }
      : { date: '2026-02-18', count: 0, entries: [] }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    })
  })

  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Start Puzzle' })).toBeVisible()

  const answer = await page.evaluate(async () => {
    const module = await import('/src/engines/puzzleEngine.ts')
    const today = new Date().toISOString().slice(0, 10)
    const puzzle = module.generatePuzzle(new Date(today))
    return String(puzzle.solution.answer)
  })

  await context.setOffline(true)
  await page.getByRole('button', { name: 'Start Puzzle' }).click()
  await page.getByPlaceholder('Enter answer...').fill(answer)
  await page.getByRole('button', { name: 'Submit Answer' }).click()
  await expect(page.getByText('Puzzle Completed!')).toBeVisible()

  expect(syncSeen).toBe(false)

  await context.setOffline(false)
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'))
  })

  await expect.poll(() => syncSeen).toBe(true)

  await page.reload()
  await expect(page.getByText('#1 TestUser')).toBeVisible()
})
