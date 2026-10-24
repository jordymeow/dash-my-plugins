import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Icon, { CatMark } from '../components/Icon';
import Dialog from '../components/Dialog';
import PluginDetail from '../components/PluginDetail';
import HealthCard from '../components/HealthCard';
import ReleasePolicy from '../components/ReleasePolicy';
import { dailyDownloads } from '../libs/metrics.mjs';
import { assessPlugin, DEFAULT_POLICY } from '../libs/health.mjs';
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
    <Head><title>{`${siteName} · Plugin health`}</title><meta name="description" content="A working board for WordPress plugin developers: overdue releases, quiet-day download trends, compatibility, and support." /><link rel="icon" href="/favicon.ico" /></Head>
    <a className="skip-link" href="#main">Skip to plugin board</a>
    <header className="topbar"><div className="topbar-inner"><Link href="/" className="brand" aria-label={`${siteName} dashboard`}><span className="brand-mark"><CatMark /></span><span>{siteName}</span><span className="brand-count">{plugins.length}</span></Link><div className="board-totals"><span className={`summary-chip ${overdueCount ? 'summary-overdue' : releaseCount ? 'summary-attention' : 'summary-ready'}`}><Icon name={releaseCount ? 'alert' : 'check'} size={15} />{releaseCount ? <><strong>{overdueCount || releaseCount}</strong>{overdueCount ? 'overdue' : 'release soon'}</> : 'Releases on track'}</span><span className="summary-chip summary-support"><Icon name="support" size={15} /><strong>{support}</strong> open threads</span></div><div className="topbar-right"><span className="snapshot-time"><i />Updated {new Date(fetchedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC</span><button className="text-button policy-trigger" onClick={() => setPolicyOpen(true)} aria-label={`Release policy ${policy.warningDays} / ${policy.overdueDays} days`} title="Change release reminders"><Icon name="clock" size={15} /><span>{policy.warningDays} / {policy.overdueDays}d</span></button><button className="icon-button" onClick={refresh} disabled={refreshing} aria-label={refreshing ? 'Refreshing data' : 'Refresh data'} title="Refresh data"><Icon name="refresh" size={17} className={refreshing ? 'spin' : ''} /></button><button className="icon-button" aria-label="How comparisons work" onClick={() => setAbout(true)}><Icon name="info" size={17} /></button></div></div></header>
    <main id="main" className="dashboard">
      <h1 className="sr-only">Plugin health board</h1>
      {error && <div role="alert" className="notice"><Icon name="alert" size={18} /><span>{error} The previous snapshot has been kept.</span></div>}
      {policyNotice && <div role="status" className="notice">{policyNotice}</div>}
      {missing.length > 0 && <div role="status" className="notice"><Icon name="info" size={18} /><span>Some data is unavailable for {missing.map((plugin) => plugin.name).join(', ')}. Incomplete data is not treated as healthy.</span></div>}
      {snapshot.stale && <div role="status" className="notice">WordPress.org is unavailable. Showing the last saved snapshot from {new Date(fetchedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC.</div>}
      <div className="sr-only" role="status" aria-live="polite">{refreshing ? 'Refreshing plugin data.' : `${shown.length} plugins shown.`}</div>
      {!plugins.length ? <section className="empty-state"><Icon name="grid" size={30} /><h2>Your plugin board starts here.</h2><p>Add plugin slugs to the PLUGINS setting to track them here.</p></section> : <section className="health-grid" aria-label="Plugin health cards">{shown.map(({ plugin, health }) => <HealthCard key={plugin.slug} plugin={plugin} health={health} policy={policy} onSelect={setSelected} />)}</section>}
      <footer className="board-footer"><span><i className="key-green" /> No action flagged <i className="key-blue" /> Needs attention</span><span>Quiet trend: observed downloads, including updates · 12 weeks</span></footer>
    </main>
    {selectedPlugin && <PluginDetail key={selectedPlugin.slug} plugin={selectedPlugin} snapshot={snapshot} policy={policy} onClose={() => setSelected(null)} />}
    {policyOpen && <ReleasePolicy policy={policy} onSave={savePolicy} onClose={() => setPolicyOpen(false)} />}
    {about && <Dialog title="Reading your plugin board" onClose={() => setAbout(false)}><div className="about-copy"><p>The card shows what quieter downloads are doing. It keeps that observation separate from a stronger claim about growth.</p><dl><dt>Higher, Steady, Lower, Uneven</dt><dd>Compare the last six complete weeks with the previous six. Exclude the first four days after each published release, and give the same weekdays equal weight. Compare the lower 30% download level, checking the 20% and 40% levels agree. Higher or Lower needs a change of at least 15%, at least five downloads/day, and agreement across at least two thirds of the comparable weekdays. Small changes read Steady; conflicting evidence reads Uneven. The number underneath is the usual quieter daily level.</dd><dt>An observation, not new-user growth</dt><dd>Downloads include updates. Longer update tails and changes in release frequency can still move the quiet level. The card does not turn that movement into a growth percentage or a decline alert.</dd><dt>A stricter check before flagging a decline</dt><dd>Inside each card, the release-adjusted check pairs days by weekday, time since release, and recent release count. It also excludes a full week after every release and removes individual weeks to test sensitivity. Only a decline supported by this stricter check adds a download action. If there are too few comparable days, that adjusted estimate stays unavailable.</dd><dt>The chart</dt><dd>Bars show downloads, with tall peaks capped to keep the quieter line visible. The line is the trailing lower download level outside the first four days after a release. Open a card for the full uncapped history.</dd><dt>Reminders and saved data</dt><dd>Release warnings begin at {policy.warningDays} days and become overdue at {policy.overdueDays}. Data is cached for 15 minutes. If WordPress.org fails, the last saved snapshot remains visible with its original timestamp.</dd></dl></div></Dialog>}


  </>;
}

export async function getStaticProps() {
  return { props: await getDashboardData(), revalidate: 900 };
}
