import assert from 'node:assert/strict'
import AxeBuilder from '@axe-core/playwright'
import { launchBrowser, base } from './browser.mjs'
const browser = await launchBrowser()
const storageKey = 'payment-ops.case-overrides.v1'
const upi = 'TXN-261114-0943'
const accessibility = []
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const go = path => page.goto(base + path)
  const button = name => page.getByRole('button', { name, exact: true })
  const dialog = page.getByRole('dialog')
  const getStorage = () => page.evaluate(key => localStorage.getItem(key), storageKey)
  async function audit(label) {
    const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    if (report.violations.length) accessibility.push({ label, violations: report.violations.map(v => ({
      id: v.id, nodes: v.nodes.map(n => ({ target: n.target, detail: n.failureSummary })),
    })) })
  }

  await go('/')
  await page.getByRole('combobox', { name: 'Dashboard date range' }).getByRole('option', { name: 'Demo date: 17 Nov 2026' }).waitFor({ state: 'attached' })
  await page.getByText('Simulated connections healthy', { exact: true }).waitFor()
  await page.getByText(/illustrative 48-hour internal SLA threshold/).waitFor()
  const platform = await page.evaluate(() => navigator.platform)
  await page.getByText(/Mac|iPhone|iPad|iPod/i.test(platform) ? 'Cmd+K' : 'Ctrl+K', { exact: true }).waitFor()
  await page.keyboard.press('Tab')
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Skip to main content')
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content')
  await page.keyboard.press('Control+k')
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('type')), 'search')
  await page.keyboard.press('Meta+k')
  assert.ok(await page.evaluate(() => getComputedStyle(document.activeElement.closest('.search')).outlineStyle === 'solid'))
  await page.locator('.recharts-line-curve').waitFor()
  await audit('Overview')

  const mac = await browser.newPage()
  await mac.addInitScript(() => Object.defineProperty(navigator, 'platform', { value: 'MacIntel' }))
  await mac.goto(base)
  await mac.getByText('Cmd+K', { exact: true }).waitFor()
  await mac.keyboard.press('Meta+k')
  assert.equal(await mac.evaluate(() => document.activeElement.getAttribute('type')), 'search')
  await mac.close()

  await button('View investigations').click()
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Exception Queue')
  await audit('Exception Queue')
  await button('Filter').focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')
  assert.equal(await button('Filter').getAttribute('aria-expanded'), 'false')
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Filter')
  await page.getByRole('checkbox', { name: 'Select CASE-1067' }).check()
  await audit('Bulk toolbar')
  await button('Deselect all').click()
  const queueSearch = page.getByRole('searchbox', { name: 'Search case ID, transaction ID or reference' })
  await queueSearch.fill('no-such-case')
  await page.getByText('No cases match your search and filters.').waitFor()
  assert.ok(await button('Next page').isDisabled())
  await queueSearch.fill('632114098271')
  await page.getByRole('link', { name: 'CASE-0943' }).click()
  await audit('Investigation Workspace')
  await button('Request Evidence').click()
  await audit('Evidence request dialog')
  await page.keyboard.press('Escape')
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Request Evidence')

  const evidenceRequirements = ['Recipient statement or credit confirmation', 'Provider trace with final settlement status']
  for (const requirement of evidenceRequirements) {
    await page.getByRole('button', { name: new RegExp(requirement) }).click()
    await dialog.getByRole('textbox', { name: 'Verified evidence reference' }).fill('SAME-REFERENCE')
    await dialog.getByRole('combobox', { name: 'Verified final outcome' }).selectOption('Recipient credit verified')
    await button('Save').click()
  }
  await page.getByRole('alert').getByText('Use a distinct reference for each evidence source.').waitFor()
  await button('Close').click()
  assert.ok(await button('Close Case').isDisabled())

  await page.getByRole('link', { name: 'Reconciliation', exact: true }).click()
  await audit('Reconciliation Workspace')
  await page.getByRole('searchbox', { name: 'Search transaction or reference…' }).fill(upi)
  await page.getByRole('checkbox', { name: 'Supporting evidence verified' }).check()
  await button('Confirm Match').click()
  assert.equal(JSON.parse(await getStorage())[upi].reconciliation, undefined)
  await audit('Manual match dialog')
  await button('Close').click()
  assert.equal(JSON.parse(await getStorage())[upi].reconciliation, undefined)

  await page.evaluate(() => localStorage.setItem('unrelated-test-key', 'keep'))
  await button('Settings').click()
  await button('Reset Demo Data').click()
  assert.ok(JSON.parse(await getStorage())[upi].evidence.recipient)
  await button('Cancel').click()
  assert.ok(JSON.parse(await getStorage())[upi].evidence.recipient)
  await button('Reset Demo Data').click()
  await audit('Reset confirmation')
  await button('Confirm reset').click()
  await page.getByRole('status').getByText('Demo data reset. Original records restored.').waitFor()
  await button('Close').click()
  await page.getByRole('heading', { name: 'Operations Overview' }).waitFor()
  assert.equal(await getStorage(), null)
  assert.equal(await page.evaluate(() => localStorage.getItem('unrelated-test-key')), 'keep')
  await page.reload()
  assert.equal(await getStorage(), null)
  assert.deepEqual(await page.locator('.kpi strong').allTextContents(), ['248', '42', '186', '18'])

  assert.deepEqual(accessibility, [])
  console.log('Keyboard, focus, platform labels, empty states, duplicate evidence, confirmed reset and axe accessibility checks passed.')
} finally {
  await browser.close()
}
