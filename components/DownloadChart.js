import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compact, number } from '../libs/metrics.mjs';

const dateLabel = (date) => new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return <div className="chart-tooltip"><span>{dateLabel(point.date)}{point.endDate && point.endDate !== point.date ? ` – ${dateLabel(point.endDate)}` : ''}</span><strong>{number(point.value)} <small>downloads</small></strong></div>;
}

export default function DownloadChart({ points, height = 210 }) {
  const id = useId().replace(/:/g, '');
  if (!points.length) return <div className="chart-empty" style={{ height }}>Download history is temporarily unavailable.</div>;
  return <div className="download-chart" role="img" aria-label={`Download trend from ${dateLabel(points[0].date)} to ${dateLabel(points[points.length - 1].endDate || points[points.length - 1].date)}. ${number(points.reduce((sum, point) => sum + point.value, 0))} downloads.`}>
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
        <defs><linearGradient id={`download-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8170d7" stopOpacity={0.22} /><stop offset="100%" stopColor="#8170d7" stopOpacity={0.015} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="#eeedf2" strokeDasharray="3 4" />
        <XAxis dataKey="date" tickFormatter={dateLabel} axisLine={false} tickLine={false} minTickGap={45} tickMargin={12} tick={{ fill: '#777381', fontSize: 11 }} />
        <YAxis tickFormatter={compact} axisLine={false} tickLine={false} tickCount={4} tick={{ fill: '#777381', fontSize: 11 }} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#aaa0ce', strokeDasharray: '4 4' }} />
        <Area type="monotone" dataKey="value" stroke="#8270cc" strokeWidth={2.5} fill={`url(#download-${id})`} isAnimationActive={false} activeDot={{ r: 5, fill: '#8270cc', stroke: '#fff', strokeWidth: 3 }} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

export function Sparkline({ values }) {
  if (!values?.length) return <span className="muted">—</span>;
  const min = Math.min(...values), max = Math.max(...values);
  const line = values.map((value, index) => `${index * 100 / Math.max(1, values.length - 1)},${28 - (value - min) / Math.max(1, max - min) * 22}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 100 34" aria-hidden="true"><polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
