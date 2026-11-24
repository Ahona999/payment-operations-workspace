export const priorities = ['Urgent', 'High', 'Medium', 'Low'] as const
export const owners = ['Ananya S.', 'Unassigned', 'Rohan M.', 'Meera K.', 'Nisha P.'] as const
export const caseStatuses = ['Investigating', 'Open', 'Awaiting evidence', 'Escalated', 'Closed'] as const
export const paymentStatuses = ['Failed', 'Pending', 'Unknown', 'Successful'] as const
export const reconciliationStatuses = ['Unmatched', 'Matched', 'Needs review'] as const
export const demoDate = '2026-11-17'

export interface PaymentException {
  id: string
  merchant: string
  amount: number
  type: string
  age: number
  priority: typeof priorities[number]
  owner: typeof owners[number]
  payment: typeof paymentStatuses[number]
  investigation: typeof caseStatuses[number]
  reconciliation: typeof reconciliationStatuses[number]
  rail: 'UPI' | 'Bank transfer'
  detectedOn: string
  detectedHour: number
  action: string
}

const featured: PaymentException[] = [
  { id: 'TXN-261117-0328', merchant: 'Northstar Retail', amount: 120000, type: 'Gateway timeout', age: 432, priority: 'High', owner: 'Rohan M.', payment: 'Unknown', investigation: 'Awaiting evidence', reconciliation: 'Needs review', rail: 'Bank transfer', detectedOn: demoDate, detectedHour: 7, action: 'Get evidence' },
  { id: 'TXN-261117-0471', merchant: 'Mitra Services', amount: 42800, type: 'Bank declined', age: 326, priority: 'Medium', owner: 'Meera K.', payment: 'Failed', investigation: 'Open', reconciliation: 'Unmatched', rail: 'Bank transfer', detectedOn: demoDate, detectedHour: 9, action: 'Open case' },
  { id: 'TXN-261117-0619', merchant: 'Veda Commerce', amount: 315750, type: 'Reference mismatch', age: 188, priority: 'Medium', owner: 'Ananya S.', payment: 'Unknown', investigation: 'Investigating', reconciliation: 'Needs review', rail: 'Bank transfer', detectedOn: demoDate, detectedHour: 11, action: 'Compare records' },
  { id: 'TXN-261117-0735', merchant: 'Orbit Technologies', amount: 18940, type: 'Missing confirmation', age: 161, priority: 'Medium', owner: 'Rohan M.', payment: 'Pending', investigation: 'Awaiting evidence', reconciliation: 'Unmatched', rail: 'Bank transfer', detectedOn: demoDate, detectedHour: 11, action: 'Get evidence' },
]

const failureHours = [8,8,9,9, ...Array<number>(9).fill(10), ...Array<number>(5).fill(11),12,12,12,13,13,14,14]
const merchants = ['Cedar Trading', 'Lotus Retail', 'Monsoon Foods', 'Aranya Services', 'Saffron Supply', 'Nila Commerce']

const baseExceptions: readonly PaymentException[] = [
  ...featured,
  ...Array.from({ length: 242 }, (_, index): PaymentException => {
    const upi = index === 41
    const investigation = index < 125 ? 'Investigating' : index < 180 ? 'Awaiting evidence' : 'Closed'
    const detectedOn = index < 38 ? demoDate : index < 72 ? '2026-11-14' : index < 154 ? '2026-11-16' : index < 180 ? '2026-11-15' : '2026-11-06'
    const pending = index >= 38 && index < 60
    const detectedHour = failureHours[index] ?? (index < 38 ? (index % 8) : 7 + index % 9)
    const overdue = index >= 38 && index < 54
    const age = overdue ? 2890 + (index - 38) * 18 : index < 38 ? (14 - detectedHour) * 60 + 20 : 1200 + index * 6
    return {
      id: upi ? 'TXN-261114-0943' : 'TXN-' + detectedOn.slice(2).replaceAll('-', '') + '-' + String(1100 + index),
      merchant: merchants[index % merchants.length],
      amount: upi ? 943 : 1250 + index * 347,
      type: pending ? 'Missing confirmation' : index < 25 ? 'Bank declined' : 'Reference mismatch',
      age,
      priority: 'Low',
      owner: index >= 38 && index < 43 ? 'Unassigned' : owners[[0, 2, 3][index % 3]],
      payment: pending ? 'Pending' : index < 25 || index % 4 === 0 && index >= 38 ? 'Failed' : 'Unknown',
      investigation,
      reconciliation: investigation === 'Closed' ? 'Matched' : 'Needs review',
      rail: upi ? 'UPI' : 'Bank transfer',
      detectedOn,
      detectedHour,
      action: investigation === 'Awaiting evidence' ? 'Get evidence' : 'Review case',
    }
  }),
]

export interface ExceptionCase extends PaymentException {
  caseId: string
  reference: string
  utr?: string
  currency: 'INR'
}

type CaseSeed = Pick<ExceptionCase, 'id' | 'caseId' | 'type' | 'amount' | 'age' | 'payment' | 'investigation' | 'priority' | 'owner'>

