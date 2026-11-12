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

  test('Indian symbol renders the SVG terminal with rupee prices and the live NSE trader desk', async ({ page }) => {
    await page.goto('/chart/RELIANCE?market=india')
    await expect(page.locator('.nxc .sy')).toHaveText('RELIANCE')
    await expect(page.locator('svg#sv')).toBeVisible()
    await expect(page.getByText('Last close').first()).toBeVisible()
    await expect(page.getByText('₹').first()).toBeVisible()
    await expect(page.getByText('Confluence engine').first()).toBeVisible()
    // The trader desk runs on the NSE profile (IST, ₹) instead of saying it is US-only.
    await expect(page.getByRole('heading', { name: 'Entry timer' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Time machine' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'NSE disclosures' })).toBeVisible()
    await expect(page.getByText('NSE day-trade tools')).toBeVisible()
    await expect(page.getByText('N/A for NSE symbols')).toHaveCount(0)
  })

  test('US symbol renders dollar prices and the live trader desk', async ({ page }) => {
    await page.goto('/chart/NVDA?market=us')
    await expect(page.locator('.nxc .sy')).toHaveText('NVDA')
    await expect(page.locator('svg#sv')).toBeVisible()
    await expect(page.getByText('$').first()).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Entry timer' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Time machine' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Congress trades' })).toBeVisible()
  })

  test('unknown symbol shows a not-found state instead of an empty chart', async ({ page }) => {
    await page.goto('/chart/ZZZZNOTREAL?market=us')
    await expect(page.getByText(/Symbol not found|Quote unavailable/)).toBeVisible()
  })

  test('page state follows the URL on back/forward', async ({ page }) => {
    await page.goto('/chart/RELIANCE?market=india')
    await expect(page.locator('.nxc .sy')).toHaveText('RELIANCE')
    await page.goto('/chart/NVDA?market=us')
    await expect(page.locator('.nxc .sy')).toHaveText('NVDA')
    await page.goBack()
    await expect(page.locator('.nxc .sy')).toHaveText('RELIANCE')
  })

  test('Charts nav item is marked current on /chart routes', async ({ page }) => {
    await page.goto('/chart/RELIANCE?market=india')
    await expect(page.locator('.nxc .tb').getByRole('link', { name: 'Charts' })).toHaveAttribute('aria-current', 'page')
  })
})
