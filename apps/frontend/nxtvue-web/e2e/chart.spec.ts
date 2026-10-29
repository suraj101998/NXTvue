import { test, expect, type Page } from '@playwright/test'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Quick Login (Test User)' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

test.describe('chart page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('Indian symbol renders the native chart with honest labels and rupee prices', async ({ page }) => {
    await page.goto('/chart/RELIANCE')
    await expect(page.getByRole('heading', { name: 'RELIANCE' })).toBeVisible()
    await expect(page.getByText('Native chart', { exact: false }).first()).toBeVisible()
    await expect(page.locator('canvas').first()).toBeVisible()
    await expect(page.getByText('Last close').first()).toBeVisible()
    await expect(page.getByText('₹').first()).toBeVisible()
    await expect(page.getByText('Technical signal', { exact: false }).first()).toBeVisible()
    // The old hardcoded card must be gone.
    await expect(page.getByText('64.2')).toHaveCount(0)
  })

  test('US symbol uses the live chart and dollar prices', async ({ page }) => {
    await page.goto('/chart/NVDA?market=us')
    await expect(page.getByRole('heading', { name: 'NVDA' })).toBeVisible()
    await expect(page.getByText('Live chart', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('$').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Switch to native chart' })).toBeVisible()
  })

  test('unknown symbol shows a not-found state instead of an empty chart', async ({ page }) => {
    await page.goto('/chart/ZZZZNOTREAL?market=us')
    await expect(page.getByText('Symbol not found')).toBeVisible()
    await expect(page.getByText('No listing found for ZZZZNOTREAL')).toBeVisible()
  })

  test('page state follows the URL on back/forward', async ({ page }) => {
    await page.goto('/chart/RELIANCE')
    await expect(page.getByRole('heading', { name: 'RELIANCE' })).toBeVisible()
    await page.goto('/chart/NVDA?market=us')
    await expect(page.getByRole('heading', { name: 'NVDA' })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'RELIANCE' })).toBeVisible()
  })

  test('Charts nav item is marked current on /chart routes', async ({ page }) => {
    await page.goto('/chart/RELIANCE')
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Charts' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})
