import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import './styles.css'
import './exceptionQueue.css'
import './investigation.css'
import './reconciliation.css'
import { demoDate, isOverdue, type PaymentException } from './data/exceptions'
import { useDemoCases } from './data/demoCases'
import { alertGroups, ExceptionTrend, KpiCard, OperationalAlerts } from './components/overview'
import { ExceptionQueue } from './components/exceptionQueue'
import { InvestigationWorkspace } from './components/investigationWorkspace'
import { ReconciliationWorkspace } from './components/reconciliationWorkspace'
import { getReconciliationRecords } from './data/reconciliation'
import { PriorityQueue } from './components/queue'
import { Button, Icon, Modal } from './components/ui'
import { routes, Sidebar, TopNavigation, type DateRange, type Route } from './components/workspace'

function getRoute(path: string): Route {
  if (/^\/investigations\/CASE-\d+$/.test(path)) return 'investigations'
  return (Object.keys(routes) as Route[]).find(key => routes[key].path === path.replace(/\/$/, '')) ?? 'overview'
}

const getLocation = () => window.location.pathname + window.location.search
const getInitialRange = (): DateRange => {
  const saved = new URLSearchParams(window.location.search).get('range')
  return saved === 'week' || saved === 'all' ? saved : 'today'
}
const routeTitles: Record<Exclude<Route, 'overview'>, string> = {
  exceptions: 'Exception Queue',
  investigations: 'Investigation Workspace',
  reconciliation: 'Reconciliation Workspace',
  reports: 'Reports',
}

