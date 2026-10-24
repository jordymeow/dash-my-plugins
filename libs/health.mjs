import { daysSince, needsCompatibilityReview, windowDates } from './metrics.mjs';

export const DEFAULT_POLICY = { warningDays: 32, overdueDays: 64 };
export const TREND_DAYS = 84;

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

// Same weekday, comparable age since release, and the same recent release load.
// No day is reused. Match by age only, never by its download count.
function matchedDays(points, minimumAge) {
  const key = (point) => `${point.weekday}:${point.age < 7 ? 0 : point.age < 14 ? 1 : point.age < 28 ? 2 : 3}:${Math.min(3, point.releaseLoad)}`;
  const groups = new Map();
  for (const point of points.filter((point) => point.exposureKnown && point.age >= minimumAge)) {
    const name = key(point);
    if (!groups.has(name)) groups.set(name, [[], []]);
    groups.get(name)[point.period].push(point);
  }
  const pairs = [];
  for (const [old, recent] of groups.values()) {
    old.sort((a, b) => a.age - b.age || a.index - b.index);
    recent.sort((a, b) => a.age - b.age || a.index - b.index);
    const memo = new Map();
    const best = (a, b) => a.pairs.length > b.pairs.length || (a.pairs.length === b.pairs.length && a.cost <= b.cost) ? a : b;
    function match(i, j) {
      if (i === old.length || j === recent.length) return { pairs: [], cost: 0 };
      const k = `${i}:${j}`;
      if (memo.has(k)) return memo.get(k);
      let result = best(match(i + 1, j), match(i, j + 1));
      const distance = Math.abs(Math.min(28, old[i].age) - Math.min(28, recent[j].age));
      if (distance <= (old[i].age < 14 ? 2 : 4)) {
        const rest = match(i + 1, j + 1);
        result = best(result, { pairs: [{ previous: old[i], current: recent[j], logRatio: Math.log((recent[j].value + 1) / (old[i].value + 1)) }, ...rest.pairs], cost: rest.cost + distance });
      }
      memo.set(k, result); return result;
    }
    pairs.push(...match(0, 0).pairs);
  }
  return pairs;
}

const percent = (log) => Math.expm1(log) * 100;
function summarizePairs(pairs) {
  const oldWeeks = new Set(pairs.map((pair) => Math.floor(pair.previous.index / 7)));
  const newWeeks = new Set(pairs.map((pair) => Math.floor(pair.current.index / 7)));
  const weekdays = new Set(pairs.map((pair) => pair.current.weekday));
  const effect = pairs.length ? median(pairs.map((pair) => pair.logRatio)) : null;
  // Leave one calendar week out on either side. This is a sensitivity range,
  // not a confidence interval: serially correlated update tails are not IID.
  const estimates = effect === null ? [] : [effect];
  for (const week of [...oldWeeks, ...newWeeks]) {
    const rest = pairs.filter((pair) => Math.floor(pair.previous.index / 7) !== week && Math.floor(pair.current.index / 7) !== week);
    if (rest.length >= 4) estimates.push(median(rest.map((pair) => pair.logRatio)));
  }
  return { pairs, count: pairs.length, oldWeeks: oldWeeks.size, newWeeks: newWeeks.size, weekdays: weekdays.size, effect,
    change: effect === null ? null : percent(effect),
    range: estimates.length ? [percent(Math.min(...estimates)), percent(Math.max(...estimates))] : null,
    baseline: pairs.length ? median(pairs.map((pair) => pair.current.value)) : null,
    previous: pairs.length ? median(pairs.map((pair) => pair.previous.value)) : null };
}

