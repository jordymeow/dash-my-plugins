export const DAY = 86400000;
export const number = (value) => new Intl.NumberFormat('en-US').format(value ?? 0);
export const compact = (value) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value ?? 0);

export function parseWordPressDate(value) {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?(?:\s+GMT|Z)?$/i);
  if (!match) return null;
  const [, year, month, day, h, minute, second = '0', meridiem] = match;
  let hour = Number(h);
  if (meridiem) hour = hour % 12 + (meridiem.toLowerCase() === 'pm' ? 12 : 0);
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function dailyDownloads(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const values = Object.entries(raw)
    .filter(([date, value]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Number(value)) && Number(value) >= 0)
    .map(([date, value]) => ({ date, value: Number(value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return values.length ? values : null;
}

// A single UTC cutoff keeps every plugin and both comparison periods aligned.
// Today's incomplete totals never masquerade as a full day's performance.
export function windowDates(asOf, days = 30, offset = 0) {
  const end = Date.parse(String(asOf).slice(0, 10) + 'T00:00:00Z') - offset * DAY;
  return Array.from({ length: days }, (_, index) => new Date(end - (days - index) * DAY).toISOString().slice(0, 10));
}

export function downloadTotal(downloads, dates) {
  if (!Array.isArray(downloads)) return null;
  const lookup = new Map(downloads.map(({ date, value }) => [date, value]));
  // Unknown dates are not zero downloads. Hide incomplete-period comparisons.
  if (dates.some((date) => !lookup.has(date))) return null;
  return dates.reduce((total, date) => total + lookup.get(date), 0);
}

export function downloadWindow(downloads, asOf, days = 30) {
  const current = downloadTotal(downloads, windowDates(asOf, days));
  const previous = downloadTotal(downloads, windowDates(asOf, days, days));
  const change = current !== null && previous > 0 ? ((current - previous) / previous) * 100 : null;
  return { current, previous, change };
}

export function aggregateDownloads(plugins, dates) {
  const included = plugins.filter((plugin) => downloadTotal(plugin.downloads, dates) !== null);
  const sums = new Map(dates.map((date) => [date, 0]));
  for (const plugin of included) {
    for (const point of plugin.downloads) {
      if (sums.has(point.date)) sums.set(point.date, sums.get(point.date) + point.value);
    }
  }
  return { points: included.length ? [...sums].map(([date, value]) => ({ date, value })) : [], included: included.length };
}

export function groupDownloads(points, size = 1) {
  const groups = [];
  for (let i = 0; i < points.length; i += size) {
    const group = points.slice(i, i + size);
    groups.push({ date: group[0].date, endDate: group[group.length - 1].date, value: group.reduce((sum, point) => sum + point.value, 0) });
  }
  return groups;
}

export function needsCompatibilityReview(tested, current) {
  if (!tested || !current || !/^\d+\.\d+/.test(tested) || !/^\d+\.\d+/.test(current)) return null;
  const [a, b] = tested.split('.').map(Number);
  const [x, y] = current.split('.').map(Number);
  return a < x || (a === x && b < y);
}

export function signalsFor(plugin, wpVersion) {
  if (!plugin.available) return [{ kind: 'data', label: 'Data unavailable', detail: 'WordPress.org did not return plugin information.', url: `https://wordpress.org/plugins/${plugin.slug}/` }];
  const signals = [];
  if (plugin.openSupport > 0) signals.push({ kind: 'support', label: `${plugin.openSupport} open ${plugin.openSupport === 1 ? 'thread' : 'threads'}`, detail: 'Unresolved support topics reported by WordPress.org in the last two months.', url: `https://wordpress.org/support/plugin/${plugin.slug}/` });
  const compatibility = needsCompatibilityReview(plugin.tested, wpVersion);
  if (compatibility === true) signals.push({ kind: 'compatibility', label: 'Check compatibility', detail: `Tested up to ${plugin.tested}; WordPress ${wpVersion} is available. This does not mean the plugin is incompatible.`, url: `https://wordpress.org/plugins/${plugin.slug}/#developers` });
  if (plugin.rating !== null && plugin.rating < 85 && plugin.numRatings >= 5) signals.push({ kind: 'rating', label: 'Review feedback', detail: `${(plugin.rating / 20).toFixed(1)} out of 5 across ${number(plugin.numRatings)} reviews.`, url: `https://wordpress.org/support/plugin/${plugin.slug}/reviews/` });
  return signals;
}

export function shortName(name) {
  return name.split(/\s[–—|]\s|:\s|\s\(/)[0].trim();
}

export function daysSince(date, asOf) {
  return date ? Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(date)) / DAY)) : null;
}

export function relativeDate(date, asOf) {
  const days = daysSince(date, asOf);
  if (days === null) return 'Date unavailable';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function portfolioSummary(plugins, asOf) {
  const available = plugins.filter((plugin) => plugin.available);
  const reviewed = available.filter((plugin) => plugin.numRatings > 0 && plugin.rating !== null);
  const reviews = reviewed.reduce((sum, plugin) => sum + plugin.numRatings, 0);
  const periods = available.map((plugin) => downloadWindow(plugin.downloads, asOf));
  // The headline comparison uses exactly the same cohort in both periods.
  const comparable = periods.filter((period) => period.current !== null && period.previous !== null);
  const downloads = comparable.length ? comparable.reduce((sum, period) => sum + period.current, 0) : null;
  const previous = comparable.reduce((sum, period) => sum + period.previous, 0);
  return {
    installs: available.reduce((sum, plugin) => sum + (plugin.activeInstalls ?? 0), 0),
    installCoverage: available.filter((plugin) => plugin.activeInstalls !== null).length,
    support: available.reduce((sum, plugin) => sum + (plugin.openSupport ?? 0), 0),
    supportCoverage: available.filter((plugin) => plugin.openSupport !== null).length,
    reviews,
    rating: reviews ? reviewed.reduce((sum, plugin) => sum + plugin.rating * plugin.numRatings, 0) / reviews / 20 : null,
    downloads,
    downloadCoverage: comparable.length,
    change: downloads !== null && previous > 0 ? (downloads - previous) / previous * 100 : null,
  };
}
