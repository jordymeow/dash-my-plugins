import { decode } from 'html-entities';
import { fetchDownloadsStats, fetchPluginInfo, fetchWordPressVersion } from './requests';
import { parseWordPressDate, shortName } from './metrics.mjs';
import { parseReleases } from './health.mjs';
import { createSnapshotCache } from './snapshot-cache.mjs';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';

const count = (value) => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Math.max(0, Number(value));

async function loadPlugin(slug) {
  const [data, downloads] = await Promise.all([fetchPluginInfo(slug), fetchDownloadsStats(slug)]);
  if (!data?.slug) return { slug, name: slug, fullName: slug, available: false, downloads: null, icon: null };
  const fullName = decode(data.name);
  const totalSupport = count(data.support_threads);
  const resolvedSupport = count(data.support_threads_resolved);
  const releases = parseReleases(data.sections?.changelog, data.version);
  const currentRelease = releases.find((release) => release.version === data.version);
  return {
    slug, fullName, name: shortName(fullName), available: true,
    icon: data.icons?.['2x'] || data.icons?.['1x'] || null,
    version: data.version || null,
    tested: data.tested ? String(data.tested) : null,
    rating: count(data.rating),
    numRatings: count(data.num_ratings) ?? 0,
    totalSupport,
    resolvedSupport,
    openSupport: totalSupport === null || resolvedSupport === null ? null : Math.max(0, totalSupport - resolvedSupport),
    activeInstalls: count(data.active_installs),
    lastUpdated: currentRelease ? `${currentRelease.date}T00:00:00Z` : parseWordPressDate(data.last_updated),
    releaseDateSource: currentRelease ? 'changelog' : 'metadata',
    releases,
    downloads: downloads ? Object.fromEntries(downloads.slice(-730).map(({ date, value }) => [date, value])) : null,
  };
}

async function loadDashboard() {
  const slugs = [...new Set((process.env.PLUGINS || '').split(',').map((slug) => slug.trim()).filter((slug) => /^[a-z0-9-]+$/.test(slug)))];
  const versionRequest = fetchWordPressVersion();
  const plugins = [];
  // Bounded batches avoid hammering WordPress.org while loading much faster than serial requests.
  for (let i = 0; i < slugs.length; i += 4) plugins.push(...await Promise.all(slugs.slice(i, i + 4).map(loadPlugin)));
  const wpVersion = await versionRequest;
  const snapshot = {
    siteName: process.env.SITE_NAME?.trim() || 'Dash My Plugins',
    plugins, wpVersion, fetchedAt: new Date().toISOString(),
  };
  if (slugs.length && (plugins.some((plugin) => !plugin.available || !plugin.downloads) || !wpVersion)) throw new Error('WordPress.org returned an incomplete snapshot.');
  return snapshot;
}

const cacheKey = createHash('sha256').update(`v5:${process.env.PLUGINS}:${process.env.SITE_NAME}`).digest('hex').slice(0, 16);
const cacheFile = path.join(process.env.DASH_CACHE_DIR || path.join(process.cwd(), '.cache'), `dashboard-${cacheKey}.json`);
const getCached = createSnapshotCache({
  load: loadDashboard,
  read: async () => JSON.parse(await readFile(cacheFile, 'utf8')),
  write: async (data) => {
    await mkdir(path.dirname(cacheFile), { recursive: true });
    const temporary = `${cacheFile}.${process.pid}.tmp`;
    await writeFile(temporary, JSON.stringify(data));
    await rename(temporary, cacheFile);
  },
});
export const getDashboardData = () => getCached();
