import { useState, type FormEvent } from 'react'
import { formatAge, formatAmount, owners, priorities, type ExceptionCase } from '../data/exceptions'
import {
  canRecordOutcome, evidenceKeys, evidenceRequirements, formatAuditDate, formatAuditTime, formatCaseDate,
  getCaseEvidence, outcomes, type EvidenceKey, type EvidenceReceipts, type HistoryEntry, type InvestigationAction, type Outcome,
} from '../data/investigation'
import { Badge, Button, Icon, Modal, Select } from './ui'

type Dialog = 'owner' | 'priority' | 'history' | 'note' | 'request' | 'escalate' | 'resolve' | 'close'
  | { kind: 'inspect'; title: string; detail: string } | { kind: 'verify'; key: EvidenceKey }

interface Props {
  item: ExceptionCase
  info?: { history?: HistoryEntry[]; evidence?: EvidenceReceipts; outcome?: Outcome }
  onAction: (action: InvestigationAction) => { error?: string; text?: string; saved?: boolean }
  onBack: (destination: 'exceptions' | 'investigations') => void
}

const dialogTitles: Record<Dialog & string, string> = {
  owner: 'Change assignee', priority: 'Change priority', history: 'Audit history', note: 'Add case note',
  request: 'Request evidence', escalate: 'Escalate case', resolve: 'Confirm investigation outcome', close: 'Confirm case closure',
}

