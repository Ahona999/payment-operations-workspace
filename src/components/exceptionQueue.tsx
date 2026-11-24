import { useState, type ReactNode } from 'react'
import { caseStatuses, formatAge, formatAmount, isOverdue, owners, paymentStatuses, priorities, type ExceptionCase } from '../data/exceptions'
import { DataTable } from './queue'
import { Badge, Button, ControlPopover, Filter, Icon, Search, Select } from './ui'

const columns = [
  { key: 'caseId', label: 'Case ID / Transaction ID', width: 170 },
  { key: 'amount', label: 'Amount (₹)', width: 104 },
  { key: 'type', label: 'Exception Type', width: 166 },
  { key: 'payment', label: 'Payment Status', width: 108 },
  { key: 'investigation', label: 'Case Status', width: 140 },
  { key: 'priority', label: 'Priority', width: 80 },
  { key: 'age', label: 'Age', width: 130 },
  { key: 'owner', label: 'Assigned To', width: 130 },
] as const
type SortKey = typeof columns[number]['key']
type View = 'All Cases' | 'Assigned to Me' | 'Unassigned' | 'Escalated'
type FilterKey = 'investigation' | 'currency' | 'priority' | 'payment' | 'owner' | 'alert'
type Changes = Partial<Pick<ExceptionCase, 'owner' | 'priority'>>

export interface QueueAlert {
  label: string
  matches: (item: ExceptionCase) => boolean
}

const viewTests: Record<View, (item: ExceptionCase) => boolean> = {
  'All Cases': () => true,
  'Assigned to Me': item => item.owner === 'Ananya S.',
  Unassigned: item => item.owner === 'Unassigned',
  Escalated: item => item.investigation === 'Escalated',
}
const defaultFilters = { investigation: 'Unresolved', currency: 'INR', priority: '', payment: '', owner: '', alert: '' }
const filterNames: Record<FilterKey, string> = {
  investigation: 'Case status', currency: 'Currency', priority: 'Priority', payment: 'Payment status', owner: 'Assigned to', alert: 'Alert',
}
const individualOptions = {
  investigation: ['Unresolved', ...caseStatuses],
  currency: ['INR'],
  priority: priorities,
  payment: paymentStatuses,
  owner: owners,
}
const graph = (name: string, size: number) => <Icon name={`queue/${name}`} size={size} />

function CheckCase({ label, checked, mixed, onChange }: { label: string; checked: boolean; mixed?: boolean; onChange: (checked: boolean) => void }) {
  return <label className="case-check">
    <input aria-label={label} title={label} type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)}
      ref={node => { if (node) node.indeterminate = Boolean(mixed) }} />
    <span aria-hidden="true">{mixed ? graph('1-SomeCasesSelected', 12) : checked ? graph('1-SelectedCheckmark', 12) : null}</span>
  </label>
}

function CaseStatus({ value, kind }: { value: string; kind: 'payment' | 'case' | 'priority' }) {
  const tone = ['Failed', 'Urgent', 'Escalated'].includes(value) ? 'red'
    : ['Pending', 'High', 'Awaiting evidence'].includes(value) ? 'amber'
    : ['Successful', 'Investigating'].includes(value) ? 'green' : 'neutral'
  return <span className={`case-label case-${kind}`}><Badge tone={tone}>{value}</Badge></span>
}

function BulkToolbar({ count, onClear, onApply }: { count: number; onClear: () => void; onApply: (changes: Changes) => void }) {
  const [owner, setOwner] = useState<ExceptionCase['owner'] | ''>('Ananya S.')
  const [priority, setPriority] = useState<ExceptionCase['priority'] | ''>('')
  return <div className="case-control-row case-bulk" aria-label="Bulk actions">
    <strong>{count} selected</strong><button className="case-link" onClick={onClear}>Deselect all</button>
    <div className="case-spacer" />
    <label className="bulk-select"><span className="sr-only">Assign to</span>
      <Select value={owner} onChange={event => setOwner(event.target.value as typeof owner)}>
        <option value="">Assign to: Keep current</option>
        {owners.map(value => <option value={value} key={value}>Assign to: {value}</option>)}
      </Select>{graph('1-DropdownChevron', 12)}
    </label>
    <label className="bulk-select"><span className="sr-only">Bulk priority</span>
      <Select value={priority} onChange={event => setPriority(event.target.value as typeof priority)}>
        <option value="">Priority: Keep current</option>
        {priorities.map(value => <option key={value} value={value}>Priority: {value}</option>)}
      </Select>{graph('1-DropdownChevron', 12)}
    </label>
    <Button variant="primary" disabled={!owner && !priority} onClick={() => onApply({ ...(owner ? { owner } : {}), ...(priority ? { priority } : {}) })}>
      {owner ? 'Assign' : 'Update'} {count} {count === 1 ? 'case' : 'cases'}
    </Button>
  </div>
}

