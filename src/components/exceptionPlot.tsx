import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { getTrend } from '../data/exceptions'

export default function ExceptionPlot({ data, hours, hovering }: { data: ReturnType<typeof getTrend>; hours: 7 | 24; hovering: boolean }) {
  return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 20, right: 5, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="hour" axisLine={false} tickLine={false} tickMargin={12} height={27} minTickGap={hours === 7 ? 0 : 15} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
          <YAxis axisLine={false} tickLine={false} tickMargin={12} width={30} allowDecimals={false} domain={[0, dataMax => Math.max(12, Math.ceil(dataMax / 3) * 3)]} tickCount={5} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
          <Area dataKey="area" stroke="none" fill="var(--mint)" baseValue={3} isAnimationActive={false} tooltipType="none" />
          <ReferenceLine y={3} stroke="var(--baseline)" strokeDasharray="4 3" />
          {hours === 7 && !hovering && <ReferenceLine x="10:00" stroke="var(--baseline)" strokeDasharray="3 3" />}
          <Line type="linear" dataKey="failures" name="Failures" stroke="var(--chart-green)" strokeWidth={2} dot={{ r: 2.4, fill: 'var(--chart-green)', stroke: 'white', strokeWidth: 1 }} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Tooltip content={({ active, payload, label }) => {
            const point = payload?.find(entry => entry.dataKey === 'failures')
            if (!active || typeof point?.value !== 'number') return null
            return <div className="trend-tooltip"><strong>{label} · {point.value} failures</strong><span>{Number((point.value / 3).toFixed(1))}× hourly baseline</span></div>
          }} />
        </ComposedChart>
      </ResponsiveContainer>
  )
}
