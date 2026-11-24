import assert from 'node:assert/strict'
import { launchBrowser, base } from './browser.mjs'
import { exceptions, isOverdue, demoDate } from '../src/data/exceptions.ts'

const storageKey = 'payment-ops.case-overrides.v1'
const browser = await launchBrowser()
const format = item => ({
  id: item.id, amount: item.amount, type: item.type, payment: item.payment,
  investigation: item.investigation, priority: item.priority, owner: item.owner,
})
assert.equal(exceptions.length, 248)
for (const key of ['id', 'caseId', 'reference']) assert.equal(new Set(exceptions.map(item => item[key])).size, 248)
const expected = new Map(exceptions.map(item => [item.id, format(item)]))
const canonical = expected.get('TXN-261114-0842')
assert.deepEqual(canonical, {
  id: 'TXN-261114-0842', amount: 248500, type: 'Conflicting records', payment: 'Failed',
  investigation: 'Escalated', priority: 'Urgent', owner: 'Ananya S.',
})

async function extractRows(page, queue) {
  return page.locator('tbody tr').evaluateAll((rows, queue) => rows.map(row => {
    const text = index => row.cells[index].innerText.trim()
    const id = row.cells[1].querySelector(queue ? 'small' : 'strong').innerText.trim()
    const amount = Number(text(2).replace(/[^0-9]/g, ''))
    return queue
      ? { id, amount, type: text(3), payment: text(4), investigation: text(5), priority: text(6), owner: text(8) }
      : { id, amount, type: text(3), payment: text(7), investigation: text(8), priority: text(5), owner: text(6) }
  }), queue)
}

async function collect(page, queue) {
  const rows = []
  const next = page.getByRole('button', { name: 'Next page' })
  while (true) {
    rows.push(...await extractRows(page, queue))
    if (await next.isDisabled()) break
    await next.click()
  }
  assert.equal(rows.length, 248)
  const index = new Map(rows.map(row => [row.id, row]))
  assert.equal(index.size, 248)
  return index
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const runtimeErrors = []
  page.on('pageerror', error => runtimeErrors.push(error.message))
  await page.goto(base + '/')
  const unresolved = exceptions.filter(item => item.investigation !== 'Closed')
  const awaiting = unresolved.filter(item => item.investigation === 'Awaiting evidence')
  const investigating = unresolved.filter(item => item.investigation === 'Investigating')
  assert.deepEqual(await page.locator('.kpi strong').allTextContents(), [
    exceptions.length, exceptions.filter(item => item.detectedOn === demoDate).length,
    unresolved.length, exceptions.filter(isOverdue).length,
  ].map(String))
  await page.getByText(investigating.length + ' investigating · ' + awaiting.length + ' awaiting evidence').waitFor()
  const overviewBefore = await collect(page, false)
  assert.deepEqual(overviewBefore, expected)
  await page.getByRole('button', { name: 'View All Exceptions' }).click()
  const savedCounts = [
    unresolved.length, unresolved.filter(item => item.owner === 'Ananya S.').length,
    unresolved.filter(item => item.owner === 'Unassigned').length,
    unresolved.filter(item => item.investigation === 'Escalated').length,
  ]
  assert.deepEqual(await page.locator('.case-views button span').allTextContents(), savedCounts.map(String))
  await page.getByRole('button', { name: 'Clear Filters' }).click()
  await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('50')
  const queueBefore = await collect(page, true)
  assert.deepEqual(queueBefore, overviewBefore)
  console.log('All 248 rendered rows on both screens match the source across seven fields; KPI and saved-view counts match source.')

  await page.goto(base + '/exceptions')
  const choose = id => page.getByRole('checkbox', { name: 'Select ' + id, exact: true })
  const header = page.getByRole('checkbox', { name: 'Select all cases on this page' })
  await choose('CASE-1067').check()
  await page.getByText('1 selected', { exact: true }).waitFor()
  assert.ok(await header.evaluate(input => input.indeterminate))
  await header.check()
  await page.getByText('10 selected', { exact: true }).waitFor()
  await header.uncheck()
  await page.getByRole('button', { name: 'Columns', exact: true }).waitFor()
  const choices = ['CASE-1067', 'CASE-1141', 'CASE-1189']
  for (const id of choices) await choose(id).check()
  await page.getByText('3 selected', { exact: true }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.getByRole('button', { name: 'Deselect all' }).click()
  assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), null)
  for (const id of choices) await choose(id).check()
  await page.getByRole('combobox', { name: 'Assign to', exact: true }).selectOption('Meera K.')
  await page.getByRole('button', { name: 'Assign 3 cases' }).click()
  await page.getByRole('status').getByText('Updated 3 cases · Assigned to Meera K.').waitFor()
  const chosenTransactions = exceptions.filter(item => choices.includes(item.caseId)).map(item => item.id)
  assert.deepEqual(await page.evaluate(key => Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem(key))).map(([id, {owner, priority}]) => [id, priority ? {owner, priority} : {owner}])), storageKey),
    Object.fromEntries(chosenTransactions.map(id => [id, { owner: 'Meera K.' }])))

  await page.reload()
  for (const id of choices) await choose(id).check()
  await page.getByRole('combobox', { name: 'Assign to', exact: true }).selectOption('')
  await page.getByRole('combobox', { name: 'Bulk priority', exact: true }).selectOption('High')
  await page.getByRole('button', { name: 'Update 3 cases' }).click()
  await page.getByRole('status').getByText('Updated 3 cases · High priority').waitFor()
  assert.deepEqual(await page.evaluate(key => Object.fromEntries(Object.entries(JSON.parse(localStorage.getItem(key))).map(([id, {owner, priority}]) => [id, priority ? {owner, priority} : {owner}])), storageKey),
    Object.fromEntries(chosenTransactions.map(id => [id, { owner: 'Meera K.', priority: 'High' }])))

  await page.reload()
  await page.getByRole('button', { name: 'Clear Filters' }).click()
  await page.getByRole('combobox', { name: 'Rows per page' }).selectOption('50')
  const queueAfter = await collect(page, true)
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  const overviewAfter = await collect(page, false)
  const selectedSet = new Set(chosenTransactions)
  const expectedAfter = new Map([...expected].map(([id, item]) => [id, selectedSet.has(id) ? { ...item, owner: 'Meera K.', priority: 'High' } : item]))
  assert.deepEqual(overviewAfter, expectedAfter)
  assert.deepEqual(queueAfter, expectedAfter)
  assert.deepEqual(runtimeErrors, [])
  console.log('Assignment-only and priority-only batches persisted across reload. All 245 unselected records remained unchanged on both screens.')
} finally {
  await browser.close()
}
