import { exceptions, formatAmount, type ExceptionCase } from './exceptions'

export const reconciliationLabels = ['Matched', 'Awaiting verification', 'Amount mismatch', 'Reference mismatch', 'Settlement discrepancy', 'Missing bank record', 'Missing provider record'] as const
export type MatchLabel = typeof reconciliationLabels[number]
type DateScope = 'week' | 'today' | 'all'
export type ReconciliationDateScope = DateScope
export type ReconciliationAction =
  | { kind: 'match'; verified: boolean; evidence: string }
  | { kind: 'request'; evidence: string }
  | { kind: 'link' }
export type ReconciliationEvent = { at: string; text: string; kind: ReconciliationAction['kind'] }
export type ReconciliationInfo = { matched?: true; linkedCaseId?: string; events?: ReconciliationEvent[] }

type FinancialSource = {
  id: string
  amount: number
  reference: string
  settlement: string
  timestamp: string
  status: string
}

export type ReconciliationRecord = {
  id: string
  caseId?: string
  owner?: ExceptionCase['owner']
  reference: string
  providerName: string
  date: string
  updated: string
  bank?: FinancialSource
  provider?: FinancialSource
  originallyMatched: boolean
  initiallyLinked?: boolean
  info?: ReconciliationInfo
}

const activeDate = '2026-11-17'
const archiveDate = '2026-11-06'
type Scenario = 'ready' | 'amount' | 'reference' | 'settlement' | 'no-bank' | 'no-provider'
type Seed = { id: string; amount: number; scenario: Scenario; counterAmount?: number; updated?: string; date?: string; matched?: boolean; linked?: boolean; providerName?: string; bankSourceId?: string }

function buildRecord(seed: Seed, item?: ExceptionCase): ReconciliationRecord {
  const suffix = seed.id.slice(4)
  const date = seed.date ?? activeDate
  const timestamp = date.slice(-2) + ' Nov 2026'
  const settlement = 'STL-' + date.replaceAll('-', '') + '-' + suffix
  const reference = item?.utr ?? item?.reference ?? seed.id
  return {
    id: seed.id, reference, caseId: item?.caseId, owner: item?.owner, date, updated: seed.updated ?? '14:10',
    providerName: seed.providerName ?? 'PayBridge', originallyMatched: Boolean(seed.matched || item?.reconciliation === 'Matched'), initiallyLinked: seed.linked,
    bank: seed.scenario === 'no-bank' ? undefined : {
      id: seed.bankSourceId ?? 'BNK-' + suffix, amount: seed.counterAmount ?? (seed.scenario === 'amount' ? seed.amount + 50 : seed.amount), reference,
      settlement, timestamp: timestamp + ' · 13:42:08 IST', status: 'Debit recorded',
    },
    provider: seed.scenario === 'no-provider' ? undefined : {
      id: 'PVR-' + suffix, amount: seed.amount,
      reference: seed.scenario === 'reference' ? reference + '-ALT' : reference,
      settlement: seed.scenario === 'settlement' ? settlement + '-ALT' : settlement,
      timestamp: timestamp + ' · 13:42:10 IST', status: item ? item.payment + ' · provider reported' : 'Successful · provider reported',
    },
  }
}