const queueCases: CaseSeed[] = [
  { caseId: 'CASE-1042', id: 'TXN-261114-0842', type: 'Conflicting records', amount: 248500, age: 4560, payment: 'Failed', investigation: 'Escalated', priority: 'Urgent', owner: 'Ananya S.' },
  { caseId: 'CASE-1067', id: 'TXN-261115-1067', type: 'Missing confirmation', amount: 86250, age: 3300, payment: 'Unknown', investigation: 'Awaiting evidence', priority: 'Urgent', owner: 'Unassigned' },
  { caseId: 'CASE-1083', id: 'TXN-261115-1183', type: 'Pending reversal', amount: 112000, age: 2760, payment: 'Failed', investigation: 'Investigating', priority: 'High', owner: 'Rohan M.' },
  { caseId: 'CASE-1098', id: 'TXN-261116-0298', type: 'Unmatched settlement', amount: 375900, age: 1920, payment: 'Successful', investigation: 'Open', priority: 'High', owner: 'Meera K.' },
  { caseId: 'CASE-1104', id: 'TXN-261116-0304', type: 'Missing confirmation', amount: 18940, age: 1392, payment: 'Pending', investigation: 'Awaiting evidence', priority: 'High', owner: 'Ananya S.' },
  { caseId: 'CASE-1126', id: 'TXN-261116-0526', type: 'Conflicting records', amount: 64800, age: 1120, payment: 'Unknown', investigation: 'Investigating', priority: 'High', owner: 'Nisha P.' },
  { caseId: 'CASE-1141', id: 'TXN-261117-0341', type: 'Pending reversal', amount: 42600, age: 730, payment: 'Failed', investigation: 'Open', priority: 'Medium', owner: 'Unassigned' },
  { caseId: 'CASE-1158', id: 'TXN-261117-0458', type: 'Unmatched settlement', amount: 206450, age: 506, payment: 'Successful', investigation: 'Investigating', priority: 'Medium', owner: 'Rohan M.' },
  { caseId: 'CASE-1172', id: 'TXN-261117-0572', type: 'Missing confirmation', amount: 9750, age: 258, payment: 'Pending', investigation: 'Open', priority: 'Medium', owner: 'Meera K.' },
  { caseId: 'CASE-1189', id: 'TXN-261117-0689', type: 'Conflicting records', amount: 158200, age: 102, payment: 'Unknown', investigation: 'Awaiting evidence', priority: 'Medium', owner: 'Unassigned' },
]

const replacedIndices = new Set([79, 80, 81, 82, 38, 39, 40, 41])
const queueProfiles: Partial<Record<string, Pick<PaymentException, 'merchant' | 'reconciliation' | 'detectedHour' | 'action'>>> = {
  'TXN-261114-0842': { merchant: 'Aster Logistics', reconciliation: 'Unmatched', detectedHour: 10, action: 'Review case' },
  'TXN-261115-1067': { merchant: 'Kaveri Supplies', reconciliation: 'Unmatched', detectedHour: 7, action: 'Assign owner' },
}
const addCaseIdentity = (item: PaymentException, caseId: string): ExceptionCase => ({
  ...item, caseId, reference: 'REF-' + item.id.slice(4), currency: 'INR',
  ...(item.rail === 'UPI' ? { utr: '632114098271' } : {}),
})

const designedCases = queueCases.map((seed, index) => {
  const date = seed.id.slice(4, 10)
  return addCaseIdentity({
    merchant: 'Acme Finance',
    rail: 'Bank transfer',
    reconciliation: 'Needs review',
    detectedOn: '20' + date.slice(0, 2) + '-' + date.slice(2, 4) + '-' + date.slice(4),
    detectedHour: index === 6 ? 2 : 7,
    action: 'Review case',
    ...queueProfiles[seed.id],
    ...seed,
  }, seed.caseId)
})

const otherCases = baseExceptions.flatMap((item, baseIndex) => {
  if (replacedIndices.has(baseIndex)) return []
  // Keep established case IDs and fixture assignments when a featured record moves.
  const index = baseIndex + 2
  const generated = baseIndex >= featured.length && item.investigation !== 'Closed'
  const caseId = item.rail === 'UPI' ? 'CASE-0943' : 'CASE-' + (2000 + index)
  const owner = generated
    ? index >= 44 && index < 49 || index >= 85 && index < 109 ? 'Unassigned'
      : index >= 109 && index < 140 ? 'Ananya S.' : index % 2 ? 'Nisha P.' : 'Rohan M.'
    : item.owner
  const investigation = generated && index >= 60 && index < 71 ? 'Escalated'
    : generated && index >= 131 && index < 134 ? 'Investigating' : item.investigation
  const priority = generated && index >= 85 && index < 126 ? 'High' : item.priority
  const payment = index === 65 ? 'Unknown' : item.payment
  return [addCaseIdentity({ ...item, owner, investigation, priority, payment }, caseId)]
})

export const exceptions: readonly ExceptionCase[] = [...designedCases, ...otherCases]

export const isOverdue = (item: PaymentException) => item.investigation !== 'Closed' && item.age > 48 * 60
export const isMissingConfirmation = (item: PaymentException) => item.investigation !== 'Closed' && item.payment === 'Pending' && item.type === 'Missing confirmation'
export const isFailureSpike = (item: PaymentException) => item.investigation !== 'Closed' && item.payment === 'Failed' && item.detectedHour === 10 && item.rail === 'Bank transfer'
export const formatAmount = (amount: number) => '₹' + amount.toLocaleString('en-IN')
export const formatAge = (minutes: number) => minutes >= 1440
  ? `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h`
  : `${Math.floor(minutes / 60)}h ${minutes % 60}m`

export function getTrend(items: readonly PaymentException[], hours: 7 | 24) {
  return Array.from({ length: hours }, (_, index) => {
    const hour = hours === 7 ? index + 8 : (index + 15) % 24
    const failures = items.filter(item => item.payment === 'Failed' && item.detectedHour === hour).length
    return { hour: String(hour).padStart(2, '0') + ':00', failures, area: failures + 3 }
  })
}
