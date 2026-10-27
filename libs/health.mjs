import { daysSince, needsCompatibilityReview, windowDates } from './metrics.mjs';

export const DEFAULT_POLICY = { warningDays: 32, overdueDays: 64 };

export function quantile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const left = Math.floor(position);
  return sorted[left] + (sorted[Math.ceil(position)] - sorted[left]) * (position - left);
}

const median = (values) => quantile(values, 0.5);

// Dated release headings are supplied by the plugin author, not inferred from
// download peaks or local git commits. Keep the full date coverage explicit.
export function parseReleases(changelog, currentVersion) {
  const releases = [];
  for (const match of String(changelog || '').matchAll(/<h[2-6][^>]*>([\s\S]*?)<\/h[2-6]>/gi)) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    const parts = text.match(/^(\d+(?:\.\d+)+)\s*\((\d{4})[/-](\d{1,2})[/-](\d{1,2})\)/);
    if (!parts) continue;
    const [, version, year, month, day] = parts;
    const date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const timestamp = Date.parse(date + 'T00:00:00Z');
    if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) continue;
    // A readme may already describe the next unreleased version.
    const a = version.split('.').map(Number), b = String(currentVersion || '').split('.').map(Number);
    let newer = false;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if ((a[i] || 0) === (b[i] || 0)) continue;
      newer = (a[i] || 0) > (b[i] || 0); break;
    }
    if (!newer) releases.push({ version, date });
  }
  return releases.sort((a, b) => a.date.localeCompare(b.date));
}

export const BLOCK_DAYS = 28;
export const TREND_BLOCKS = 13;
const percent = (log) => Math.expm1(log) * 100;
const level = (value) => Math.log(value + 1);

// Four-week blocks hold exactly four of each weekday, so the weekday mix never
// moves a floor. The 25th percentile is the level between release spikes and
// needs no release dates: WordPress.org truncates long changelogs.
export function downloadFloors(downloads, asOf) {
  const lookup = new Map((downloads || []).map(({ date, value }) => [date, value]));
  const dates = windowDates(asOf, BLOCK_DAYS * TREND_BLOCKS * 2);
  return Array.from({ length: TREND_BLOCKS * 2 }, (_, index) => {
    const block = dates.slice(index * BLOCK_DAYS, (index + 1) * BLOCK_DAYS);
    const values = block.filter((date) => lookup.has(date)).map((date) => lookup.get(date));
    return { start: block[0], end: block.at(-1), floor: values.length >= 24 ? quantile(values, 0.25) : null,
      total: values.length === BLOCK_DAYS ? values.reduce((sum, value) => sum + value, 0) : null };
  });
}

// Each block is paired with the same four weeks one year earlier, so weekdays
// and seasons line up. The median ratio ignores a single unusual month.
function pairedChange(blocks, previousBlocks, minimum) {
  const ratios = blocks.map((block, i) => [previousBlocks[i].floor, block.floor])
    .filter(([before, after]) => before !== null && after !== null)
    .map(([before, after]) => level(after) - level(before));
  return ratios.length >= minimum ? percent(median(ratios)) : null;
}

export function estimateTrend(downloads, asOf) {
  const blocks = downloadFloors(downloads, asOf);
  const previousYear = blocks.slice(0, TREND_BLOCKS), year = blocks.slice(TREND_BLOCKS);
  const change = pairedChange(year, previousYear, 6);
  const recent = pairedChange(year.slice(-3), previousYear.slice(-3), 3);
  const floors = year.map((block) => block.floor).filter((floor) => floor !== null);
  const current = year.at(-1).floor;
  const totals = year.map((block) => block.total);
  const base = { change, recent, current, blocks: year, previousBlocks: previousYear, total: totals.includes(null) ? null : totals.reduce((sum, value) => sum + value, 0) };
  if (change === null || recent === null || current === null) return { ...base, available: false, direction: 'missing', change: null };
  // The last twelve weeks must agree, so a recent turn is never hidden by a good year.
  const direction = median(floors) < 5 ? 'low'
    : change >= 10 && recent > 0 ? 'up'
    : change <= -10 && recent < 0 ? 'down'
    : Math.abs(change) < 10 && Math.abs(recent) < 20 ? 'steady' : 'mixed';
  return { ...base, available: true, direction };
}

