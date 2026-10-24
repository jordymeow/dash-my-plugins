import { useState } from 'react';
import Dialog from './Dialog';
import DownloadChart from './DownloadChart';
import PluginIcon from './PluginIcon';
import Icon from './Icon';
import BaselineChart from './BaselineChart';
import { assessPlugin, DEFAULT_POLICY, trendLabel, trendExplanation } from '../libs/health.mjs';
import { aggregateDownloads, compact, groupDownloads, number, relativeDate, signalsFor, windowDates } from '../libs/metrics.mjs';

export default function PluginDetail({ plugin, snapshot, policy = DEFAULT_POLICY, onClose }) {
  const [days, setDays] = useState(90);
  const { points } = aggregateDownloads([plugin], windowDates(snapshot.fetchedAt, days));
  const signals = signalsFor(plugin, snapshot.wpVersion);
  const health = assessPlugin(plugin, snapshot.wpVersion, snapshot.fetchedAt, policy);
  const quiet = health.trend.quiet;
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
    <section className="detail-baseline"><div className="panel-heading"><div><h3>Quieter downloads</h3><p>Last 6 complete weeks vs. previous 6</p></div><strong className={`detail-baseline-value direction-${quiet.direction}`}>{quiet.label}<small>{quiet.available ? `~${compact(Math.round(quiet.baseline))}/day` : ''}</small></strong></div><p className="comparison-note">{quiet.available ? `The usual lower daily level is about ${number(Math.round(quiet.baseline))}, compared with ${number(Math.round(quiet.previous))} in the earlier period. The weekday mix is balanced and the first four days after each release are excluded.` : 'There is not enough complete download and release history for a quiet-day comparison.'} This describes downloads, including lingering updates; it does not measure new users.</p><BaselineChart trend={health.trend} plugin={plugin} large /><p className="chart-note">The line follows quieter observed days; the band shows their typical range. Dashed marks are published releases.</p><details className="adjusted-comparison"><summary>Release-adjusted check <span>{health.trend.comparable ? trendLabel(health.trend) : 'No reliable estimate'}</span></summary><p className="comparison-note">{trendExplanation(health.trend)}. {health.trend.comparable ? `${health.trend.change > 0 ? '+' : ''}${health.trend.change.toFixed(1)}% on matched days. This result also survives a full week of exclusion after releases.` : 'Too few comparable days or conflicting results prevent a stronger conclusion. This does not change the observed quiet level shown above.'}</p><div className="comparison-facts"><span>{health.trend.pairCount} matched pairs</span><span>{health.trend.strictPairCount ?? 0} after a full week without a release</span></div></details>{health.actions.length > 0 && <ul className="detail-action-list">{health.actions.map((action) => <li key={action.kind}><strong>{action.label}</strong><span>{action.detail}</span></li>)}</ul>}</section>
    <div className="panel-heading detail-chart-heading"><div><h3>Raw download history</h3><p>{points.length ? `${number(points.reduce((sum, point) => sum + point.value, 0))} downloads in ${days} complete days` : 'No complete history for this period'}</p></div><div className="segmented" aria-label="Plugin download period">{[30, 90, 365].map((range) => <button key={range} aria-pressed={days === range} onClick={() => setDays(range)}>{range === 365 ? '1Y' : `${range}D`}</button>)}</div></div>
    <DownloadChart points={groupDownloads(points, days === 365 ? 7 : 1)} />
    <p className="chart-note">Downloads include new installs and updates. They are not new users.</p>
    <div className="detail-links"><a className="button button-primary" href={`https://wordpress.org/support/plugin/${plugin.slug}/`} target="_blank" rel="noreferrer"><Icon name="support" size={16} /> Open support forum <Icon name="arrow" size={15} /></a><a className="button" href={`https://wordpress.org/support/plugin/${plugin.slug}/reviews/`} target="_blank" rel="noreferrer">Read reviews <Icon name="arrow" size={15} /></a></div>
  </Dialog>;
}
