import Icon from './Icon';
import PluginIcon from './PluginIcon';
import BaselineChart from './BaselineChart';
import { compact, number } from '../libs/metrics.mjs';

export default function HealthCard({ plugin, health, policy, onSelect }) {
  const { release, trend, actions } = health;
  const action = actions[0];
  const needsAttention = actions.length > 0 || health.incomplete;
  const status = release.state === 'overdue' ? 'Release overdue' : release.state === 'soon' ? 'Release soon' : null;
  const total = trend.available ? trend.points.reduce((sum, point) => sum + point.value, 0) : null;
  const quiet = trend.quiet;
  const arrow = quiet.direction === 'up' ? '↗' : quiet.direction === 'down' ? '↘' : quiet.direction === 'steady' ? '→' : quiet.direction === 'mixed' ? '↔' : '';
  return <article className={`health-card card-${needsAttention ? 'blue' : 'green'} release-${release.state}`}>
    <div className="health-card-heading"><PluginIcon plugin={plugin} size={34} /><div className="health-card-name"><button onClick={() => onSelect(plugin.slug)}>{plugin.name}</button><span>{plugin.activeInstalls == null ? 'Installs unavailable' : `${compact(plugin.activeInstalls)}+ installs`} <i>·</i> <a href={`https://wordpress.org/plugins/${plugin.slug}/#developers`} target="_blank" rel="noreferrer">v{plugin.version || '—'}</a></span></div>{status && <span className={`release-flag flag-${release.state}`} title={release.state === 'soon' ? `${release.daysLeft} days until overdue` : `${release.overdueBy} days overdue`}><Icon name="alert" size={28} /><span>Release<strong>{release.state === 'overdue' ? 'overdue' : 'soon'}</strong></span></span>}</div>
    <div className="card-readings">
      <button className={`card-reading release-reading age-${release.state}`} onClick={() => onSelect(plugin.slug)} title={`Warn at ${policy.warningDays} days; overdue at ${policy.overdueDays} days`}><span>Last release</span><strong>{release.age ?? '—'}<small>{release.age === null ? '' : 'd'}</small></strong></button>
      <a className={`card-reading threads-reading ${plugin.openSupport > 0 ? 'threads-open' : ''}`} href={`https://wordpress.org/support/plugin/${plugin.slug}/`} target="_blank" rel="noreferrer" aria-label={`${plugin.name}: ${plugin.openSupport ?? 'unknown'} open support threads`}><span>Open threads</span><strong>{plugin.openSupport ?? '—'}<Icon name="support" size={17} /></strong></a>
      <button className={`card-reading trend-reading direction-${quiet.direction}`} onClick={() => onSelect(plugin.slug)} title="Observed quieter downloads: last six weeks vs. previous six, with weekday mix balanced. Updates can still affect this level. Open for the release-adjusted comparison."><span>Quiet downloads</span><strong><span className="trend-arrow">{arrow}</span>{quiet.label}</strong><small>{quiet.available ? `~${compact(Math.round(quiet.baseline))}/day` : 'More history needed'}</small></button>
    </div>
    <div className="card-chart-heading"><span>Downloads <small>12 weeks</small></span><strong title={total === null ? 'Incomplete download history' : `${number(total)} total downloads, including updates`}>{total === null ? '—' : compact(total)}</strong></div>
    <BaselineChart trend={trend} plugin={plugin} raw />
    <button className={`card-next-action action-${action?.level || 'clear'}`} onClick={() => onSelect(plugin.slug)} title={action?.detail || 'Open download history and comparison details'}><Icon name={release.state === 'soon' || release.state === 'overdue' ? 'clock' : action ? 'info' : 'check'} size={14} /><span>{action?.label || (release.state === 'fresh' ? 'Release on track' : 'View details')}</span><Icon name="chevron" size={14} /></button>
  </article>;
}