export function InvestigationWorkspace({ item, info, onAction, onBack }: Props) {
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const evidence = getCaseEvidence(item)
  const [date, opened] = [formatCaseDate(item.detectedOn), '13:10']
  const receipts = info?.evidence ?? {}
  const verified = evidenceKeys.filter(key => receipts[key]).length
  const supported = outcomes.find(outcome => canRecordOutcome(receipts, outcome))
  const closed = item.investigation === 'Closed'
  const outcome = info?.outcome
  const history = info?.history ?? []
  const latest = history.at(-1)
  const statusTone = item.investigation === 'Escalated' ? 'red' : item.investigation === 'Awaiting evidence' ? 'amber' : item.investigation === 'Investigating' ? 'green' : 'neutral'
  const selectionTimeline = evidence.events
  const paymentTone = item.payment === 'Failed' ? 'red' : item.payment === 'Successful' ? 'green' : 'amber'
  const open = (next: Dialog) => { setError(''); setDialog(next) }
  const inspect = (title: string, detail: string) => open({ kind: 'inspect', title, detail })
  const submit = (action: InvestigationAction) => {
    const result = onAction(action)
    if (result.error) { setError(result.error); return }
    setDialog(null)
    setFeedback((result.text ?? '') + (result.saved === false ? ' · Saved for this session only' : ''))
  }
  const back = (event: React.MouseEvent<HTMLAnchorElement>, destination: 'exceptions' | 'investigations') => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onBack(destination)
  }
  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const text = String(data.get('text') ?? '')
    if (dialog === 'owner') submit({ kind: 'owner', owner: String(data.get('value')) as ExceptionCase['owner'] })
    if (dialog === 'priority') submit({ kind: 'priority', priority: String(data.get('value')) as ExceptionCase['priority'] })
    if (dialog === 'note' || dialog === 'request' || dialog === 'escalate') submit({ kind: dialog, text })
    if (dialog && typeof dialog === 'object' && dialog.kind === 'verify') {
      submit({ kind: 'verify', key: dialog.key, reference: text, outcome: String(data.get('value')) as Outcome })
    }
  }
  const flag = (key: EvidenceKey, fallback: string) => receipts[key]?.outcome ?? fallback
  const evidenceCell = (key: EvidenceKey, label: string, initial: string) => <button className="inv-evidence-link" onClick={() =>
    inspect(label, receipts[key] ? `Verified final evidence · ${receipts[key]?.reference} · ${receipts[key]?.outcome}` : initial)}>
    {label}
  </button>

  return <main id="main-content" tabIndex={-1} className="overview investigation-workspace">
    <nav className="inv-breadcrumb" aria-label="Breadcrumb"><a href="/investigations" onClick={event => back(event, 'investigations')}>Investigations</a><span>/</span><a href="/exceptions" onClick={event => back(event, 'exceptions')}>Exception Queue</a><span>/</span><span aria-current="page">Case Details</span></nav>
    <div className="inv-header">
      <h1>{item.caseId}<span className="inv-title-dot">·</span>{formatAmount(item.amount)}</h1>
      <Badge tone={paymentTone}>{item.payment === 'Unknown' ? 'Unknown payment outcome' : item.payment + ' payment outcome'}</Badge>
      <div className="inv-status"><span>Case status</span><Badge tone={statusTone}>{item.investigation}</Badge><button onClick={() => open('priority')} disabled={closed} aria-label={`${item.priority} Priority. Change priority`}><Badge tone={item.priority === 'Urgent' ? 'red' : item.priority === 'High' ? 'amber' : 'neutral'}>{item.priority} Priority</Badge></button></div>
    </div>
    <div className="inv-meta">
      <span>Owner&nbsp; {item.owner}</span><Button onClick={() => open('owner')} disabled={closed}>Change assignee</Button>
      <span>Case age&nbsp; {formatAge(item.age)}</span><span>Opened {date}, {opened} IST</span>
      <small>Updated {latest ? formatAuditTime(latest.at) : '14:32'} IST</small>
    </div>
    <div className="inv-warning">{outcome ? 'Verified investigation outcome: ' + outcome + '.' : evidence.warning}</div>
    <div className="inv-feedback" role="status">{feedback}</div>
    <div className="inv-panels">
      <div className="inv-evidence">
        <section className="panel inv-panel inv-transaction" aria-labelledby="inv-transaction">
          <h2 id="inv-transaction">Transaction summary</h2>
          <dl>
            <div><dt>Transaction ID</dt><dd>{item.id}</dd></div>
            <div><dt>Amount</dt><dd>{formatAmount(item.amount)}.00</dd></div>
            <div><dt>Method</dt><dd>{item.rail}</dd></div>
            <div><dt>Reference ID · UTR</dt><dd>{evidence.reference}</dd></div>
            <div><dt>Payment date</dt><dd>{date}</dd></div>
          </dl>
        </section>
        <section className="panel inv-panel inv-timeline" aria-labelledby="inv-timeline">
          <div className="inv-panel-heading"><h2 id="inv-timeline">Payment timeline</h2><span>{date} · All times IST</span></div>
          <ol>{selectionTimeline.map(event => <li key={event.time}>
            <button onClick={() => inspect(event.title, `${event.time} IST · ${event.source}\n${event.detail}`)}>
              <time>{event.time}</time>
              <span className="inv-marker"><Icon name={'investigation/EventMarker' + (event.tone === 'red' ? '1' : event.tone === 'amber' ? '2' : '')} size={12} height={39} /></span>
              <span className="inv-event-text"><strong>{event.title}</strong><small>{event.source}</small></span>
              <Badge tone={event.tone}>{event.label}</Badge>
            </button>
          </li>)}</ol>
          <p className="inv-panel-note">Event time shown above; receipt times retained for audit.</p>
        </section>
        <section className="panel inv-panel inv-compare" aria-labelledby="inv-compare">
          <div className="inv-panel-heading"><h2 id="inv-compare">Evidence comparison</h2>{evidence.conflict && !supported && <Badge tone="red">2 records conflict</Badge>}</div>
          <div className="inv-table-box"><table>
            <thead><tr><th>Evidence</th><th>{evidenceCell('bank', 'Bank Record', evidence.bankSignal + ' · ' + evidence.bankReference)}</th><th>{evidenceCell('provider', 'Payment Provider Record', evidence.reported + ' · ' + evidence.providerReference)}</th><th>{evidenceCell('recipient', 'Recipient Confirmation', 'Recipient credit is unconfirmed.')}</th></tr></thead>
            <tbody>
              <tr className="inv-reported"><th scope="row">Reported<br />signal</th><td>{evidence.bankSignal}</td><td className={evidence.conflict ? 'inv-conflict' : ''}>{evidence.reported}</td><td className="inv-missing">Credit unconfirmed</td></tr>
              <tr><th scope="row">Verification</th><td>{flag('bank', evidence.bankVerification)}</td><td>{flag('provider', evidence.providerVerification)}</td><td>{flag('recipient', 'Missing · not verified')}</td></tr>
              <tr><th scope="row">Source /<br />received</th><td>Bank API · {evidence.bankReference}<br />{receipts.bank?.reference ?? '13:10:02 IST'}</td><td>Webhook · {evidence.providerReference}<br />{receipts.provider?.reference ?? '13:10:01 IST'}</td><td>{receipts.recipient?.reference ?? (evidence.upi ? 'REQ-118 · requested' : 'Awaiting source')}<br />{evidence.upi && !receipts.recipient ? '13:18:00 IST' : ''}</td></tr>
            </tbody>
          </table></div>
          <p className="inv-panel-note inv-missing">{supported ? 'All three verified records support the same outcome.' : 'Verified source ≠ verified outcome. No refund or reversal evidence received.'}</p>
        </section>
      </div>
      <div className="inv-controls">
        <section className="panel inv-panel inv-summary" aria-labelledby="inv-summary">
          <h2 id="inv-summary">Investigation summary</h2>
          <strong>What we know</strong><p>{evidence.known}</p>
          <strong className="inv-missing">{supported ? 'Verified final outcome' : 'What remains unknown'}</strong>
          <p>{supported ?? <>Recipient credit and the final movement of funds.<br />No verified refund or reversal.</>}</p>
        </section>
        <section className="panel inv-panel inv-checklist" aria-labelledby="inv-checklist">
          <div className="inv-panel-heading"><h2 id="inv-checklist">Missing evidence</h2><span className="inv-missing">{verified} of 3 verified</span></div>
          <ul>{evidenceKeys.map((key, index) => <li key={key}><button onClick={() => closed
            ? inspect(evidenceRequirements[index], receipts[key]?.reference ?? 'No verification was recorded.')
            : open({ kind: 'verify', key })}>
            <span className={'inv-check' + (receipts[key] ? ' verified' : '')} aria-label={receipts[key] ? 'Verified' : 'Missing'}>{receipts[key] ? '✓' : ''}</span>
            {evidenceRequirements[index]}
          </button></li>)}</ul>
        </section>
        <section className="panel inv-panel inv-activity" aria-labelledby="inv-activity">
          <div className="inv-panel-heading"><h2 id="inv-activity">Ownership &amp; activity</h2><button className="inv-text-button" onClick={() => open('history')}>Audit history</button></div>
          <strong>{item.owner}{item.owner !== 'Unassigned' ? ' · Finance Operations' : ''}</strong>
          <ul>{history.length ? history.slice(-2).map((entry, index) => <li key={entry.at + index}><time dateTime={entry.at}>{formatAuditTime(entry.at)}</time>{entry.text}</li>)
            : <><li><time>13:10</time>System created {item.caseId}.</li>{evidence.upi && <li><time>13:18</time>Ananya S. requested recipient evidence.</li>}</>}</ul>
        </section>
        <section className="panel inv-panel inv-actions" aria-labelledby="inv-actions">
          <h2 id="inv-actions">Next actions</h2>
          <div className="inv-actions-grid">
            <Button variant="primary" onClick={() => open('request')} disabled={closed}>Request Evidence</Button>
            <Button onClick={() => open('escalate')} disabled={closed}>Escalate Case</Button>
            <Button onClick={() => open('resolve')} disabled={closed || Boolean(outcome)}>Record Outcome</Button>
            <Button onClick={() => open('close')} disabled={closed || !outcome || !supported}>Close Case</Button>
          </div>
          <p className="inv-panel-note">{closed ? 'Case closed.' : !supported ? 'Closure locked: complete all 3 verifications.' : !outcome ? 'Record the verified outcome before closing.' : 'Verified outcome recorded. Case can be closed.'}<br />No automatic retry. Outcome records require review.</p>
        </section>
      </div>
    </div>

    {dialog && <Modal title={typeof dialog === 'string' ? dialogTitles[dialog] : dialog.kind === 'inspect' ? dialog.title : 'Verify evidence'} onClose={() => setDialog(null)}>
      {typeof dialog === 'object' && dialog.kind === 'inspect' && <p className="inv-inspect">{dialog.detail}</p>}
      {dialog === 'history' && <>
        <p>Payment: {item.payment} · Investigation: {item.investigation} · Reconciliation: {item.reconciliation}</p>
        <ol className="inv-history"><li><time>{date}, 13:10 IST</time>System created {item.caseId}.</li>
          {evidence.upi && <li><time>{date}, 13:18 IST</time>Ananya S. requested recipient evidence.</li>}
          {history.map((entry, index) => <li key={entry.at + index}><time dateTime={entry.at}>{formatAuditDate(entry.at)}</time>{entry.text}</li>)}
        </ol>
        {!closed && <Button onClick={() => open('note')}>Add note</Button>}
      </>}
      {dialog === 'resolve' && <>
        <p>{supported ? `Record “${supported}” for ${item.caseId}? This records an investigation outcome without changing the payment or reconciliation status.`
          : verified === 3 ? 'The verified records report conflicting outcomes or reuse a reference. Resolve the discrepancy before recording an outcome.'
            : 'All three required evidence sources must be verified before an outcome can be recorded.'}</p>
        {supported && <Button className="inv-dialog-submit" variant="primary" onClick={() => submit({ kind: 'resolve', outcome: supported })}>Confirm outcome</Button>}
      </>}
      {dialog === 'close' && <><p>Close {item.caseId} using the recorded outcome “{outcome}”? This updates only the investigation status.</p>
        <Button className="inv-dialog-submit" variant="primary" onClick={() => submit({ kind: 'close' })}>Confirm close</Button></>}
      {(dialog === 'owner' || dialog === 'priority' || dialog === 'note' || dialog === 'request' || dialog === 'escalate' || typeof dialog === 'object' && dialog.kind === 'verify') &&
        <form className="inv-form" onSubmit={submitForm}>
          {(dialog === 'owner' || dialog === 'priority') && <label>{dialog === 'owner' ? 'Assignee' : 'Priority'}<Select name="value" defaultValue={dialog === 'owner' ? item.owner : item.priority}>
            {(dialog === 'owner' ? owners : priorities).map(value => <option key={value}>{value}</option>)}</Select></label>}
          {(dialog === 'note' || dialog === 'request' || dialog === 'escalate') && <label>{dialog === 'note' ? 'Case note' : dialog === 'request' ? 'Evidence to request' : 'Escalation reason'}
            <textarea name="text" rows={3} required maxLength={600} defaultValue={dialog === 'request'
              ? evidenceRequirements.filter((_, index) => !receipts[evidenceKeys[index]]).join('; ') : ''} /></label>}
          {typeof dialog === 'object' && dialog.kind === 'verify' && <>
            <p>{evidenceRequirements[evidenceKeys.indexOf(dialog.key)]}</p>
            <label>Verified evidence reference<input name="text" required maxLength={120} defaultValue={receipts[dialog.key]?.reference} /></label>
            <label>Verified final outcome<Select name="value" required defaultValue={receipts[dialog.key]?.outcome ?? ''}><option value="" disabled>Select verified outcome</option>{outcomes.map(value => <option key={value}>{value}</option>)}</Select></label>
          </>}
          <Button type="submit" variant="primary">{dialog === 'request' ? 'Record evidence request' : dialog === 'escalate' ? 'Confirm escalation' : 'Save'}</Button>
        </form>}
      {error && <p className="inv-conflict" role="alert">{error}</p>}
    </Modal>}
  </main>
}
