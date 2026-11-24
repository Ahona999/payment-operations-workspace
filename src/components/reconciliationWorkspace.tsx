import { useMemo, useState, type FormEvent } from 'react'
import { formatAuditDate, formatAuditTime } from '../data/investigation'
import {
  getDifference, inReconciliationScope, isDiscrepancy, matchBlocker, matchLabel, reconciliationLabels, renderDifference, renderMoney,
  type MatchLabel, type ReconciliationAction, type ReconciliationDateScope, type ReconciliationRecord,
} from '../data/reconciliation'
import { DataTable } from './queue'
import { Badge, Button, ControlPopover, Filter, Icon, Modal, Search, Select } from './ui'

const tabs = ['Unmatched Records', 'Settlement Discrepancies', 'Reconciliation History'] as const
type View = typeof tabs[number]
const dateOptions = { week: '11–17 Nov 2026', today: '17 Nov 2026', all: 'All dates' }
const headings = [
  ['id', 'Transaction ID', 212],
  ['payment', 'Payment Amount', 152],
  ['bank', 'Bank Amount', 152],
  ['difference', 'Difference', 124],
  ['status', 'Match Status', 216],
  ['updated', 'Last Updated', 156],
] as const
type Column = typeof headings[number][0]
const pageSize = 8
const icon = (name: string, size = 12) => <Icon name={`reconciliation/${name}`} size={size} />
const isMissing = (label: MatchLabel) => label.startsWith('Missing')
const updateTime = (record: ReconciliationRecord) => record.info?.events?.at(-1)?.at ?? (record.date + 'T' + record.updated + ':00+05:30')
const labelTone = (label: MatchLabel) => label === 'Matched' ? 'green' : isDiscrepancy(label) ? 'red' : isMissing(label) ? 'amber' : 'neutral'
const values: Record<Column, (record: ReconciliationRecord) => string | number | undefined> = {
  id: record => record.id, payment: record => record.provider?.amount, bank: record => record.bank?.amount,
  difference: getDifference, status: matchLabel, updated: record => Date.parse(updateTime(record)),
}

type Props = {
  records: ReconciliationRecord[]
  query: string
  onQuery: (query: string) => void
  onAction: (id: string, action: ReconciliationAction) => { error?: string; text?: string; saved?: boolean }
  onOpenCase: (id: string) => void
}

function RecordStatus({ record }: { record: ReconciliationRecord }) {
  const label = matchLabel(record)
  return <Badge tone={labelTone(label)}>{label}</Badge>
}