function App() {
  const [location, setLocation] = useState(getLocation)
  const [range, setRange] = useState<DateRange>(getInitialRange)
  const [query, setQuery] = useState('')
  const [utility, setUtility] = useState('')
  const [resetFeedback, setResetFeedback] = useState('')
  const [queueVersion, setQueueVersion] = useState(0)
  const { items: exceptions, updateCases, recordCaseAction, recordReconciliationAction, resetDemoData, caseInfo } = useDemoCases()
  const previousLocation = useRef(location)
  const [path, search] = location.split('?')
  const route = getRoute(path)
  const caseId = /^\/investigations\/(CASE-\d+)$/.exec(path)?.[1]
  const activeCase = caseId ? exceptions.find(item => item.caseId === caseId) : undefined
  const showQueue = route === 'exceptions' || route === 'investigations' && !caseId
  const showReconciliation = route === 'reconciliation'
  const alert = new URLSearchParams(search).get('alert')

  useEffect(() => {
    const onBack = () => {
      setLocation(getLocation())
      setQuery('')
      setQueueVersion(previous => previous + 1)
    }
    window.addEventListener('popstate', onBack)
    return () => window.removeEventListener('popstate', onBack)
  }, [])

  useEffect(() => {
    if (previousLocation.current === location) return
    previousLocation.current = location
    if (document.activeElement?.matches('.topbar input') || document.querySelector('dialog[open]')) return
    const heading = document.querySelector<HTMLElement>('main h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
  }, [location])

  const moveTo = (destination: string) => {
    if (destination === location) return
    window.history.pushState(null, '', destination)
    setLocation(destination)
    setQuery('')
    window.scrollTo(0, 0)
  }
  const navigate = (next: Route) => moveTo(routes[next].path)
  const openCase = (id: string) => moveTo('/investigations/' + id)
  const items = range === 'week' ? exceptions.filter(item => item.detectedOn >= '2026-11-11') : exceptions
  const today = items.filter(item => item.detectedOn === demoDate)
  const trendItems = range === 'today' ? today : items
  const awaiting = items.filter(item => item.investigation === 'Awaiting evidence').length
  const unresolved = items.filter(item => item.investigation !== 'Closed').length
  const investigating = items.filter(item => item.investigation === 'Investigating').length
  const overdue = items.filter(isOverdue).length
  const activeAlert = alertGroups.find(group => group.title === alert)
  const queueAlert = activeAlert ? {
    label: activeAlert.title,
    matches: (item: PaymentException) => activeAlert.matches(item) &&
      (activeAlert !== alertGroups[0] || range !== 'today' || item.detectedOn === demoDate),
  } : undefined
  const selectAlert = (name: string) => {
    moveTo('/exceptions?' + new URLSearchParams({ alert: name, ...(range === 'today' ? {} : { range }) }))
  }
  const clearQueueAlert = () => {
    const params = new URLSearchParams(search)
    params.delete('alert')
    const next = path + (params.size ? '?' + params.toString() : '')
    window.history.replaceState(null, '', next)
    setLocation(next)
  }
  const updateRange = (next: DateRange) => {
    setRange(next)
    setQueueVersion(previous => previous + 1)
  }
  const confirmReset = () => {
    if (!resetDemoData()) {
      setResetFeedback('Demo data could not be reset. Browser storage is unavailable.')
      return
    }
    setRange('today')
    setQuery('')
    setQueueVersion(previous => previous + 1)
    navigate('overview')
    setResetFeedback('Demo data reset. Original records restored.')
    setUtility('Settings')
  }

  return <div className="workspace">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <Sidebar active={showQueue ? 'investigations' : route} unresolved={unresolved} navigate={navigate} onUtility={title => { setResetFeedback(''); setUtility(title) }} />
    <div className="workspace-main">
      <TopNavigation range={range} setRange={updateRange} query={query} setQuery={value => { if (!showQueue && !showReconciliation && route !== 'overview') navigate('overview'); setQuery(value) }} onAlerts={() => {
        if (route !== 'overview') navigate('overview')
        requestAnimationFrame(() => document.getElementById('alerts-heading')?.scrollIntoView({ block: 'nearest' }))
      }} onProfile={() => setUtility('Ananya')} />
      {route === 'overview' ? <main id="main-content" tabIndex={-1} className="overview">
        <div className="overview-heading">
          <div><h1>Operations Overview</h1><p>{items.length} payment exceptions. {overdue} cases beyond the illustrative 48-hour internal SLA threshold.</p></div>
          <div className="overview-action"><small>Updated 14:32 IST</small><Button variant="primary" onClick={() => navigate('investigations')}>View investigations<Icon name="ArrowIcon" size={14} /></Button></div>
        </div>
        <div className="kpi-grid">
          <KpiCard label="Total Exceptions" value={items.length} caption="Across all monitored payments" />
          <KpiCard label="New Exceptions" value={today.length} caption="Detected since 00:00 IST" />
          <KpiCard label="Unresolved Cases" value={unresolved} caption={`${investigating} investigating · ${awaiting} awaiting evidence`} />
          <KpiCard label="Ageing Cases" value={overdue} caption="Open longer than 48 hours" warning={overdue > 0} />
        </div>
        <div className="overview-panels">
          <ExceptionTrend items={trendItems} period={range === 'today' ? 'Demo date' : range === 'week' ? 'Last 7 demo days' : 'All dates'} />
          <OperationalAlerts items={items} spikeItems={trendItems} onSelect={selectAlert} />
        </div>
        <PriorityQueue key={queueVersion} items={items} query={query} onQuery={setQuery} onAction={item => openCase(item.caseId)} onViewAll={() => navigate('exceptions')} />
      </main> : showQueue ? <ExceptionQueue key={path + queueVersion} items={items} query={query} onQuery={setQuery} initialAlert={queueAlert}
        onClearAlert={clearQueueAlert} onOpenCase={openCase} onUpdate={updateCases} />
        : showReconciliation ? <ReconciliationWorkspace records={getReconciliationRecords(exceptions, id => caseInfo(id)?.reconciliation)}
          query={query} onQuery={setQuery} onAction={recordReconciliationAction} onOpenCase={openCase} />
        : activeCase ? <InvestigationWorkspace key={activeCase.id} item={activeCase} info={caseInfo(activeCase.id)} onAction={action => recordCaseAction(activeCase.id, action)} onBack={navigate} />
        : <main id="main-content" tabIndex={-1} className="overview route-placeholder"><h1>{caseId ? 'Case unavailable' : routeTitles[route]}</h1><p>{caseId ? 'No investigation was found for ' + caseId + '.' : 'This demo includes Overview, Exception Queue, Investigation Workspace and Reconciliation Workspace.'}</p><Button onClick={() => navigate(caseId ? 'exceptions' : 'overview')}>{caseId ? 'Back to exception queue' : 'Back to overview'}</Button></main>}
    </div>
    {utility && <Modal title={utility} onClose={() => setUtility('')}>
      {utility === 'Settings' ? <>
        <p>Saved demo changes are stored in this browser.</p>
        {resetFeedback && <p role="status">{resetFeedback}</p>}
        <Button className="utility-action" onClick={() => { setResetFeedback(''); setUtility('Reset Demo Data') }}>Reset Demo Data</Button>
      </> : utility === 'Reset Demo Data' ? <>
        <p>Restore the original synthetic records and clear saved case changes, evidence, matches and audit history in this browser?</p>
        {resetFeedback && <p role="alert">{resetFeedback}</p>}
        <div className="utility-action flex gap-2"><Button onClick={() => setUtility('Settings')}>Cancel</Button><Button variant="primary" onClick={confirmReset}>Confirm reset</Button></div>
      </> : utility === 'Help & documentation' ? <p>Search by transaction, case ID or reference. The 48-hour SLA is an illustrative internal review threshold for this demo.</p>
        : <p>{utility === 'Ananya' ? 'Ananya S. · Payment Operations' : 'Acme Finance · Demo workspace · Synthetic data'}</p>}
    </Modal>}
  </div>
}

createRoot(document.getElementById('root')!).render(<App />)
