import { lazy, Suspense, useState } from 'react'
import { getTrend, isFailureSpike, isMissingConfirmation, isOverdue, type PaymentException } from '../data/exceptions'
import { Badge, Icon } from './ui'

const ExceptionPlot = lazy(() => import('./exceptionPlot'))

export const alertGroups = [
  { title: 'Failure spike', icon: 'FailureSpikeSymbol', matches: isFailureSpike },
  { title: 'Missing confirmations', icon: 'MissingConfirmationsSymbol', matches: isMissingConfirmation },
  { title: 'Overdue investigations', icon: 'OverdueInvestigationsSymbol', matches: isOverdue },
] as const

export function KpiCard({ label, value, caption, warning }: { label: string; value: number; caption: string; warning?: boolean }) {
  return <article className={`panel kpi ${warning ? 'kpi-warning' : ''}`}>
    <h2>{label}</h2><strong>{value}</strong><p>{caption}</p>
    {warning && <Badge tone="amber">SLA risk</Badge>}
  </article>
}

export function ExceptionTrend({ items, period }: { items: readonly PaymentException[]; period: string }) {
  const [hours, setHours] = useState<7 | 24>(7)
  const data = getTrend(items, hours)
  const spike = data.find(point => point.hour === '10:00')
  const [hovering, setHovering] = useState(false)
  return <section className="panel trend" aria-labelledby="trend-heading">
    <div className="flex items-start justify-between">
      <div><h2 id="trend-heading">Exception trends</h2><p>Failed payments per hour · {period} (IST)</p></div>
      <div className="segmented" aria-label="Chart time range">
        <button aria-pressed={hours === 7} onClick={() => setHours(7)}>Last 7h</button>
        <button aria-pressed={hours === 24} onClick={() => setHours(24)}>24h</button>
      </div>
    </div>
    <div className="chart" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <span className="baseline-label">Baseline: 3 / h</span>
      {hours === 7 && spike && !hovering && <div className="chart-note"><strong>10:00 · {spike.failures} failures</strong><span>{Number((spike.failures / 3).toFixed(1))}× hourly baseline</span></div>}
      <Suspense fallback={<span className="sr-only">Loading chart</span>}>
        <ExceptionPlot data={data} hours={hours} hovering={hovering} />
      </Suspense>
    </div>
  </section>
}

export function OperationalAlerts({ items, spikeItems, onSelect }: { items: readonly PaymentException[]; spikeItems: readonly PaymentException[]; onSelect: (group: string) => void }) {
  const groups = alertGroups.map((group, index) => ({ ...group, count: (index === 0 ? spikeItems : items).filter(group.matches).length }))
  const unassigned = items.filter(item => isOverdue(item) && item.owner === 'Unassigned').length
  const captions = [`${groups[0].count} bank-transfer failures at 10:00 · ${Number((groups[0].count / 3).toFixed(1))}× baseline`, `${groups[1].count} pending payments without bank confirmation`, `${groups[2].count} cases >48h · ${unassigned} still need an owner`]
  return <section id="operational-alerts" className="panel alerts" aria-labelledby="alerts-heading">
    <div className="flex items-start justify-between"><h2 id="alerts-heading">Operational alerts</h2><Badge tone="amber">{groups.filter(group => group.count > 0).length} groups</Badge></div>
    {groups.map((group, index) => <button key={group.title} className="alert-row" onClick={() => onSelect(group.title)}>
      <Icon name={group.icon} size={17} />
      <span className="alert-copy"><strong>{group.title}</strong><small>{captions[index]}</small></span>
      <span className="alert-count">{group.count}</span><Icon name="OpenAlertGroup0" size={12} />
    </button>)}
  </section>
}