function RecordComparison({ record, blocker, onAction, onOpenCase }: {
  record: ReconciliationRecord
  blocker: string
  onAction: (action: ReconciliationAction) => string | undefined
  onOpenCase: (id: string) => void
}) {
  const [verified, setVerified] = useState(false)
  const [dialog, setDialog] = useState<'match' | 'request' | 'history'>()
  const [dialogError, setDialogError] = useState('')
  const label = matchLabel(record)
  const matched = label === 'Matched'
  const difference = getDifference(record)
  const linked = record.info?.linkedCaseId ?? (record.initiallyLinked ? record.caseId : undefined)
  const events = record.info?.events ?? []
  const latest = events.at(-1)
  const explanation = label === 'Amount mismatch' && difference !== undefined ? `Resolve the ${renderMoney(Math.abs(difference)).replace('.00', '')} variance and verify both sources.`
    : label === 'Reference mismatch' ? 'Resolve the reference difference and verify both sources.'
      : label === 'Settlement discrepancy' ? 'Resolve the settlement difference and verify both sources.'
        : isMissing(label) ? 'Request the missing source record before verifying the match.'
          : matched ? 'The financial records have been matched.' : blocker || 'Compare both source records and verify the supporting evidence.'
  const initialAudit = record.initiallyLinked ? `14:32 · Ananya S. flagged ${renderMoney(Math.abs(difference ?? 0)).replace('.00', '')} variance · No match confirmed.`
    : record.originallyMatched && !record.info?.matched ? 'Seeded ledger match · Included in reconciliation history.' : 'No reconciliation action recorded.'
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const evidence = String(new FormData(event.currentTarget).get('evidence') ?? '')
    const error = dialog === 'match' ? onAction({ kind: 'match', evidence, verified }) : onAction({ kind: 'request', evidence })
    if (error) { setDialogError(error); return }
    setDialog(undefined)
  }
  const open = (next: 'match' | 'request' | 'history') => { setDialogError(''); setDialog(next) }

  return <section className="panel recon-compare" aria-labelledby="recon-selected">
    <div className="recon-selected">
      <h2 id="recon-selected">Selected record · {record.id}</h2><RecordStatus record={record} />
      <span className={difference ? 'warning-text' : ''}>Bank − Payment: {difference === undefined ? 'Not calculable' : renderDifference(difference)}</span>
      <button className="recon-link recon-linked" disabled={!linked} onClick={() => linked && onOpenCase(linked)}>{linked ? 'Linked investigation: ' + linked : 'No linked investigation'}</button>
    </div>
    <div className="recon-comparison-grid">
      {(['bank', 'provider'] as const).map(key => {
        const source = record[key]
        return <article className="recon-source" key={key} aria-label={key === 'bank' ? 'Bank Record' : 'Payment Provider Record'}>
          <div><h3>{key === 'bank' ? 'Bank Record' : 'Payment Provider Record'}</h3><small className={source ? '' : 'warning-text'}>{source ? 'Record available' : 'Record missing'}</small></div>
          <div className={`recon-source-amount ${label === 'Amount mismatch' || !source ? 'recon-variance' : ''}`}><strong>{source ? renderMoney(source.amount) : 'Missing'}</strong><span>Amount</span></div>
          {source ? <><dl>
            <dt>Reference ID</dt><dd className={label === 'Reference mismatch' ? 'recon-field-difference' : ''}>{source.reference}</dd>
            <dt>Timestamp</dt><dd>{source.timestamp}</dd>
            <dt>Payment status</dt><dd>{source.status}</dd>
            {(label === 'Settlement discrepancy' || label === 'Awaiting verification' || matched) && <><dt>Settlement ID</dt><dd className={label === 'Settlement discrepancy' ? 'recon-field-difference' : undefined}>{source.settlement}</dd></>}
          </dl><p>{key === 'bank' ? 'Bank API' : record.providerName + ' API'} · {source.id} · Received {record.updated === '14:32' ? '14:31' : record.updated} IST</p></>
            : <p>Source record unavailable. A missing amount cannot be used as ₹0.</p>}
        </article>
      })}
      <div className="recon-next">
        <h3 className={matched ? '' : 'warning-text'}>{matched ? 'Match recorded' : 'Verification required'}</h3>
        <p>{explanation}</p>
        <label><input type="checkbox" checked={verified} disabled={matched} onChange={event => setVerified(event.target.checked)} />Supporting evidence verified</label>
        <Button variant="primary" disabled={!verified || Boolean(blocker)} onClick={() => open('match')}>Confirm Match</Button>
        <div>
          <Button disabled={matched} onClick={() => open('request')}>Request Evidence</Button>
          <Button disabled={!record.caseId} title={record.caseId ? undefined : 'No case exists for this ledger transaction'} onClick={() => linked ? onOpenCase(linked) : onAction({ kind: 'link' })}>
            {linked || !record.caseId ? 'Open Investigation' : 'Link Investigation'}
          </Button>
        </div>
      </div>
    </div>
    <div className="recon-audit">
      <span>{latest ? formatAuditTime(latest.at) + ' · ' + latest.text : initialAudit}</span>
      <button className="recon-link" onClick={() => open('history')}>No automatic matching of uncertain records · View audit history</button>
    </div>
    {dialog && <Modal title={dialog === 'match' ? 'Confirm manual match' : dialog === 'request' ? 'Request reconciliation evidence' : 'Reconciliation audit history'} onClose={() => setDialog(undefined)}>
      {dialog === 'history' ? <>
        <p>{record.id} · {label}</p>
        {record.caseId && <p>Investigation {record.caseId} · Owner {record.owner}</p>}
        <ol className="inv-history"><li>{initialAudit}</li>{events.map((entry, index) => <li key={entry.at + index}><time dateTime={entry.at}>{formatAuditDate(entry.at)}</time>{entry.text}</li>)}</ol>
      </> : <form className="inv-form" onSubmit={submit}>
        <p>{dialog === 'match' ? `Match the bank and provider records for ${record.id}?` : `Record an evidence request for ${record.id}. The record stays open.`}</p>
        <label>{dialog === 'match' ? 'Supporting evidence reference or note' : 'Evidence to request'}<textarea name="evidence" required maxLength={500} rows={3} /></label>
        {dialogError && <p className="recon-error" role="alert">{dialogError}</p>}
        <Button variant="primary" type="submit">{dialog === 'match' ? 'Confirm manual match' : 'Record evidence request'}</Button>
      </form>}
    </Modal>}
  </section>
}

