import { number } from '../libs/metrics.mjs';

const month = (date) => new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const COLORS = { up: '#159568', down: '#cb6b37', mixed: '#7966b8' };

// Monthly quiet floors for the last year, over the same months a year earlier.
export default function BaselineChart({ trend, plugin, large = false }) {
  const current = trend.blocks.map((block) => block.floor);
  const previous = trend.previousBlocks.map((block) => block.floor);
  if (!trend.available) return <div className={`baseline-empty ${large ? 'baseline-empty-large' : ''}`}>Not enough download history yet</div>;
  const width = 360, height = large ? 130 : 68, top = 6, bottom = height - 4, inset = 5;
  const ceiling = Math.max(10, ...current.filter((v) => v !== null), ...previous.filter((v) => v !== null)) * 1.1;
  const x = (i) => inset + i * (width - inset * 2) / (current.length - 1);
  const y = (value) => bottom - value / ceiling * (bottom - top);
  const path = (values) => values.map((value, i) => value === null ? '' : `${i === 0 || values[i - 1] === null ? 'M' : 'L'}${x(i)},${y(value)}`).join(' ');
  const color = COLORS[trend.direction] || '#3e85ba';
  const area = current.every((value) => value !== null) ? `${path(current)} L${x(current.length - 1)},${bottom} L${x(0)},${bottom} Z` : null;
  return <svg className="baseline-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${plugin.name}: quiet download floor for each four-week block of the last year, compared with the same blocks a year earlier.`}>
    <path d={`M0 ${bottom}H${width}`} stroke="#ebe9ee" strokeWidth="1" />
    {area && <path d={area} fill={color} opacity="0.1" />}
    <path d={path(previous)} stroke="#a9a4b4" strokeWidth="1.5" strokeDasharray="3 3" fill="none" vectorEffect="non-scaling-stroke" />
    <path d={path(current)} stroke={color} strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    {trend.blocks.map((block, i) => <rect key={block.start} x={x(i) - (width / current.length) / 2} y="0" width={width / current.length} height={height} fill="transparent"><title>{`${month(block.start)} – ${month(block.end)}: ${block.floor === null ? 'no data' : `~${number(Math.round(block.floor))}/day`}${previous[i] === null ? '' : ` (a year earlier ~${number(Math.round(previous[i]))}/day)`}`}</title></rect>)}
  </svg>;
}
