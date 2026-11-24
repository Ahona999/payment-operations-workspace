import { useState, type ReactNode } from 'react'
import { caseStatuses, formatAge, formatAmount, owners, paymentStatuses, priorities, reconciliationStatuses, type ExceptionCase, type PaymentException } from '../data/exceptions'
import { Badge, Button, Filter, Icon, Search } from './ui'

const columns = [
  { key: 'id', label: 'Transaction ID', width: 150 },
  { key: 'amount', label: 'Amount (₹)', width: 128 },
  { key: 'type', label: 'Exception type', width: 173 },
  { key: 'age', label: 'Age', width: 73 },
  { key: 'priority', label: 'Priority', width: 98 },
  { key: 'owner', label: 'Owner', width: 120 },
  { key: 'payment', label: 'Payment status', width: 117 },
  { key: 'investigation', label: 'Case status', width: 139 },
] as const

type SortKey = typeof columns[number]['key']
type Filters = { priority: string; owner: string; investigation: string; payment: string; reconciliation: string }
const emptyFilters: Filters = { priority: '', owner: '', investigation: '', payment: '', reconciliation: '' }
const pageSize = 6

export function DataTable({ children }: { children: ReactNode }) {
  return <div className="table-scroll"><table>{children}</table></div>
}

export function Pagination({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const start = total ? page * pageSize + 1 : 0
  const end = Math.min((page + 1) * pageSize, total)
  return <div className="pagination">
    <span>{start}–{end} of {total}</span>
    <Button aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}><Icon name="PreviousPageArrow" size={12} /></Button>
    <Button aria-label="Next page" disabled={end >= total} onClick={() => onPage(page + 1)}><Icon name="NextPageArrow" size={12} /></Button>
  </div>
}

export function PaymentStatus({ value }: { value: PaymentException['payment'] }) {
  return <span className={`payment-status payment-${value.toLowerCase()}`}>{value === 'Successful' ? <Icon name="ConnectedIndicator" size={5} /> : <Icon name={`Payment${value}`} size={5} />}{value}</span>
}