const shared = new Map(exceptions.map(item => [item.id, item]))
const leading: Seed[] = [
  { id: 'TXN-261114-0842', amount: 248500, scenario: 'amount', updated: '14:32', linked: true },
  { id: 'TXN-80426', amount: 12500, scenario: 'ready', updated: '14:30' },
  { id: 'TXN-80427', amount: 890, scenario: 'no-bank', updated: '14:28' },
  { id: 'TXN-80428', amount: 7250, scenario: 'no-provider', updated: '14:26' },
  { id: 'TXN-261116-0304', amount: 18940, counterAmount: 18900, scenario: 'amount', updated: '14:25' },
  { id: 'TXN-261114-0943', amount: 943, scenario: 'ready', updated: '14:22' },
  { id: 'TXN-80431', amount: 6800, scenario: 'amount', updated: '14:20' },
  { id: 'TXN-80432', amount: 3275, scenario: 'ready', updated: '14:18', bankSourceId: 'BNK-LEDGER-0001' },
]
const leadingIds = new Set(leading.map(record => record.id))
const remaining = exceptions.filter(item => !leadingIds.has(item.id))
const unsettled = remaining.filter(item => item.reconciliation !== 'Matched')
const matched = remaining.filter(item => item.reconciliation === 'Matched')
const activeScenarios: Scenario[] = [
  ...Array.from({ length: 12 }, (_, index): Scenario => index % 2 === 0 ? 'no-bank' : 'no-provider'),
  ...Array.from({ length: 15 }, (_, index): Scenario => (['reference', 'settlement', 'amount'] as const)[index % 3]),
  ...Array<Scenario>(21).fill('ready'),
]
const standaloneMatched = Array.from({ length: 1248 - matched.length }, (_, index): Seed => ({
  id: 'TXN-LEDGER-' + String(index + 1).padStart(4, '0'), amount: 850 + index * 23, scenario: 'ready',
  matched: true, date: index % 3 === 0 ? '2026-11-16' : activeDate, providerName: index % 2 ? 'PayBridge' : 'SettlePay',
}))

export function getReconciliationRecords(items: readonly ExceptionCase[], infoFor: (id: string) => ReconciliationInfo | undefined): ReconciliationRecord[] {
  const current = new Map(items.map(item => [item.id, item]))
  const enrich = (seed: Seed) => {
    const item = current.get(seed.id) ?? shared.get(seed.id)
    const info = infoFor(seed.id)
    return { ...buildRecord({ ...seed, amount: item?.amount ?? seed.amount }, item), info }
  }
  return [
    ...leading.map(enrich),
    ...unsettled.map((item, index) => enrich({
      id: item.id, amount: item.amount, scenario: activeScenarios[index] ?? (index % 2 ? 'reference' : 'no-bank'),
      date: index >= activeScenarios.length ? archiveDate : index % 3 ? activeDate : '2026-11-15',
      providerName: index % 2 ? 'SettlePay' : 'PayBridge',
    })),
    ...matched.map(item => enrich({ id: item.id, amount: item.amount, scenario: 'ready', date: '2026-11-16', matched: true })),
    ...standaloneMatched.map(enrich),
  ]
}

export function matchLabel(record: ReconciliationRecord): MatchLabel {
  if (record.originallyMatched || record.info?.matched) return 'Matched'
  if (!record.bank) return 'Missing bank record'
  if (!record.provider) return 'Missing provider record'
  if (record.bank.amount !== record.provider.amount) return 'Amount mismatch'
  if (record.bank.reference !== record.provider.reference || record.bank.reference !== record.reference) return 'Reference mismatch'
  if (record.bank.settlement !== record.provider.settlement) return 'Settlement discrepancy'
  return 'Awaiting verification'
}

export function matchBlocker(record: ReconciliationRecord, records: readonly ReconciliationRecord[]) {
  const label = matchLabel(record)
  if (label === 'Matched') return 'This record has already been matched.'
  if (label !== 'Awaiting verification') return 'Both sources must be present and agree on the amount, reference and settlement.'
  if (records.some(other => other.id !== record.id && matchLabel(other) === 'Matched' &&
      (other.bank?.id === record.bank?.id || other.provider?.id === record.provider?.id))) return 'A source record has already been matched to another transaction.'
  return ''
}

export const isDiscrepancy = (label: MatchLabel) => ['Amount mismatch', 'Reference mismatch', 'Settlement discrepancy'].includes(label)
export const inReconciliationScope = (record: ReconciliationRecord, scope: DateScope) => scope === 'all' || (scope === 'today' ? record.date === activeDate : record.date >= '2026-11-11')
export const renderMoney = (amount: number) => formatAmount(amount) + '.00'
export const getDifference = (record: ReconciliationRecord) => record.bank && record.provider ? record.bank.amount - record.provider.amount : undefined
export const renderDifference = (amount: number) => (amount > 0 ? '+' : amount < 0 ? '−' : '') + renderMoney(Math.abs(amount))
