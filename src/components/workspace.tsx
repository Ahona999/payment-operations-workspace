import { useEffect, useRef } from 'react'
import { Button, Icon, Search, Select } from './ui'

export const routes = {
  overview: { path: '/', label: 'Overview', icon: 'GridIcon' },
  exceptions: { path: '/exceptions', label: 'Transactions', icon: 'ArrowsIcon1' },
  investigations: { path: '/investigations', label: 'Investigations', icon: 'CaseIcon' },
  reconciliation: { path: '/reconciliation', label: 'Reconciliation', icon: 'CheckIcon' },
  reports: { path: '/reports', label: 'Reports', icon: 'ChartIcon' },
} as const

export type Route = keyof typeof routes
export type DateRange = 'today' | 'week' | 'all'
export const dateRanges: Record<DateRange, string> = { today: 'Demo date: 17 Nov 2026', week: 'Last 7 demo days', all: 'All dates' }

export function Sidebar({ active, unresolved, navigate, onUtility }: { active: Route; unresolved: number; navigate: (route: Route) => void; onUtility: (title: string) => void }) {
  return <aside className="sidebar">
    <div className="brand"><span className="brand-icon"><Icon name="ArrowsIcon" size={18} /></span><div><strong>Payment Ops</strong><small>WORKSPACE</small></div></div>
    <Button className="workspace-selector" onClick={() => onUtility('Acme Finance')}>Acme Finance<Icon name="ChevronIcon" /></Button>
    <div className="nav-caption">WORKSPACE</div>
    <nav aria-label="Workspace">
      {(Object.entries(routes) as [Route, typeof routes[Route]][]).map(([key, route]) => <a key={key} href={route.path} aria-current={active === key ? 'page' : undefined} onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(key) } }}>
        <Icon name={route.icon} size={18} />{route.label}
        {key === 'investigations' && <span className="nav-count">{unresolved}</span>}
      </a>)}
    </nav>
    <div className="sidebar-footer">
      <button onClick={() => onUtility('Settings')}><Icon name="SettingsIcon" size={18} />Settings</button>
      <button onClick={() => onUtility('Help & documentation')}><Icon name="HelpIcon" size={18} />Help & documentation</button>
      <p><Icon name="ConnectedIndicator" size={6} />Simulated connections healthy</p>
      <small>Demo workspace · Synthetic data</small>
    </div>
  </aside>
}

export function TopNavigation({ range, setRange, query, setQuery, onAlerts, onProfile }: { range: DateRange; setRange: (value: DateRange) => void; query: string; setQuery: (value: string) => void; onAlerts: () => void; onProfile: () => void }) {
  const search = useRef<HTMLInputElement>(null)
  const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])
  return <header className="topbar">
    <Search label="Search transactions, cases, or references…" value={query} onChange={setQuery} inputRef={search}><kbd>{isMac ? 'Cmd+K' : 'Ctrl+K'}</kbd></Search>
    <div className="top-actions">
      <label className="date-filter">
        <Icon name="CalendarIcon" /><span className="sr-only">Dashboard date range</span>
        <Select value={range} onChange={event => setRange(event.target.value as DateRange)}>{Object.entries(dateRanges).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Icon name="ChevronIcon" />
      </label>
      <Button className="notifications" onClick={onAlerts} aria-label="Show operational alerts"><Icon name="BellIcon" /><span><Icon name="UnreadGroupedAlerts" size={5} /></span></Button>
      <button className="profile" onClick={onProfile}><span><Icon name="UserIcon" /></span>Ananya</button>
    </div>
  </header>
}
