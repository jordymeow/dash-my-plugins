import { useState } from 'react';
import Dialog from './Dialog';
import DownloadChart from './DownloadChart';
import PluginIcon from './PluginIcon';
import Icon from './Icon';
import BaselineChart from './BaselineChart';
import { signed } from './HealthCard';
import { assessPlugin, DEFAULT_POLICY, trendLabel, trendExplanation } from '../libs/health.mjs';
import { aggregateDownloads, compact, groupDownloads, number, relativeDate, signalsFor, windowDates } from '../libs/metrics.mjs';

export default function PluginDetail({ plugin, snapshot, policy = DEFAULT_POLICY, portfolio = null, onClose }) {
  const [days, setDays] = useState(90);
  const { points } = aggregateDownloads([plugin], windowDates(snapshot.fetchedAt, days));
  const signals = signalsFor(plugin, snapshot.wpVersion);
  const health = assessPlugin(plugin, snapshot.wpVersion, snapshot.fetchedAt, policy);
  const { trend } = health;
  return <Dialog title={plugin.name} onClose={onClose} wide>
    <div className="detail-intro"><PluginIcon plugin={plugin} size={56} /><div><p>{plugin.fullName}</p><a className="text-link" href={`https://wordpress.org/plugins/${plugin.slug}/`} target="_blank" rel="noreferrer">View on WordPress.org <Icon name="arrow" size={14} /></a></div></div>
    {plugin.available ? <>
      <div className="detail-stats">
        <div><span>Active installs</span><strong>{plugin.activeInstalls === null ? '—' : `${compact(plugin.activeInstalls)}+`}</strong></div>
        <div><span>Rating</span><strong>{plugin.numRatings && plugin.rating !== null ? `${(plugin.rating / 20).toFixed(1)} / 5` : '—'}</strong><small>{number(plugin.numRatings)} reviews</small></div>
        <div><span>Open threads</span><strong>{plugin.openSupport ?? '—'}</strong><small>Last two months</small></div>
      </div>
      <div className="detail-release"><span><strong>v{plugin.version}</strong> · {relativeDate(plugin.lastUpdated, snapshot.fetchedAt)}</span><span>Tested up to <strong>WordPress {plugin.tested || '—'}</strong></span></div>
      {signals.length > 0 && <div className="detail-signals">{signals.map((signal) => <a key={signal.kind} href={signal.url} target="_blank" rel="noreferrer"><Icon name={signal.kind === 'support' ? 'support' : 'info'} /><div><strong>{signal.label}</strong><p>{signal.detail}</p></div><Icon name="arrow" size={16} /></a>)}</div>}
    </> : <p className="notice">Plugin information could not be retrieved. Try refreshing the dashboard.</p>}
    <section className="detail-baseline"><div className="panel-heading"><div><h3>Vs. last year</h3><p>{trendExplanation(trend)}</p></div><strong className={`detail-baseline-value direction-${trend.direction}`}>{trend.available ? signed(trend.change) : trendLabel(trend)}<small>{trend.available ? trendLabel(trend) : ''}</small></strong></div>{trend.available && <p className="comparison-note">{`The quiet floor is about ${number(Math.round(trend.current))} downloads/day now. Over the last 12 months it is ${signed(trend.change)} against the same months a year earlier, and the last 12 weeks are ${signed(trend.recent)}.`}{portfolio === null ? '' : ` Your plugins together (median) are ${signed(portfolio)}, so this one is ${Math.abs(Math.round(trend.change - portfolio))} points ${trend.change >= portfolio ? 'ahead of' : 'behind'} the others.`} Downloads include updates; a different release pace than last year can still move the floor.</p>}<BaselineChart trend={trend} plugin={plugin} large /><p className="chart-note">Solid: quiet floor of each four-week block. Dashed: the same block a year earlier.</p></section>
    <div className="panel-heading detail-chart-heading"><div><h3>Raw download history</h3><p>{points.length ? `${number(points.reduce((sum, point) => sum + point.value, 0))} downloads in ${days} complete days` : 'No complete history for this period'}</p></div><div className="segmented" aria-label="Plugin download period">{[30, 90, 365].map((range) => <button key={range} aria-pressed={days === range} onClick={() => setDays(range)}>{range === 365 ? '1Y' : `${range}D`}</button>)}</div></div>
    <DownloadChart points={groupDownloads(points, days === 365 ? 7 : 1)} />
    <p className="chart-note">Downloads include new installs and updates. They are not new users.</p>
    <div className="detail-links"><a className="button button-primary" href={`https://wordpress.org/support/plugin/${plugin.slug}/`} target="_blank" rel="noreferrer"><Icon name="support" size={16} /> Open support forum <Icon name="arrow" size={15} /></a><a className="button" href={`https://wordpress.org/support/plugin/${plugin.slug}/reviews/`} target="_blank" rel="noreferrer">Read reviews <Icon name="arrow" size={15} /></a></div>
  </Dialog>;
}
