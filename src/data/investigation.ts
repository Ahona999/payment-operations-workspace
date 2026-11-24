import { formatAmount, type ExceptionCase } from './exceptions'

export const evidenceRequirements = [
  'Recipient statement or credit confirmation',
  'Provider trace with final settlement status',
  'Bank trace confirming final funds movement',
] as const
export const evidenceKeys = ['recipient', 'provider', 'bank'] as const
export type EvidenceKey = typeof evidenceKeys[number]
export const outcomes = ['Recipient credit verified', 'Refund or reversal verified', 'No funds movement verified'] as const
export type Outcome = typeof outcomes[number]
export type VerifiedEvidence = { reference: string; outcome: Outcome }
export type EvidenceReceipts = Partial<Record<EvidenceKey, VerifiedEvidence>>
export type HistoryEntry = { at: string; text: string }
export type InvestigationAction =
  | { kind: 'owner'; owner: ExceptionCase['owner'] }
  | { kind: 'priority'; priority: ExceptionCase['priority'] }
  | { kind: 'note' | 'request' | 'escalate'; text: string }
  | { kind: 'verify'; key: EvidenceKey; reference: string; outcome: Outcome }
  | { kind: 'resolve'; outcome: Outcome }
  | { kind: 'close' }

export const canRecordOutcome = (receipts: EvidenceReceipts, outcome: Outcome) => {
  const references = evidenceKeys.map(key => receipts[key]?.reference.trim().toLowerCase())
  return evidenceKeys.every(key => receipts[key]?.outcome === outcome) &&
    references.every(Boolean) && new Set(references).size === evidenceKeys.length
}

const caseSignals: Record<string, string> = {
  'Bank declined': 'A bank decline is recorded. The decline event alone does not reconcile the bank ledger.',
  'Missing confirmation': 'The source record does not contain a final recipient acknowledgement.',
  'Pending reversal': 'A reversal is reported. The recipient and bank traces have not established whether the reversal settled.',
  'Unmatched settlement': 'The provider record and the settlement ledger have not been matched to a final bank trace.',
  'Conflicting records': 'The bank and provider records disagree on the final movement of funds.',
  'Gateway timeout': 'The gateway timed out before reporting a final result.',
  'Reference mismatch': 'The source references do not match. The final settlement has not been linked to this transaction.',
}

export function getCaseEvidence(item: ExceptionCase) {
  const upi = item.rail === 'UPI'
  const amount = formatAmount(item.amount)
  const conflict = upi || /conflicting|mismatch/i.test(item.type)
  const debit = upi || item.payment === 'Successful'
  const bankReference = upi ? 'BNK-70921' : 'BNK-' + item.id.slice(-4)
  const providerReference = upi ? 'PRV-39810' : 'PRV-' + item.id.slice(-4)
  const reported = upi ? 'Failed · code U30' : item.payment === 'Unknown' ? 'No final status reported' : item.payment + ' reported'
  const lastEvent = upi ? 'Recipient credit confirmation requested' : 'Final funds movement unconfirmed'
  const event = (time: string, title: string, source: string, label: string, tone: 'green' | 'red' | 'amber', detail: string) => ({ time, title, source, label, tone, detail })
  return {
    upi, conflict, bankReference, providerReference, reported,
    reference: item.utr ?? item.reference,
    bankSignal: debit ? amount + ' debit recorded' : 'Final movement unconfirmed',
    bankVerification: debit ? 'Debit verified only' : 'Final trace missing',
    providerVerification: upi ? 'Failure event verified' : 'Reported · final trace pending',
    known: upi ? `Bank confirms ${amount} debit. Provider reports failure. Neither record establishes recipient credit.`
      : caseSignals[item.type] ?? `${item.type} flagged for ${item.rail}. The current payment status is ${item.payment.toLowerCase()}.`,
    warning: upi ? 'Conflicting records: bank debit confirmed; provider reports failure. Recipient credit is unconfirmed.'
      : conflict ? 'Conflicting records: source reports differ. Final funds movement is unconfirmed.'
        : `${item.type}: final evidence is required to establish the funds movement.`,
    events: [
      event('13:09:54', 'Payment initiated', 'Payment service · ' + (upi ? 'EVT-0842-01' : 'EVT-' + item.id.slice(-4)), 'Recorded', 'green', 'Verified initiating event. It establishes that a payment was submitted.'),
      event('13:09:56', debit ? amount + ' debited from payer account' : 'Bank record checked', `Bank API · ${bankReference} · Received 13:10:02`, debit ? 'Debit confirmed' : 'Reported', debit ? 'green' : 'amber', debit ? 'Verified payer debit. Recipient credit is a separate verification.' : 'Bank record reviewed. A final funds movement trace is missing.'),
      event('13:09:58', upi ? 'Provider returned payment failed' : 'Provider payment record reviewed', `Provider webhook · ${providerReference} · Received 13:10:01`, conflict ? 'Conflict' : 'Reported', conflict ? 'red' : 'amber', reported + '. The provider event alone does not establish the final settlement.'),
      event('13:18:00', lastEvent, upi ? 'Ananya S. · REQ-118 · No response received' : 'Investigation review · Evidence pending', 'Awaiting evidence', 'amber', 'Recipient confirmation or a verified final disposition is required.'),
    ],
  }
}

export const formatCaseDate = (date: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(date + 'T00:00:00Z'))
export const formatAuditTime = (at: string) => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(at))
export const formatAuditDate = (at: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(new Date(at)) + ' IST'