// Describe the observed lower download level, independently of the stricter
// release-adjusted health verdict. This is not an estimate of new users.
export function describeQuietDownloads(points, releaseCoverage) {
  const empty = { available: false, direction: 'missing', label: 'No data', baseline: null, previous: null, change: null };
  if (!releaseCoverage || points.some((point) => point.value === null)) return empty;
  const quiet = points.filter((point) => point.age !== null && point.age >= 4);
  const groups = Array.from({ length: 7 }, (_, weekday) => [0, 1].map((period) => quiet.filter((point) => point.weekday === weekday && point.period === period)))
    .filter(([previous, current]) => previous.length >= 2 && current.length >= 2);
  if (groups.length < 3) return empty;
  const coverage = [0, 1].map((period) => groups.flatMap((group) => group[period]));
  if (coverage.some((period) => period.length < 6 || new Set(period.map((point) => Math.floor(point.index / 7))).size < 3)) return empty;
  // Equal weekday weights prevent a different weekend mix from making a trend.
  // Lower quantiles resist isolated bursts; checking 20/30/40% prevents one
  // arbitrary percentile from deciding the direction.
  const comparisons = [0.2, 0.3, 0.4].map((q) => {
    const levels = groups.map((group) => group.map((period) => quantile(period.map((point) => point.value), q)));
    const changes = levels.map(([before, after]) => percent(Math.log((after + 1) / (before + 1))));
    return { change: median(changes), changes, previous: median(levels.map((level) => level[0])), baseline: median(levels.map((level) => level[1])) };
  });
  const middle = comparisons[1];
  const meaningful = Math.abs(middle.baseline - middle.previous) >= 5;
  const higher = meaningful && middle.change >= 15 && comparisons.every((comparison) => comparison.change > 5) && middle.changes.filter((change) => change > 5).length / groups.length >= 2 / 3;
  const lower = meaningful && middle.change <= -15 && comparisons.every((comparison) => comparison.change < -5) && middle.changes.filter((change) => change < -5).length / groups.length >= 2 / 3;
  const steady = Math.abs(middle.change) < 15 && comparisons.every((comparison) => Math.abs(comparison.change) < 20);
  const lowVolume = Math.max(middle.baseline, middle.previous) < 20;
  const direction = lowVolume ? 'low' : higher ? 'up' : lower ? 'down' : steady ? 'steady' : 'mixed';
  return { available: true, direction, label: lowVolume ? 'Low volume' : higher ? 'Higher' : lower ? 'Lower' : steady ? 'Steady' : 'Uneven',
    baseline: middle.baseline, previous: middle.previous, change: middle.change, weekdays: groups.length, days: coverage.map((period) => period.length) };
}

export function estimateTrend(downloads, asOf, releases = []) {
  const dates = windowDates(asOf, TREND_DAYS);
  const lookup = new Map((downloads || []).map(({ date, value }) => [date, value]));
  const releaseDates = [...new Set(releases.map((release) => release.date).filter((date) => date <= dates.at(-1)))].sort();
  const points = dates.map((date, index) => {
    const earlier = releaseDates.filter((release) => release <= date);
    const age = earlier.length ? Math.round((Date.parse(date) - Date.parse(earlier.at(-1))) / 86400000) : null;
    return { date, index, value: lookup.get(date) ?? null, age, weekday: new Date(date + 'T00:00:00Z').getUTCDay(), period: index < TREND_DAYS / 2 ? 0 : 1,
      exposureKnown: releaseDates.length > 0 && Date.parse(releaseDates[0]) <= Date.parse(date) - 28 * 86400000,
      releaseLoad: earlier.filter((release) => Date.parse(date) - Date.parse(release) < 28 * 86400000).length };
  });
  const missingDays = points.filter((point) => point.value === null).length;
  const releaseCoverage = releaseDates.length > 0 && releaseDates[0] <= dates[0];
  const available = missingDays === 0;
  const base = { available, comparable: false, direction: 'uncertain', change: null, candidateChange: null, baseline: null, previous: null, missingDays, releaseCoverage, pairCount: 0, range: null, strictChange: null, lowVolume: false, consistent: false, points: [], reason: 'history' };
  // The chart is explicitly descriptive. It cannot create a health direction.
  base.points = points.map((point, index) => {
    const window = points.slice(Math.max(0, index - 13), index + 1).filter((item) => item.value !== null && item.age !== null && item.age >= 4);
    return { ...point, baseline: window.length >= 4 ? quantile(window.map((item) => item.value), 0.3) : null,
      lower: window.length >= 4 ? quantile(window.map((item) => item.value), 0.2) : null,
      upper: window.length >= 4 ? quantile(window.map((item) => item.value), 0.5) : null,
      release: releaseDates.includes(point.date) };
  });
  base.quiet = describeQuietDownloads(points, releaseCoverage);
  if (!available || !releaseCoverage) return base;
  const matched = summarizePairs(matchedDays(points, 4));
  // A second pass discards a whole week after every release. A direction must
  // survive this check; otherwise update tails are a plausible explanation.
  const strict = summarizePairs(matchedDays(points, 7));
  Object.assign(base, { pairCount: matched.count, strictPairCount: strict.count, range: matched.range, baseline: matched.baseline, previous: matched.previous,
    candidateChange: matched.change, strictChange: strict.change, matchedWeeks: [matched.oldWeeks, matched.newWeeks], reason: 'releases' });
  const enough = matched.count >= 10 && matched.oldWeeks >= 4 && matched.newWeeks >= 4 && matched.weekdays >= 4;
  const strictEnough = strict.count >= 6 && strict.oldWeeks >= 3 && strict.newWeeks >= 3 && strict.weekdays >= 3;
  if (!enough || !strictEnough) return base;
  base.lowVolume = Math.max(matched.baseline, matched.previous) < 20;
  if (base.lowVolume || matched.previous < 5) return { ...base, reason: 'low-volume' };
  const stableCorrection = Math.abs(matched.change - strict.change) <= 10;
  if (!stableCorrection) return base;
  const meaningful = Math.abs(matched.baseline - matched.previous) >= 5;
  const down = meaningful && matched.change <= -10 && matched.range[1] < -5 && strict.change <= -10 && strict.range[1] < 0;
  const up = meaningful && matched.change >= 10 && matched.range[0] > 5 && strict.change >= 10 && strict.range[0] > 0;
  const steady = Math.abs(matched.change) < 10 && matched.range[0] > -15 && matched.range[1] < 15 && Math.abs(strict.change) < 10;
  const direction = down ? 'down' : up ? 'up' : steady ? 'steady' : 'uncertain';
  return { ...base, direction, comparable: direction !== 'uncertain', change: direction !== 'uncertain' ? matched.change : null,
    consistent: direction !== 'uncertain', reason: direction === 'uncertain' ? 'noise' : null };
}

