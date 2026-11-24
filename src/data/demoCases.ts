import { useEffect, useRef, useState } from 'react'
import { caseStatuses, exceptions, owners, priorities, type ExceptionCase } from './exceptions'
import { canRecordOutcome, evidenceKeys, evidenceRequirements, outcomes, type EvidenceReceipts, type HistoryEntry, type InvestigationAction, type Outcome } from './investigation'
import { getReconciliationRecords, matchBlocker, matchLabel, type ReconciliationAction, type ReconciliationEvent, type ReconciliationInfo } from './reconciliation'

type CaseChanges = Partial<Pick<ExceptionCase, 'owner' | 'priority'>>
type CaseOverride = CaseChanges & {
  investigation?: ExceptionCase['investigation']
  evidence?: EvidenceReceipts
  outcome?: Outcome
  history?: HistoryEntry[]
  reconciliation?: ReconciliationInfo
}
type Overrides = Record<string, CaseOverride>
const storageKey = 'payment-ops.case-overrides.v1'

function readOverrides(): Overrides {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
    if (!saved || typeof saved !== 'object') return {}
    const entries = Object.entries(saved).flatMap(([id, value]) => {
      if (!value || typeof value !== 'object') return []
      const changes: CaseOverride = {}
      if (owners.includes(value.owner)) changes.owner = value.owner
      if (priorities.includes(value.priority)) changes.priority = value.priority
      if (caseStatuses.includes(value.investigation)) changes.investigation = value.investigation
      if (outcomes.includes(value.outcome)) changes.outcome = value.outcome
      if (value.reconciliation && typeof value.reconciliation === 'object') {
        const saved: Record<string, unknown> = value.reconciliation
        const info: ReconciliationInfo = {}
        if (saved.matched === true) info.matched = true
        if (typeof saved.linkedCaseId === 'string') info.linkedCaseId = saved.linkedCaseId
        if (Array.isArray(saved.events)) info.events = saved.events.filter((entry: unknown): entry is ReconciliationEvent =>
          !!entry && typeof entry === 'object' && 'text' in entry && typeof entry.text === 'string' &&
          'at' in entry && typeof entry.at === 'string' && Number.isFinite(Date.parse(entry.at)) &&
          'kind' in entry && ['match', 'request', 'link'].some(kind => kind === entry.kind))
        changes.reconciliation = info
      }
      if (Array.isArray(value.history)) changes.history = value.history.filter((entry: unknown): entry is HistoryEntry =>
        !!entry && typeof entry === 'object' && 'text' in entry && typeof entry.text === 'string' &&
        'at' in entry && typeof entry.at === 'string' && Number.isFinite(Date.parse(entry.at)))
      if (value.evidence && typeof value.evidence === 'object') {
        changes.evidence = {}
        for (const key of evidenceKeys) {
          const receipt = value.evidence[key]
          if (receipt && typeof receipt.reference === 'string' && receipt.reference.trim() && outcomes.includes(receipt.outcome)) {
            changes.evidence[key] = { reference: receipt.reference, outcome: receipt.outcome }
          }
        }
      }
      return [[id, changes] as const]
    })
    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

export function useDemoCases() {
  const [overrides, setOverrides] = useState(readOverrides)
  const unsaved = useRef<Overrides | undefined>(undefined)
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setOverrides(readOverrides())
    }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  const items = exceptions.map(item => {
    const change = overrides[item.id]
    const updated: ExceptionCase = {
      ...item, owner: change?.owner ?? item.owner, priority: change?.priority ?? item.priority,
      investigation: change?.investigation ?? item.investigation,
      reconciliation: change?.reconciliation?.matched ? 'Matched' : item.reconciliation,
    }
    if (item.action === 'Assign owner' && updated.owner !== 'Unassigned') updated.action = 'Review case'
    return updated
  })

  function commit(next: Overrides) {
    setOverrides(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      unsaved.current = undefined
      return true
    } catch {
      unsaved.current = next
      return false
    }
  }

  function resetDemoData() {
    try {
      localStorage.removeItem(storageKey)
      unsaved.current = undefined
      setOverrides({})
      return true
    } catch {
      return false
    }
  }

  function updateCases(ids: string[], changes: CaseChanges) {
    const next = { ...readOverrides(), ...unsaved.current }
    const at = new Date().toISOString()
    const text = [changes.owner ? 'Owner set to ' + changes.owner : '', changes.priority ? 'Priority set to ' + changes.priority : ''].filter(Boolean).join(' · ')
    ids.forEach(id => {
      if (!exceptions.some(item => item.id === id)) return
      const previous = next[id]
      next[id] = { ...previous, ...changes, history: [...(previous?.history ?? []), { at, text }] }
    })
    return commit(next)
  }

  function recordCaseAction(id: string, action: InvestigationAction) {
    const latest = { ...readOverrides(), ...unsaved.current }
    const original = exceptions.find(item => item.id === id)
    const previous = latest[id] ?? {}
    const status = previous.investigation ?? original?.investigation
    if (!original || status === 'Closed') return { error: 'This case is closed or unavailable.' }
    const next = { ...previous }
    let text: string
    switch (action.kind) {
      case 'owner':
        next.owner = action.owner
        text = 'Owner set to ' + action.owner
        break
      case 'priority':
        next.priority = action.priority
        text = 'Priority set to ' + action.priority
        break
      case 'note':
      case 'request':
      case 'escalate': {
        const message = action.text.trim()
        if (!message) return { error: 'Enter details to record this action.' }
        if (action.kind === 'request' && status !== 'Escalated') next.investigation = 'Awaiting evidence'
        if (action.kind === 'escalate') next.investigation = 'Escalated'
        text = (action.kind === 'note' ? 'Note added' : action.kind === 'request' ? 'Evidence requested' : 'Case escalated') + ' · ' + message
        break
      }
      case 'verify': {
        const reference = action.reference.trim()
        if (!reference) return { error: 'Enter an evidence reference.' }
        if (evidenceKeys.some(key => key !== action.key && previous.evidence?.[key]?.reference.trim().toLowerCase() === reference.toLowerCase())) {
          return { error: 'Use a distinct reference for each evidence source.' }
        }
        if (previous.outcome && previous.outcome !== action.outcome) return { error: 'This evidence conflicts with the recorded outcome.' }
        next.evidence = { ...previous.evidence, [action.key]: { reference, outcome: action.outcome } }
        text = 'Verified ' + evidenceRequirements[evidenceKeys.indexOf(action.key)] + ' · ' + reference + ' · ' + action.outcome
        break
      }
      case 'resolve':
        if (!canRecordOutcome(previous.evidence ?? {}, action.outcome)) return { error: 'All three verified records must support this outcome.' }
        if (previous.outcome) return { error: 'An outcome has already been recorded.' }
        next.outcome = action.outcome
        text = 'Outcome recorded · ' + action.outcome
        break
      case 'close':
        if (!previous.outcome || !canRecordOutcome(previous.evidence ?? {}, previous.outcome)) return { error: 'Record a supported outcome before closing this case.' }
        next.investigation = 'Closed'
        text = 'Case closed · ' + previous.outcome
        break
    }
    next.history = [...(previous.history ?? []), { at: new Date().toISOString(), text }]
    return { text, saved: commit({ ...latest, [id]: next }) }
  }

  function recordReconciliationAction(id: string, action: ReconciliationAction) {
    const latest = { ...readOverrides(), ...unsaved.current }
    const records = getReconciliationRecords(exceptions, key => latest[key]?.reconciliation)
    const record = records.find(row => row.id === id)
    if (!record) return { error: 'The reconciliation record is unavailable.' }
    const previous = latest[id]
    const info = { ...previous?.reconciliation }
    const at = new Date().toISOString()
    let text: string
    if (action.kind === 'match') {
      const blocker = matchBlocker(record, records)
      if (blocker) return { error: blocker }
      if (!action.verified || !action.evidence.trim()) return { error: 'Verify both source records and provide supporting evidence before matching.' }
      info.matched = true
      text = 'Manual match confirmed · ' + record.bank?.id + ' / ' + record.provider?.id + ' · Evidence: ' + action.evidence.trim()
    } else if (action.kind === 'request') {
      if (matchLabel(record) === 'Matched') return { error: 'This record has already been matched.' }
      if (!action.evidence.trim()) return { error: 'Describe the evidence to request.' }
      text = 'Reconciliation evidence requested · ' + action.evidence.trim()
    } else {
      if (!record.caseId) return { error: 'No investigation exists for this transaction.' }
      if (info.linkedCaseId || record.initiallyLinked) return { error: 'This record is already linked to an investigation.' }
      info.linkedCaseId = record.caseId
      text = 'Reconciliation linked to ' + record.caseId
    }
    info.events = [...(info.events ?? []), { at, text, kind: action.kind }]
    const history = record.caseId ? [...(previous?.history ?? []), { at, text }] : previous?.history
    return { text, saved: commit({ ...latest, [id]: { ...previous, reconciliation: info, history } }) }
  }

  return { items, updateCases, recordCaseAction, recordReconciliationAction, resetDemoData, caseInfo: (id: string) => overrides[id] }
}