// A plugin moving with the whole portfolio says more about the season or
// WordPress.org than about the plugin itself.
export function portfolioChange(trends) {
  const changes = trends.filter((trend) => trend.available && trend.direction !== 'low').map((trend) => trend.change);
  return changes.length >= 3 ? median(changes) : null;
}

export function trendLabel(trend) {
  return { up: 'Growing', down: 'Declining', steady: 'Steady', mixed: 'Mixed', low: 'Low volume', missing: 'No data' }[trend.direction];
}
export function trendExplanation(trend) {
  if (trend.direction === 'missing') return 'About 18 months of download history are needed.';
  if (trend.direction === 'low') return 'Too few downloads for a reliable direction.';
  if (trend.direction === 'mixed') return 'The last 12 months and the last 12 weeks disagree.';
  return 'Quiet floor, last 12 months vs. the same months a year earlier.';
}

export function releaseStatus(plugin, asOf, policy = DEFAULT_POLICY) {
  const age = daysSince(plugin.lastUpdated, asOf);
  if (!plugin.available || age === null) return { state: 'unknown', age: null, label: 'Release date unavailable' };
  if (age >= policy.overdueDays) return { state: 'overdue', age, label: 'Release overdue', overdueBy: age - policy.overdueDays };
  if (age >= policy.warningDays) return { state: 'soon', age, label: 'Release due soon', daysLeft: policy.overdueDays - age };
  return { state: 'fresh', age, label: 'Release on track', daysLeft: policy.overdueDays - age };
}

export function assessPlugin(plugin, wpVersion, asOf, policy = DEFAULT_POLICY) {
  const release = releaseStatus(plugin, asOf, policy);
  const trend = estimateTrend(plugin.downloads, asOf);
  const compatibility = needsCompatibilityReview(plugin.tested, wpVersion);
  const actions = [];
  if (!plugin.available) actions.push({ kind: 'data', level: 'unknown', label: 'Refresh plugin data', detail: 'WordPress.org metadata is unavailable.' });
  if (release.state === 'overdue') actions.push({ kind: 'release', level: 'urgent', label: 'Prepare a new release', detail: `Last release ${release.age} days ago; your limit is ${policy.overdueDays} days.` });
  if (release.state === 'soon') actions.push({ kind: 'release', level: 'watch', label: 'Plan the next release', detail: `${release.daysLeft} days until your ${policy.overdueDays}-day release limit.` });
  if (compatibility) actions.push({ kind: 'compatibility', level: 'watch', label: 'Check WordPress compatibility', detail: `Tested up to ${plugin.tested}; the current release is ${wpVersion}.` });
  if (trend.direction === 'down') actions.push({ kind: 'trend', level: 'watch', label: 'Investigate falling downloads', detail: `The quiet download floor is ${Math.abs(trend.change).toFixed(0)}% lower than the year before${trend.recent >= 0 ? '' : `, and the last 12 weeks are ${Math.abs(trend.recent).toFixed(0)}% below the same weeks last year`}.` });
  if (plugin.openSupport > 0) actions.push({ kind: 'support', level: 'watch', label: `Review ${plugin.openSupport} open ${plugin.openSupport === 1 ? 'thread' : 'threads'}`, detail: 'Unresolved WordPress.org support topics in the last two months; not necessarily unanswered.' });
  if (plugin.numRatings >= 5 && plugin.rating !== null && plugin.rating < 85) actions.push({ kind: 'rating', level: 'watch', label: 'Review recent feedback', detail: `The average rating is ${(plugin.rating / 20).toFixed(1)}/5.` });
  const incomplete = !plugin.available || !trend.available || release.state === 'unknown' || compatibility === null || plugin.openSupport === null;
  const priority = release.state === 'overdue' ? 10000 + (release.age - policy.overdueDays) : release.state === 'soon' ? 5000 + release.age : 0;
  const score = priority + (compatibility ? 150 : 0) + (trend.direction === 'down' ? 120 + Math.min(99, Math.abs(trend.change)) : 0) + (plugin.openSupport > 0 ? 50 + Math.min(49, plugin.openSupport) : 0) + (incomplete ? 30 : 0) + (actions.some((action) => action.kind === 'rating') ? 30 : 0);
  const uncertainTrend = trend.direction === 'mixed';
  const status = release.state === 'overdue' ? 'overdue' : actions.some((action) => action.level === 'watch') ? 'watch' : incomplete || uncertainTrend ? 'unknown' : 'healthy';
  return { release, trend, compatibility, actions, status, score, incomplete };
}
