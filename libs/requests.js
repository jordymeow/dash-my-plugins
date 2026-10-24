import https from 'https';
import { dailyDownloads } from './metrics.mjs';

const WP_API = 'https://api.wordpress.org';

export const fetchWithHttps = (url) => new Promise((resolve, reject) => {
  let settled = false;
  let timer;
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (error) reject(error); else resolve(value);
  };
  const request = https.get(url, {
    family: 4,
    headers: { 'User-Agent': 'dash-my-plugins/2.0', Accept: 'application/json' },
  }, (response) => {
    if (response.statusCode !== 200) {
      response.resume();
      finish(new Error(`WordPress.org returned HTTP ${response.statusCode}`));
      return;
    }
    let body = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => { body += chunk; });
    response.on('error', (error) => finish(error));
    response.on('end', () => {
      try { finish(null, JSON.parse(body)); }
      catch { finish(new Error('WordPress.org returned an invalid response')); }
    });
  });
  timer = setTimeout(() => request.destroy(new Error('WordPress.org request timed out')), 15000);
  request.on('error', (error) => finish(error));
});

async function requestData(url) {
  try { return await fetchWithHttps(url); }
  catch (firstError) {
    // A transient DNS or connection failure should not blank the dashboard.
    try { return await fetchWithHttps(url); }
    catch (error) {
      console.warn('WordPress.org request failed:', error.message);
      return null;
    }
  }
}

export async function fetchPluginInfo(slug) {
  const query = new URLSearchParams({
    action: 'plugin_information',
    'request[slug]': slug,
    'request[fields][icons]': 'true',
    'request[fields][sections]': 'true',
    'request[fields][screenshots]': 'false',
    'request[fields][versions]': 'false',
  });
  return requestData(`${WP_API}/plugins/info/1.2/?${query}`);
}

export async function fetchDownloadsStats(slug) {
  const raw = await requestData(`${WP_API}/stats/plugin/1.0/downloads.php?slug=${encodeURIComponent(slug)}&limit=730`);
  return dailyDownloads(raw);
}

export async function fetchWordPressVersion() {
  const data = await requestData(`${WP_API}/core/version-check/1.7/`);
  return data?.offers?.find((offer) => offer.response === 'upgrade')?.version || data?.offers?.[0]?.version || null;
}
