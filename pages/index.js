import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Icon, { CatMark } from '../components/Icon';
import Dialog from '../components/Dialog';
import PluginDetail from '../components/PluginDetail';
import HealthCard from '../components/HealthCard';
import ReleasePolicy from '../components/ReleasePolicy';
import { dailyDownloads } from '../libs/metrics.mjs';
import { assessPlugin, DEFAULT_POLICY, portfolioChange } from '../libs/health.mjs';
import { signed } from '../components/HealthCard';
import { getDashboardData } from '../libs/dashboard';

const POLICY_KEY = 'dash-my-plugins-release-policy';
function expandSnapshot(snapshot) {
  return { ...snapshot, plugins: snapshot.plugins.map((plugin) => ({ ...plugin, downloads: Array.isArray(plugin.downloads) ? plugin.downloads : dailyDownloads(plugin.downloads) })) };
}
export default function Home(initialSnapshot) {
  const [snapshot, setSnapshot] = useState(() => expandSnapshot(initialSnapshot));
  const [policy, setPolicy] = useState(DEFAULT_POLICY);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [about, setAbout] = useState(false);
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [policyNotice, setPolicyNotice] = useState('');
  const { plugins, wpVersion, siteName, fetchedAt } = snapshot;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(POLICY_KEY));
      if (Number.isInteger(saved?.warningDays) && Number.isInteger(saved?.overdueDays) && saved.warningDays > 0 && saved.overdueDays > saved.warningDays && saved.overdueDays <= 730) setPolicy(saved);
    } catch { /* Storage can be unavailable; the board still works with defaults. */ }
  }, []);
  const assessed = useMemo(() => plugins.map((plugin) => ({ plugin, health: assessPlugin(plugin, wpVersion, fetchedAt, policy) })), [plugins, wpVersion, fetchedAt, policy]);
  const portfolio = useMemo(() => portfolioChange(assessed.map(({ health }) => health.trend)), [assessed]);
  const overdueCount = assessed.filter(({ health }) => health.release.state === 'overdue').length;
  const releaseCount = assessed.filter(({ health }) => ['soon', 'overdue'].includes(health.release.state)).length;
  const shown = useMemo(() => [...assessed].sort((a, b) => b.health.score - a.health.score || (b.plugin.activeInstalls ?? 0) - (a.plugin.activeInstalls ?? 0) || a.plugin.name.localeCompare(b.plugin.name)), [assessed]);
  const selectedPlugin = plugins.find((plugin) => plugin.slug === selected);
  const missing = plugins.filter((plugin) => !plugin.available || !plugin.downloads);
  const support = plugins.reduce((sum, plugin) => sum + (plugin.openSupport || 0), 0);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true); setError('');
    try {
      const response = await fetch('/api/dashboard'); const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not refresh plugin data.');
      setSnapshot(expandSnapshot(data));
    } catch (err) { setError(err.message || 'Could not refresh the dashboard. Try again shortly.'); }
    finally { setRefreshing(false); }
  }
  function savePolicy(next) {
    setPolicy(next); setPolicyOpen(false); setPolicyNotice('');
    try { localStorage.setItem(POLICY_KEY, JSON.stringify(next)); }
    catch { setPolicyNotice('Release policy applied for this visit. This browser could not save it.'); }
  }

  return <>
    <Head><title>{`${siteName} · Plugin health`}</title><meta name="description" content="A working board for WordPress plugin developers: overdue releases, downloads vs. last year, compatibility, and support." /><link rel="icon" href="/favicon.ico" /></Head>
    <a className="skip-link" href="#main">Skip to plugin board</a>
    <header className="topbar"><div className="topbar-inner"><Link href="/" className="brand" aria-label={`${siteName} dashboard`}><span className="brand-mark"><CatMark /></span><span>{siteName}</span><span className="brand-count">{plugins.length}</span></Link><div className="board-totals"><span className={`summary-chip ${overdueCount ? 'summary-overdue' : releaseCount ? 'summary-attention' : 'summary-ready'}`}><Icon name={releaseCount ? 'alert' : 'check'} size={15} />{releaseCount ? <><strong>{overdueCount || releaseCount}</strong>{overdueCount ? 'overdue' : 'release soon'}</> : 'Releases on track'}</span><span className="summary-chip summary-support"><Icon name="support" size={15} /><strong>{support}</strong> open threads</span></div><div className="topbar-right"><span className="snapshot-time"><i />Updated {new Date(fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC</span><button className="text-button policy-trigger" onClick={() => setPolicyOpen(true)} aria-label={`Release policy ${policy.warningDays} / ${policy.overdueDays} days`} title="Change release reminders"><Icon name="clock" size={15} /><span>{policy.warningDays} / {policy.overdueDays}d</span></button><button className="icon-button" onClick={refresh} disabled={refreshing} aria-label={refreshing ? 'Refreshing data' : 'Refresh data'} title="Refresh data"><Icon name="refresh" size={17} className={refreshing ? 'spin' : ''} /></button><button className="icon-button" aria-label="How comparisons work" onClick={() => setAbout(true)}><Icon name="info" size={17} /></button></div></div></header>
    <main id="main" className="dashboard">
      <h1 className="sr-only">Plugin health board</h1>
      {error && <div role="alert" className="notice"><Icon name="alert" size={18} /><span>{error} The previous snapshot has been kept.</span></div>}
      {policyNotice && <div role="status" className="notice">{policyNotice}</div>}
      {missing.length > 0 && <div role="status" className="notice"><Icon name="info" size={18} /><span>Some data is unavailable for {missing.map((plugin) => plugin.name).join(', ')}. Incomplete data is not treated as healthy.</span></div>}
      {snapshot.stale && <div role="status" className="notice">WordPress.org is unavailable. Showing the last saved snapshot from {new Date(fetchedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC.</div>}
      <div className="sr-only" role="status" aria-live="polite">{refreshing ? 'Refreshing plugin data.' : `${shown.length} plugins shown.`}</div>
      {!plugins.length ? <section className="empty-state"><Icon name="grid" size={30} /><h2>Your plugin board starts here.</h2><p>Add plugin slugs to the PLUGINS setting to track them here.</p></section> : <section className="health-grid" aria-label="Plugin health cards">{shown.map(({ plugin, health }) => <HealthCard key={plugin.slug} plugin={plugin} health={health} policy={policy} portfolio={portfolio} onSelect={setSelected} />)}</section>}
      <footer className="board-footer"><span><i className="key-green" /> No action flagged <i className="key-blue" /> Needs attention</span><span>{portfolio === null ? 'Quiet download floor vs. last year' : `All plugins (median): ${signed(portfolio)} vs. last year`} · downloads include updates</span></footer>
    </main>
    {selectedPlugin && <PluginDetail key={selectedPlugin.slug} plugin={selectedPlugin} snapshot={snapshot} policy={policy} portfolio={portfolio} onClose={() => setSelected(null)} />}
    {policyOpen && <ReleasePolicy policy={policy} onSave={savePolicy} onClose={() => setPolicyOpen(false)} />}
    {about && <Dialog title="Reading your plugin board" onClose={() => setAbout(false)}><div className="about-copy"><p>The card answers one question: are downloads doing better or worse than a year ago?</p><dl><dt>Quiet floor</dt><dd>Each four-week block holds exactly four of every weekday. Its floor is the 25th percentile of daily downloads: the level between release spikes. It needs no release dates.</dd><dt>Vs. last year</dt><dd>Each of the last 13 blocks is compared with the same block one year earlier, so seasons and weekdays line up. The percentage is the median of those 13 changes, so one unusual month cannot decide it. Growing or Declining also needs the last 12 weeks to agree; when they disagree the card says Mixed.</dd><dt>Vs. others</dt><dd>The difference with the median of all your plugins. When everything grows together, it is the season or WordPress.org, not the plugin. A plugin well behind the others is the one to look at.</dd><dt>What it cannot see</dt><dd>Downloads include updates. Releasing much more or less often than last year still moves the floor. This is a robust heuristic, not a count of new users.</dd><dt>The chart</dt><dd>The solid line is the floor for each block of the last year; the dashed line is the same block a year earlier. Open a card for the raw download history.</dd><dt>Reminders and saved data</dt><dd>Release warnings begin at {policy.warningDays} days and become overdue at {policy.overdueDays}. Data is cached for 15 minutes. If WordPress.org fails, the last saved snapshot remains visible with its original timestamp.</dd></dl></div></Dialog>}


  </>;
}

export async function getStaticProps() {
  return { props: await getDashboardData(), revalidate: 900 };
}