export function PriorityQueue({ items, query, onQuery, onAction, onViewAll }: { items: readonly ExceptionCase[]; query: string; onQuery: (query: string) => void; onAction: (item: ExceptionCase) => void; onViewAll: () => void }) {
  const [filters, setFilters] = useState(emptyFilters)
  const [expanded, setExpanded] = useState(false)
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null)
  const [pagination, setPagination] = useState({ query, page: 0 })
  const page = pagination.query === query ? pagination.page : 0
  const setPage = (next: number) => setPagination({ query, page: next })
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const needle = query.trim().toLowerCase()
  const rows = items.filter(item => (!needle || [item.id, item.caseId, item.reference, item.utr, item.merchant, item.type, item.rail, item.amount].some(value => value != null && String(value).toLowerCase().includes(needle))) &&
    (Object.keys(filters) as (keyof Filters)[]).every(key => !filters[key] || item[key] === filters[key]))
  rows.sort((a, b) => {
    const rank = priorities.indexOf(a.priority) - priorities.indexOf(b.priority)
    if (!sort) return rank || b.age - a.age
    const left = a[sort.key]
    const right = b[sort.key]
    const comparison = sort.key === 'priority' ? rank : typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
    return (sort.desc ? -comparison : comparison) || b.age - a.age
  })
  const currentPage = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1))
  const visible = rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const allVisibleSelected = visible.length > 0 && visible.every(row => selected.has(row.id))
  const setFilter = (key: keyof Filters) => (value: string) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(0) }
  const changeSelection = (ids: string[], checked: boolean) => setSelected(previous => {
    const next = new Set(previous)
    ids.forEach(id => checked ? next.add(id) : next.delete(id))
    return next
  })

  return <section id="priority-queue" className="panel queue" aria-labelledby="queue-heading">
    <div className="queue-tools">
      <div className="queue-title">
        <h2 id="queue-heading">Priority queue</h2><Badge>{items.length}</Badge><span>Prioritised for investigation</span>
        <Button onClick={onViewAll}>View All Exceptions<Icon name="ViewAllArrow" size={12} /></Button>
      </div>
      <div className="queue-filters">
        <Search icon="Search" label="Search transaction ID or reference" value={query} onChange={value => { setPagination({ query: value, page: 0 }); onQuery(value) }} />
        <Filter label="All priorities" options={priorities} value={filters.priority} onChange={setFilter('priority')} />
        <Filter label="All owners" options={owners} value={filters.owner} onChange={setFilter('owner')} />
        <Filter label="Case status" options={caseStatuses} value={filters.investigation} onChange={setFilter('investigation')} />
        <Button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><Icon name="Filters" size={12} />More filters</Button>
        <span className="queue-sort">Sorted by {sort ? `${columns.find(column => column.key === sort.key)?.label} ${sort.desc ? '↓' : '↑'}` : 'Priority ↓, then Age ↓'}</span>
      </div>
      {expanded && <div className="extra-filters">
        <Filter label="Payment status" options={paymentStatuses} value={filters.payment} onChange={setFilter('payment')} />
          <Filter label="Reconciliation status" options={reconciliationStatuses} value={filters.reconciliation} onChange={setFilter('reconciliation')} />
          <Button onClick={() => { setFilters(emptyFilters); setPage(0) }}>Clear filters</Button>
      </div>}
    </div>
    <DataTable>
      <colgroup><col style={{ width: 41 / 1158 * 100 + '%' }} />{columns.map(column => <col key={column.key} style={{ width: column.width / 1158 * 100 + '%' }} />)}<col /></colgroup>
      <thead><tr>
        <th scope="col"><input type="checkbox" aria-label="Select all rows on this page" checked={allVisibleSelected} ref={element => { if (element) element.indeterminate = !allVisibleSelected && visible.some(row => selected.has(row.id)) }} onChange={event => changeSelection(visible.map(row => row.id), event.target.checked)} /></th>
        {columns.map(column => <th key={column.key} scope="col" aria-sort={sort?.key === column.key ? sort.desc ? 'descending' : 'ascending' : undefined}>
          <button onClick={() => { setSort({ key: column.key, desc: sort?.key === column.key ? !sort.desc : column.key === 'age' || column.key === 'amount' }); setPage(0) }}>
            {column.label}{sort?.key === column.key ? sort.desc ? ' ↓' : ' ↑' : !sort && column.key === 'age' ? ' ↓' : ''}
          </button>
        </th>)}
        <th scope="col">Action</th>
      </tr></thead>
      <tbody>
        {visible.map((row, index) => <tr key={row.id} className={selected.has(row.id) ? 'selected' : index === 0 && currentPage === 0 && !sort && !needle ? 'featured-row' : ''}>
          <td><input type="checkbox" aria-label={`Select ${row.id}`} checked={selected.has(row.id)} onChange={event => changeSelection([row.id], event.target.checked)} /></td>
          <td><strong>{row.id}</strong><small>{row.merchant}</small></td>
          <td className="amount">{formatAmount(row.amount)}</td>
          <td>{row.type}</td>
          <td className={row.age > 2880 ? 'warning-text' : ''}>{formatAge(row.age)}</td>
          <td><Badge tone={row.priority === 'Urgent' ? 'red' : row.priority === 'High' ? 'amber' : 'neutral'}>{row.priority}</Badge></td>
          <td className={row.owner === 'Unassigned' ? 'warning-text' : ''}>{row.owner}</td>
          <td><PaymentStatus value={row.payment} /></td>
          <td className={row.investigation === 'Awaiting evidence' ? 'case-awaiting' : ''}><Badge tone={row.investigation === 'Investigating' ? 'green' : 'neutral'}>{row.investigation}</Badge></td>
          <td><Button className="row-action" onClick={() => onAction(row)}>{row.action}</Button></td>
        </tr>)}
        {visible.length === 0 && <tr><td className="empty-table" colSpan={10}>No exceptions match your search and filters.</td></tr>}
      </tbody>
    </DataTable>
    <div className="queue-footer">
      <span aria-live="polite">Showing {visible.length} of {rows.length} exceptions · Amounts in INR</span>
      {selected.size > 0 && <button className="selection-count" onClick={() => setSelected(new Set())}><span aria-hidden="true">✓</span>{selected.size} selected · Clear</button>}
      <Pagination page={currentPage} total={rows.length} onPage={setPage} />
    </div>
  </section>
}
