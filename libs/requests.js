const WP_API = 'https://api.wordpress.org';

// https://api.wordpress.org/stats/plugin/1.0/downloads.php?slug={media-cleaner}

const fetchPluginInfo = async (slug) => {
  const res = await fetch(`${WP_API}/plugins/info/1.2/?action=plugin_information&request[slug]=${slug}`);
  const json = await res.json();
  return json;
}

const fetchActiveStats = async (slug) => {
  const res = await fetch(`${WP_API}/stats/plugin/1.0/active-installs.php?slug=${slug}&limit=730`);
  const json = await res.json();
  return json;
}

const fetchDownloadsStats = async (slug) => {
  const res = await fetch(`${WP_API}/stats/plugin/1.0/downloads.php?slug=${slug}&limit=730`);
  const json = await res.json();
  return json;
}

const fetchWordPressVersion = async () => {
  const res = await fetch(`${WP_API}/core/stable-check/1.0/`);
  const data = await res.json();
  const versions = Object.keys(data);
  for (let version of versions) {
    if (data[version] === 'latest') {
      return version;
    }
  }
  return null;
}

export { fetchPluginInfo, fetchWordPressVersion, fetchActiveStats, fetchDownloadsStats };