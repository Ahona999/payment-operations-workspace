import assert from 'node:assert/strict'
import { launchBrowser, base } from './browser.mjs'
const browser = await launchBrowser()
const ids = ['CASE-1067', 'CASE-1141', 'CASE-1189']
try {
  for (const width of [1280, 1440, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()) })
    assert.equal((await page.goto(base + '/exceptions')).status(), 200)
    await page.evaluate(() => document.fonts.ready)
    assert.deepEqual(await page.locator('.case-summary dd').allTextContents(), ['186', '32', '48', '18'])
    assert.deepEqual(await page.locator('.case-views button span').allTextContents(), ['186', '34', '32', '12'])
    assert.equal(await page.locator('[aria-current=page]').first().innerText(), 'Investigations\n186')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth))
    const boxes = () => page.locator('.overview-heading,.case-summary,.case-table,.case-control-row,thead').evaluateAll(nodes => nodes.map(node => {
      const { x,y,width,height } = node.getBoundingClientRect()
      return [x,y,width,height]
    }))
    if (width === 1440) {
      console.log('Default geometry', await boxes())
    }
    for (const id of ids) await page.getByRole('checkbox', { name: 'Select ' + id, exact: true }).check()
    await page.getByText('3 selected', { exact: true }).waitFor()
    assert.equal(await page.getByRole('checkbox', { name: 'Select all cases on this page' }).evaluate(el => el.indeterminate), true)
    assert.equal(await page.locator('.case-selected').count(), 3)
    if (width === 1440) {
      console.log('Bulk geometry', await boxes())
    }
    await page.getByRole('button', { name: 'Deselect all' }).click()
    assert.equal(await page.locator('.case-bulk').count(), 0)

    const search = page.getByRole('searchbox', { name: 'Search case ID, transaction ID or reference' })
    for (const value of ['case-0943', 'TXN-261114-0943', 'REF-261114-0943']) {
      await search.fill(value)
      const row = page.getByRole('row').filter({ hasText: 'CASE-0943' })
      await row.getByText('₹943', { exact: true }).waitFor()
      assert.equal(await page.locator('tbody tr').count(), 1)
    }
    await search.fill('')
    await page.getByRole('button', { name: /Escalated 12/ }).click()
    await page.getByText('1–10 of 12 cases', { exact: false }).waitFor()
    await page.getByRole('button', { name: /All Cases/ }).click()
    await page.getByRole('button', { name: 'Filter', exact: true }).click()
    await page.getByRole('combobox', { name: 'Payment status', exact: true }).selectOption('Successful')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    assert.deepEqual(await page.locator('.case-cell-payment').allTextContents(), ['Successful', 'Successful'])
    await page.getByRole('button', { name: /Remove filter: Payment status/ }).click()
    await page.getByRole('button', { name: 'Clear Filters' }).click()
    await page.getByText('1–10 of 248 cases', { exact: false }).waitFor()
    await page.getByRole('button', { name: 'Columns', exact: true }).click()
    await page.getByRole('checkbox', { name: 'Exception Type', exact: true }).uncheck()
    assert.equal(await page.getByRole('columnheader', { name: 'Exception Type' }).count(), 0)
    await page.getByRole('checkbox', { name: 'Exception Type', exact: true }).check()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await page.getByRole('button', { name: 'Amount (₹)', exact: true }).click()
    assert.equal(await page.getByRole('columnheader', { name: /Amount/ }).getAttribute('aria-sort'), 'descending')
    assert.equal(await page.locator('.case-cell-amount').first().textContent(), '₹3,75,900')
    await page.getByRole('button', { name: 'Next page' }).click()
    await page.getByText('11–20 of 248 cases', { exact: false }).waitFor()
    await page.getByRole('checkbox', { name: 'Select all cases on this page' }).check()
    await page.getByText('10 selected', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Next page' }).click()
    assert.equal(await page.getByRole('checkbox', { name: 'Select all cases on this page' }).isChecked(), false)
    await page.getByRole('checkbox', { name: 'Select all cases on this page' }).check()
    await page.getByText('20 selected', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Deselect all' }).click()

    await page.goto(base + '/investigations')
    for (const id of ids) await page.getByRole('checkbox', { name: 'Select ' + id, exact: true }).check()
    await page.getByRole('combobox', { name: 'Assign to', exact: true }).selectOption('Meera K.')
    await page.getByRole('combobox', { name: 'Bulk priority', exact: true }).selectOption('High')
    await page.getByRole('button', { name: 'Assign 3 cases' }).click()
    await page.getByRole('status').getByText('Updated 3 cases · Assigned to Meera K. · High priority').waitFor()
    for (const id of ids) {
      const row = page.getByRole('row').filter({ hasText: id })
      await row.getByText('Meera K.').waitFor()
      await row.getByText('High', { exact: true }).waitFor()
    }
    await page.reload()
    await page.getByRole('row').filter({ hasText: 'CASE-1067' }).getByText('Meera K.').waitFor()
    await page.getByRole('link', { name: 'Overview', exact: true }).click()
    await page.getByRole('heading', { name: 'Operations Overview' }).waitFor()
    assert.deepEqual(await page.locator('.kpi strong').allTextContents(), ['248','42','186','18'])
    const overviewRow = page.getByRole('row').filter({ hasText: 'TXN-261115-1067' })
    await overviewRow.getByText('Meera K.').waitFor()
    await overviewRow.getByText('High', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'View investigations' }).click()
    await page.waitForURL('**/investigations')
    await page.getByRole('link', { name: 'CASE-1042', exact: true }).click()
    await page.waitForURL('**/investigations/CASE-1042')
    await page.getByRole('link', { name: 'Overview', exact: true }).click()
    await page.getByRole('button', { name: 'View All Exceptions' }).click()
    await page.waitForURL('**/exceptions')
    for (const [name, count] of [['Failure spike', 9], ['Missing confirmations', 24], ['Overdue investigations', 18]]) {
      await page.getByRole('link', { name: 'Overview', exact: true }).click()
      await page.getByRole('button', { name: new RegExp(name) }).click()
      await page.getByText('Alert: ' + name).waitFor()
      await page.getByText(new RegExp('of ' + count + ' cases')).waitFor()
    }
    await page.getByRole('button', { name: /Remove filter: Alert/ }).click()
    assert.equal(new URL(page.url()).searchParams.get('alert'), null)
    await page.reload()
    await page.getByText(/of 186 cases/).waitFor()
    assert.deepEqual(errors, [])
    console.log(width + ' px passed queue, bulk state, filtering, sorting, pagination, select-all, persisted updates, and overview navigation')
    await page.close()
  }
} finally {
  await browser.close()
}