export function trendLabel(trend) {
  return trend.direction === 'up' ? 'Going up' : trend.direction === 'down' ? 'Going down' : trend.direction === 'steady' ? 'Steady' : 'Unclear';
}
export function trendExplanation(trend) {
  if (trend.direction === 'up' || trend.direction === 'down') return 'Comparable days · last 6 weeks vs. previous 6';
  if (trend.direction === 'steady') return 'No clear change on comparable days';
  if (trend.reason === 'releases') return 'Updates make this hard to compare';
  if (trend.reason === 'low-volume') return 'Too few downloads for a reliable direction';
  if (trend.reason === 'noise') return 'The comparable days disagree';
  return 'More download or release history needed';
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
  const trend = estimateTrend(plugin.downloads, asOf, plugin.releases);
  const compatibility = needsCompatibilityReview(plugin.tested, wpVersion);
  const actions = [];
  if (!plugin.available) actions.push({ kind: 'data', level: 'unknown', label: 'Refresh plugin data', detail: 'WordPress.org metadata is unavailable.' });
  if (release.state === 'overdue') actions.push({ kind: 'release', level: 'urgent', label: 'Prepare a new release', detail: `Last release ${release.age} days ago; your limit is ${policy.overdueDays} days.` });
  if (release.state === 'soon') actions.push({ kind: 'release', level: 'watch', label: 'Plan the next release', detail: `${release.daysLeft} days until your ${policy.overdueDays}-day release limit.` });
  if (compatibility) actions.push({ kind: 'compatibility', level: 'watch', label: 'Check WordPress compatibility', detail: `Tested up to ${plugin.tested}; the current release is ${wpVersion}.` });
  if (trend.direction === 'down') actions.push({ kind: 'trend', level: 'watch', label: 'Investigate falling downloads', detail: `Downloads on comparable days are down ${Math.abs(trend.change).toFixed(0)}%. The direction survives excluding a full week after each release.` });
  if (plugin.openSupport > 0) actions.push({ kind: 'support', level: 'watch', label: `Review ${plugin.openSupport} open ${plugin.openSupport === 1 ? 'thread' : 'threads'}`, detail: 'Unresolved WordPress.org support topics in the last two months; not necessarily unanswered.' });
  if (plugin.numRatings >= 5 && plugin.rating !== null && plugin.rating < 85) actions.push({ kind: 'rating', level: 'watch', label: 'Review recent feedback', detail: `The average rating is ${(plugin.rating / 20).toFixed(1)}/5.` });
  const incomplete = !plugin.available || !trend.available || release.state === 'unknown' || compatibility === null || plugin.openSupport === null;
  const priority = release.state === 'overdue' ? 10000 + (release.age - policy.overdueDays) : release.state === 'soon' ? 5000 + release.age : 0;
  const score = priority + (compatibility ? 150 : 0) + (trend.direction === 'down' ? 120 + Math.min(99, Math.abs(trend.change)) : 0) + (plugin.openSupport > 0 ? 50 + Math.min(49, plugin.openSupport) : 0) + (incomplete ? 30 : 0) + (actions.some((action) => action.kind === 'rating') ? 30 : 0);
  const uncertainTrend = trend.direction === 'mixed' || trend.direction === 'uncertain';
  const status = release.state === 'overdue' ? 'overdue' : actions.some((action) => action.level === 'watch') ? 'watch' : incomplete || uncertainTrend ? 'unknown' : 'healthy';
  return { release, trend, compatibility, actions, status, score, incomplete };
}