export function ReconciliationWorkspace({ records, query, onQuery, onAction, onOpenCase }: Props) {
  const [view, setView] = useState<View>(tabs[0])
  const [scope, setScope] = useState<ReconciliationDateScope>('week')
  const [provider, setProvider] = useState('')
  const [status, setStatus] = useState('')
  const [caseFilter, setCaseFilter] = useState('')
  const [menu, setMenu] = useState<'Filter' | 'Sort' | ''>('')
  const [sort, setSort] = useState<{ key: Column; reverse: boolean }>()
  const [selected, setSelected] = useState<string | null>(records[0]?.id ?? null)
  const [pagination, setPagination] = useState({ query, page: 0 })
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>()
  const [confirmationVersion, setConfirmationVersion] = useState(0)
  const scoped = useMemo(() => records.filter(record => inReconciliationScope(record, scope)), [records, scope])
  const counts = scoped.reduce((totals, record) => {
    const label = matchLabel(record)
    if (label === 'Matched') totals[0]++
    else if (isMissing(label)) totals[1]++
    else if (isDiscrepancy(label)) totals[2]++
    else totals[3]++
    return totals
  }, [0, 0, 0, 0])
  const openCount = counts[1] + counts[2] + counts[3]
  const needle = query.trim().toLowerCase()
  const filtered = scoped.filter(record => {
    const label = matchLabel(record)
    if (view === tabs[0] && label === 'Matched' || view === tabs[1] && !isDiscrepancy(label) ||
      view === tabs[2] && label !== 'Matched' && !record.info?.events?.length) return false
    if (provider && record.providerName !== provider || status && label !== status) return false
    if (caseFilter === 'With investigations' && !record.caseId || caseFilter === 'Without investigations' && record.caseId) return false
    return !needle || [record.id, record.caseId, record.reference, record.bank?.reference, record.provider?.reference, record.bank?.settlement, record.provider?.settlement]
      .some(value => value?.toLowerCase().includes(needle))
  })
  if (sort) filtered.sort((a, b) => {
    const x = values[sort.key](a)
    const y = values[sort.key](b)
    if (x === undefined || y === undefined) return Number(x === undefined) - Number(y === undefined)
    return (sort.reverse ? -1 : 1) * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)))
  })
  else if (view === tabs[2]) filtered.sort((a, b) => Number(Boolean(b.info?.events?.length)) - Number(Boolean(a.info?.events?.length)) ||
    Date.parse(updateTime(b)) - Date.parse(updateTime(a)))
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(pagination.query === query ? pagination.page : 0, pages - 1)
  const rows = filtered.slice(page * pageSize, (page + 1) * pageSize)
  const active = selected === null ? undefined : rows.find(row => row.id === selected) ?? rows[0]
  const choose = (row: ReconciliationRecord) => { setSelected(row.id); setFeedback(undefined) }
  const goTo = (next: number) => { setPagination({ query, page: next }); setFeedback(undefined) }
  const changeSort = (key: Column) => { setSort({ key, reverse: sort?.key === key ? !sort.reverse : key !== 'id' && key !== 'status' }); goTo(0); setMenu('') }
  const selectView = (next: View) => {
    setView(next); setStatus(''); goTo(0)
    if (selected === null) setSelected(records[0]?.id ?? null)
  }
  const submit = (action: ReconciliationAction) => {
    if (!active) return
    const result = onAction(active.id, action)
    if (result.error) {
      if (action.kind === 'link') setFeedback({ text: result.error, error: true })
      return result.error
    }
    if (action.kind === 'match') {
      setView(tabs[2]); setStatus(''); setSort(undefined)
      setPagination({ query, page: 0 }); setConfirmationVersion(previous => previous + 1)
    }
    setFeedback({ text: (result.text ?? '') + (result.saved === false ? ' · Saved for this session only' : '') })
  }

  return <main id="main-content" tabIndex={-1} className="overview reconciliation-workspace">
    <div className="overview-heading">
      <div><h1>Reconciliation Workspace</h1><p>Compare records, investigate discrepancies and verify matches.</p></div>
      <small className="case-updated">Updated {formatAuditTime(scoped.reduce((latest, record) => {
        const event = record.info?.events?.at(-1)?.at
        return event && Date.parse(event) > Date.parse(latest) ? event : latest
      }, '2026-11-17T14:32:00+05:30'))} IST</small>
    </div>
    <dl className="panel case-summary recon-summary">
      {['Matched', 'Unmatched', 'Discrepancies', 'Awaiting Verification'].map((name, index) => <div key={name}><dt>{name}</dt><dd>{counts[index].toLocaleString('en-IN')}</dd></div>)}
    </dl>
    <section className="panel recon-records" aria-label="Reconciliation records">
      <nav className="case-views recon-tabs" aria-label="Reconciliation views">
        {tabs.map((tab, index) => <button key={tab} aria-pressed={view === tab} onClick={() => selectView(tab)}>{tab}{index < 2 && <span>{index === 0 ? openCount : counts[2]}</span>}</button>)}
      </nav>
      <div className="recon-toolbar">
        <Search icon="reconciliation/Group" label="Search transaction or reference…" value={query} onChange={onQuery} />
        <label className="filter recon-date"><span className="sr-only">Reconciliation date range</span><Select value={scope} onChange={event => { setScope(event.target.value as ReconciliationDateScope); goTo(0) }}>
          {Object.entries(dateOptions).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </Select><Icon name="FilterDropdown" size={10} /></label>
        <Filter label="All providers" options={['PayBridge', 'SettlePay']} value={provider} onChange={value => { setProvider(value); goTo(0) }} />
        <Filter label="All statuses" options={reconciliationLabels} value={status} onChange={value => { setStatus(value); goTo(0) }} />
        {(['Filter', 'Sort'] as const).map((name, index) => <div className="case-control" key={name}>
          <Button aria-expanded={menu === name} onClick={() => setMenu(menu === name ? '' : name)}>{icon('Group' + (index + 1), 13)}{name}</Button>
          {menu === name && <ControlPopover label={name + ' options'} onDismiss={() => setMenu('')}>
            {name === 'Filter' ? <><Filter label="Investigation availability" options={['With investigations', 'Without investigations']} value={caseFilter}
              onChange={value => { setCaseFilter(value); goTo(0) }} />
              <Button onClick={() => { setProvider(''); setStatus(''); setScope('week'); setCaseFilter(''); onQuery(''); goTo(0); setMenu('') }}>Clear filters</Button></>
              : <>{headings.map(([key, label]) => <button key={key} onClick={() => changeSort(key)}>{label}</button>)}<button onClick={() => { setSort(undefined); goTo(0); setMenu('') }}>Default order</button></>}
          </ControlPopover>}
        </div>)}
      </div>
      <DataTable>
        <colgroup><col style={{ width: 40 / 11.6 + '%' }} />{headings.map(([key, , width]) => <col key={key} style={{ width: width / 11.6 + '%' }} />)}<col /></colgroup>
        <thead><tr><th scope="col"><input type="checkbox" disabled aria-label="Select one reconciliation record at a time" title="Select one reconciliation record at a time" /></th>
          {headings.map(([key, label]) => <th scope="col" key={key} aria-sort={sort?.key === key ? sort.reverse ? 'descending' : 'ascending' : undefined}>
            <button onClick={() => changeSort(key)}>{label}{sort?.key === key ? sort.reverse ? ' ↓' : ' ↑' : ''}</button>
          </th>)}<th scope="col">Action</th></tr></thead>
        <tbody>
          {rows.map(record => {
            const label = matchLabel(record)
            const difference = getDifference(record)
            return <tr key={record.id} className={active?.id === record.id ? 'recon-selected-row' : undefined}>
              <td><input type="checkbox" aria-label={`Select ${record.id}`} checked={active?.id === record.id} onChange={event => event.target.checked ? choose(record) : setSelected(null)} /></td>
              <td><button className="recon-link" onClick={() => choose(record)}>{record.id}</button></td>
              <td className={!record.provider ? 'warning-text' : ''}>{record.provider ? renderMoney(record.provider.amount) : 'Missing'}</td>
              <td className={!record.bank ? 'warning-text' : ''}>{record.bank ? renderMoney(record.bank.amount) : 'Missing'}</td>
              <td className={difference ? 'recon-error' : ''}>{difference === undefined ? 'Not calculable' : renderDifference(difference)}</td>
              <td><RecordStatus record={record} /></td>
              <td>{formatAuditTime(updateTime(record))} IST</td>
              <td><Button onClick={() => choose(record)} aria-label={`${label === 'Awaiting verification' ? 'Verify' : isMissing(label) ? 'Request' : 'Review'} ${record.id}`}>{label === 'Awaiting verification' ? 'Verify' : isMissing(label) ? 'Request' : 'Review'}</Button></td>
            </tr>
          })}
          {rows.length === 0 && <tr><td colSpan={8} className="empty-table">No reconciliation records match your search and filters.</td></tr>}
        </tbody>
      </DataTable>
      <footer className="recon-pagination">
        <span>{filtered.length ? page * pageSize + 1 : 0}–{page * pageSize + rows.length} of {filtered.length} {view === tabs[0] ? 'unresolved ' : ''}records · INR · Difference = Bank − Payment</span>
        <span className="warning-text">Missing ≠ ₹0</span><span>Page {page + 1} of {pages}</span>
        <Button aria-label="Previous page" disabled={page === 0} onClick={() => goTo(page - 1)}>{icon('Group3', 10)}</Button>
        <Button aria-label="Next page" disabled={page + 1 >= pages} onClick={() => goTo(page + 1)}>{icon('Group4', 10)}</Button>
      </footer>
    </section>
    {feedback && <p className={`inv-feedback ${feedback.error ? 'recon-error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    {active ? <RecordComparison key={active.id + ':' + confirmationVersion} record={active} blocker={matchBlocker(active, records)} onAction={submit} onOpenCase={onOpenCase} />
      : <section className="panel recon-compare recon-empty">Select a record to compare its bank and payment provider evidence.</section>}
  </main>
}
