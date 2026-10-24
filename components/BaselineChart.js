import { number } from '../libs/metrics.mjs';
import { quantile } from '../libs/health.mjs';

export default function BaselineChart({ trend, plugin, large = false, raw = false }) {
  const points = trend.points;
  const valid = points.filter((point) => point.baseline !== null);
  if (!trend.available || !valid.length) return <div className={`baseline-empty ${large ? 'baseline-empty-large' : ''}`}>Waiting for comparable quiet days</div>;
  const width = 360, height = large ? 130 : 68, top = 7, bottom = height - 4;
  const ceiling = Math.max(10, quantile(valid.map((point) => point.upper), 0.9) * 1.25, ...valid.map((point) => point.baseline * 1.1));
  const x = (i) => i * width / (points.length - 1);
  const y = (value) => bottom - Math.min(ceiling, Math.max(0, value)) / ceiling * (bottom - top);
  const path = (key) => points.map((point, i) => point[key] === null ? '' : `${i === 0 || points[i - 1][key] === null ? 'M' : 'L'}${x(i)},${y(point[key])}`).join(' ');
  const segments = [];
  let segment = [];
  points.forEach((point, i) => { if (point.baseline === null) { if (segment.length) segments.push(segment); segment = []; } else segment.push({ ...point, i }); });
  if (segment.length) segments.push(segment);
  const direction = trend.quiet?.direction;
  const color = direction === 'down' ? '#cb6b37' : direction === 'up' ? '#159568' : direction === 'mixed' ? '#7966b8' : '#3e85ba';
  return <svg className="baseline-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${plugin.name}: ${raw ? 'daily download bars, with tall peaks visually capped, and ' : ''}quieter daily downloads over twelve weeks. This descriptive line is not a release-adjusted growth estimate.`}>
    <g aria-hidden="true">
      <path d={`M0 ${bottom}H${width}`} stroke="#ebe9ee" strokeWidth="1" />
      {raw && points.map((point, index) => <rect key={point.date} x={x(index)} y={y(point.value)} width={Math.max(1, width / points.length - 1.4)} height={bottom - y(point.value)} rx="1" fill={color} opacity="0.16"><title>{`${point.date}: ${number(point.value)} downloads${point.value > ceiling ? ' (peak visually capped)' : ''}`}</title></rect>)}
      {segments.map((group) => <polygon key={group[0].date} points={[...group.map((point) => `${x(point.i)},${y(point.upper)}`), ...[...group].reverse().map((point) => `${x(point.i)},${y(point.lower)}`)].join(' ')} fill={color} opacity="0.12" />)}
      {large && points.filter((point) => point.release).map((point) => <line key={point.date} x1={x(point.index)} x2={x(point.index)} y1="2" y2={bottom} stroke="#bbb6c6" strokeDasharray="2 4"><title>{`Release: ${point.date}`}</title></line>)}
      <path d={path('baseline')} stroke={color} strokeWidth="2.5" fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {valid.map((point) => <circle key={point.date} cx={x(point.index)} cy={y(point.baseline)} r="5" fill="transparent"><title>{`${point.date}: ${number(point.value)} raw downloads; quieter level ${Math.round(point.baseline)}/day`}</title></circle>)}
    </g>
  </svg>;
}