export function ExceptionQueue({ items, query, onQuery, initialAlert, onClearAlert, onOpenCase, onUpdate }: {
  items: readonly ExceptionCase[]
  query: string
  onQuery: (value: string) => void
  initialAlert?: QueueAlert
  onClearAlert: () => void
  onOpenCase: (id: string) => void
  onUpdate: (ids: string[], changes: Changes) => boolean
}) {
  const [view, setView] = useState<View>('All Cases')
  const [filters, setFilters] = useState({ ...defaultFilters, alert: initialAlert?.label ?? '' })
  const [menu, setMenu] = useState<'Filter' | 'Sort' | 'Columns' | ''>('')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>()
  const [hidden, setHidden] = useState<SortKey[]>([])
  const [pagination, setPagination] = useState({ query, page: 0 })
  const [pageSize, setPageSize] = useState(10)
  const [selection, setSelection] = useState<Set<string>>(() => new Set())
  const [feedback, setFeedback] = useState('')
  if (pagination.query !== query) {
    setPagination({ query, page: 0 })
    setSelection(new Set())
    setFeedback('')
  }
  const selected = selection
  const page = pagination.page
  const goTo = (next: number) => setPagination({ query, page: next })
  const clearSelection = () => setSelection(new Set())
  const resetScope = () => { goTo(0); clearSelection(); setFeedback('') }
  const openCases = items.filter(item => item.investigation !== 'Closed')
  const viewCounts = Object.fromEntries(Object.entries(viewTests).map(([name, test]) => [name, openCases.filter(test).length]))
  const summary = [
    ['Total Open', openCases.length],
    ['Unassigned', viewCounts.Unassigned],
    ['High Priority', openCases.filter(item => item.priority === 'Urgent' || item.priority === 'High').length],
    ['Ageing Cases', openCases.filter(isOverdue).length],
  ] as const
  const needle = query.trim().toLowerCase()
  const results = items.filter(item => {
    if (view !== 'All Cases' && (item.investigation === 'Closed' || !viewTests[view](item))) return false
    if (needle && ![item.caseId, item.id, item.reference, item.utr].some(value => value?.toLowerCase().includes(needle))) return false
    if (filters.alert && !initialAlert?.matches(item)) return false
    if (filters.investigation === 'Unresolved' && item.investigation === 'Closed') return false
    return (Object.keys(individualOptions) as (keyof typeof individualOptions)[]).every(key =>
      !filters[key] || key === 'investigation' && filters[key] === 'Unresolved' || item[key] === filters[key])
  })
  if (sort) results.sort((left, right) => {
    const a = left[sort.key]
    const b = right[sort.key]
    if (sort.key === 'priority') return (sort.desc ? 1 : -1) * (priorities.indexOf(left.priority) - priorities.indexOf(right.priority)) || right.age - left.age
    return (sort.desc ? -1 : 1) * (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)))
  })
  const pageCount = Math.max(1, Math.ceil(results.length / pageSize))
  const currentPage = Math.min(pageCount - 1, page)
  const first = currentPage * pageSize
  const pageItems = results.slice(first, first + pageSize)
  const resultIds = new Set(results.map(item => item.id))
  const selectedIds = [...selected].filter(id => resultIds.has(id))
  const allPageSelected = pageItems.length > 0 && pageItems.every(item => selected.has(item.id))
  const somePageSelected = !allPageSelected && pageItems.some(item => selected.has(item.id))
  const visibleColumns = columns.filter(column => !hidden.includes(column.key))
  const tableUnits = visibleColumns.reduce((width, column) => width + column.width, 132)
  const activeFilters = (Object.keys(filters) as FilterKey[]).filter(key => filters[key])
  const updateFilter = (key: FilterKey, value: string) => {
    if (key === 'alert' && !value) onClearAlert()
    setFilters(previous => ({ ...previous, [key]: value }))
    resetScope()
  }
  const selectRows = (rows: ExceptionCase[], value: boolean) => {
    const next = new Set(selected)
    rows.forEach(item => value ? next.add(item.id) : next.delete(item.id))
    setSelection(next)
    setFeedback('')
  }
  const changeSort = (key: SortKey) => {
    setSort({ key, desc: sort?.key === key ? !sort.desc : ['priority', 'age', 'amount'].includes(key) })
    goTo(0)
  }
  const applyChanges = (changes: Changes) => {
    const count = selectedIds.length
    if (!count) return
    const persisted = onUpdate(selectedIds, changes)
    clearSelection()
    setFeedback(`Updated ${count} ${count === 1 ? 'case' : 'cases'}${changes.owner ? ' · Assigned to ' + changes.owner : ''}${changes.priority ? ' · ' + changes.priority + ' priority' : ''}${persisted ? '' : ' · Saved for this session only'}`)
  }
  const openCase = (event: React.MouseEvent<HTMLAnchorElement>, caseId: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onOpenCase(caseId)
  }

  function renderCell(item: ExceptionCase, key: SortKey): ReactNode {
    switch (key) {
      case 'caseId': return <><a className="case-id" href={`/investigations/${item.caseId}`} onClick={event => openCase(event, item.caseId)}>{item.caseId}</a><small>{item.id}</small></>
      case 'amount': return formatAmount(item.amount)
      case 'type': return item.type
      case 'payment': return <CaseStatus kind="payment" value={item.payment} />
      case 'investigation': return <CaseStatus kind="case" value={item.investigation} />
      case 'priority': return <CaseStatus kind="priority" value={item.priority} />
      case 'age': return item.investigation === 'Escalated' && isOverdue(item)
        ? <span className="case-overdue">{formatAge(item.age)}<small>Internal review overdue</small></span> : formatAge(item.age)
      case 'owner': return <span className={item.owner === 'Unassigned' ? 'warning-text' : undefined}>{item.owner}</span>
    }
  }

  return <main id="main-content" tabIndex={-1} className="overview exception-screen">
    <div className="overview-heading">
      <div><h1>Exception Queue</h1><p>Investigate and manage unresolved payment exceptions.</p></div>
      <small className="case-updated">Updated 14:32 IST</small>
    </div>
    <dl className="panel case-summary">
      {summary.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
    <section className="panel case-table" aria-label="Exception cases">
      <nav className="case-views" aria-label="Saved views">
        {(Object.keys(viewTests) as View[]).map(name => <button key={name} aria-pressed={view === name} onClick={() => { setView(name); resetScope() }}>
          {name}<span>{viewCounts[name]}</span>
        </button>)}
      </nav>
      {selectedIds.length ? <BulkToolbar count={selectedIds.length} onClear={clearSelection} onApply={applyChanges} /> :
        <div className="case-control-row case-controls">
          <div className="case-search"><Search icon="queue/0-Group" label="Search case ID or transaction ID" accessibleLabel="Search case ID, transaction ID or reference" value={query} onChange={value => { clearSelection(); setPagination({ query: value, page: 0 }); onQuery(value) }} /></div>
          <div className="case-spacer" />
          {(['Filter', 'Sort', 'Columns'] as const).map((name, index) => <div className="case-control" key={name}>
            <Button aria-expanded={menu === name} onClick={() => setMenu(previous => previous === name ? '' : name)}>{graph(`0-Group${index + 1}`, 13)}{name}</Button>
            {menu === name && <ControlPopover label={name + ' options'} onDismiss={() => setMenu('')}>
              {name === 'Filter' && (Object.keys(individualOptions) as (keyof typeof individualOptions)[]).map(key =>
                <Filter key={key} label={filterNames[key]} value={filters[key]} options={individualOptions[key]} onChange={value => updateFilter(key, value)} />)}
              {name === 'Sort' && <><button onClick={() => { setSort(undefined); goTo(0); setMenu('') }}>Default queue order</button>{visibleColumns.map(column => <button key={column.key} onClick={() => { changeSort(column.key); setMenu('') }}>{column.label}</button>)}</>}
              {name === 'Columns' && columns.filter(column => column.key !== 'caseId').map(column => <label key={column.key}><input type="checkbox" checked={!hidden.includes(column.key)} onChange={() => setHidden(previous => previous.includes(column.key) ? previous.filter(key => key !== column.key) : [...previous, column.key])} />{column.label}</label>)}
            </ControlPopover>}
          </div>)}
        </div>}
      <div className="case-filters">
        {activeFilters.length > 0 && <><span>Filtered by</span>{activeFilters.map(key => <button key={key} className="case-chip" data-filter={key} aria-label={`Remove filter: ${filterNames[key]}: ${filters[key]}`} onClick={() => updateFilter(key, '')}>
          {filterNames[key]}: {filters[key]}{graph(selectedIds.length ? '1-Group' : '0-Group4', 8)}
        </button>)}<button className="case-link" onClick={() => { if (filters.alert) onClearAlert(); setFilters({ investigation: '', currency: '', priority: '', payment: '', owner: '', alert: '' }); resetScope() }}>Clear Filters</button></>}
        <span className="case-spacer" /><span className="case-sort-caption">{sort ? `${columns.find(column => column.key === sort.key)?.label} ${sort.desc ? '↓' : '↑'}` : 'Priority ↓ · Age ↓'}</span>
      </div>
      <div className="case-feedback" role="status">{feedback}</div>
      <DataTable>
        <colgroup><col style={{ width: 40 / tableUnits * 100 + '%' }} />{visibleColumns.map(column => <col key={column.key} style={{ width: column.width / tableUnits * 100 + '%' }} />)}<col style={{ width: 92 / tableUnits * 100 + '%' }} /></colgroup>
        <thead><tr>
          <th scope="col"><CheckCase label="Select all cases on this page" checked={allPageSelected} mixed={somePageSelected} onChange={value => selectRows(pageItems, value)} /></th>
          {visibleColumns.map(column => <th key={column.key} scope="col" aria-sort={sort?.key === column.key ? sort.desc ? 'descending' : 'ascending' : undefined}>
            <button className="case-table-sort" onClick={() => changeSort(column.key)}>{column.label}{column.key !== 'caseId' && (sort?.key === column.key
              ? <span aria-hidden="true">{sort.desc ? '↓' : '↑'}</span> : graph(selectedIds.length ? '1-Group1' : '0-Group5', 8))}</button>
          </th>)}
          <th scope="col">Action</th>
        </tr></thead>
        <tbody>{pageItems.map(item => <tr key={item.id} className={selected.has(item.id) ? 'case-selected' : undefined}>
          <td><CheckCase label={`Select ${item.caseId}`} checked={selected.has(item.id)} onChange={value => selectRows([item], value)} /></td>
          {visibleColumns.map(column => <td key={column.key} className={`case-cell-${column.key}`}>{renderCell(item, column.key)}</td>)}
          <td><Button onClick={() => item.owner === 'Unassigned' ? selectRows([item], true) : onOpenCase(item.caseId)} aria-label={`${item.owner === 'Unassigned' ? 'Assign' : 'Review'} ${item.caseId}`}>{item.owner === 'Unassigned' ? 'Assign' : 'Review'}</Button></td>
        </tr>)}
        {pageItems.length === 0 && <tr><td className="empty-table" colSpan={visibleColumns.length + 2}>No cases match your search and filters.</td></tr>}</tbody>
      </DataTable>
      <footer className="case-pagination">
        <span>{results.length ? first + 1 : 0}–{first + pageItems.length} of {results.length} cases · Amounts in INR</span>
        <div className="case-spacer" />
        <label>Rows per page <span className="case-page-size">{graph(selectedIds.length ? '1-Group2' : '0-Group6', 10)}
          <Select aria-label="Rows per page" value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); goTo(0) }}>
            {[10, 20, 50].map(size => <option key={size}>{size}</option>)}
          </Select></span>
        </label>
        <span>Page {currentPage + 1} of {pageCount}</span>
        <Button aria-label="Previous page" onClick={() => goTo(currentPage - 1)} disabled={currentPage === 0}>{graph(selectedIds.length ? '1-Group3' : '0-Group7', 10)}</Button>
        <Button aria-label="Next page" onClick={() => goTo(currentPage + 1)} disabled={currentPage + 1 >= pageCount}>{graph(selectedIds.length ? '1-Group4' : '0-Group8', 10)}</Button>
      </footer>
    </section>
  </main>
}
