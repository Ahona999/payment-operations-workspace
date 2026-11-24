import assert from 'node:assert/strict'
import { launchBrowser, base } from './browser.mjs'
const browser = await launchBrowser()
try {
  for (const width of [1280, 1440, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    await page.goto(base + '/')
    await page.locator('.recharts-line-dots circle').nth(2).hover()
    await page.locator('.trend-tooltip').getByText('10:00 · 9 failures').waitFor()
    await page.getByRole('button', { name: '24h', exact: true }).click()
    await page.getByRole('button', { name: 'Next page' }).click()
    await page.getByText('7–12 of 248').waitFor()
    await page.getByRole('combobox', { name: 'All priorities' }).selectOption('Urgent')
    await page.getByText('Showing 2 of 2 exceptions', { exact: false }).waitFor()
    await page.getByRole('combobox', { name: 'All priorities' }).selectOption('')
    await page.getByRole('searchbox', { name: 'Search transaction ID or reference' }).fill('TXN-261114-0943')
    const row = page.getByRole('row').filter({ hasText: 'TXN-261114-0943' })
    await row.getByText('₹943').waitFor()
    await row.getByRole('button').click()
    await page.waitForURL('**/investigations/CASE-0943')
    assert.ok(await page.getByRole('heading', { name: /CASE-0943.*₹943/ }).isVisible())
    console.log(width + ' px passed Overview chart, pagination, filter, search and UPI detail')
    await page.close()
  }
} finally { await browser.close() }
