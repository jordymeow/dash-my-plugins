import DayJS from 'dayjs';
import https from 'https';

const WP_API = 'https://api.wordpress.org';

// Reliable fetch using Node.js https module (works better in Alpine Docker than fetch/undici)
const fetchWithHttps = (url) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout after 30s'));
    }, 30000);

    https.get(url, {
      family: 4, // Force IPv4 only
      headers: {
        'User-Agent': 'dash-my-plugins/1.0'
      },
      timeout: 30000
    }, (res) => {
      clearTimeout(timeout);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(new Error('Failed to parse JSON: ' + err.message));
        }
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    }).on('timeout', () => {
      clearTimeout(timeout);
      reject(new Error('Request timeout'));
    });
  });
};

// https://api.wordpress.org/stats/plugin/1.0/downloads.php?slug={media-cleaner}

const dataAggregateForDownloads = (data, aggregateBy = 'month') => {
	// if (data.length < 90)
	// 	return data;
	data.forEach(x => { x.date = DayJS(x.date).endOf(aggregateBy).toISOString() });
	var newData = [];
	data.reduce((res, value) => {
		if (!res[value.date]) {
			res[value.date] = { date: value.date, value: value.value };
			newData.push(res[value.date])
		}
		res[value.date].value += value.value;
		return res;
	}, {});
	return newData;
}

const dataAggregateForInstalls = (data, aggregateBy = 'month') => {
	// if (data.length < 90)
	// 	return data;
	data.forEach(x => { x.date = DayJS(x.date).endOf(aggregateBy).toISOString() });
	var newData = [];
	data.reduce((res, value) => {
    let realValue = parseFloat(value.value);
		if (!res[value.date]) {
			res[value.date] = { date: value.date, value: 0 };
			newData.push(res[value.date])
		}
		res[value.date].value += realValue;
		return res;
	}, {});
	return newData;
}

const fetchPluginInfo = async (slug) => {
  try {
    const json = await fetchWithHttps(`${WP_API}/plugins/info/1.2/?action=plugin_information&request[slug]=${slug}`);
    return json;
  }
  catch (err) {
    console.error(`Failed to fetch plugin info for ${slug}:`, err.message);
    return null;
  }
}

const fetchActiveStats = async (slug) => {
  // Note: WordPress.org API does not provide historical active install data
  // Only current active_installs count is available from plugin info endpoint
  // Returning null to indicate no historical data available
  return null;
}

const fetchDownloadsStats = async (slug) => {
  try {
    const json = await fetchWithHttps(`${WP_API}/stats/plugin/1.0/downloads.php?slug=${slug}&limit=730`);
    let chartsDownloadsData = [];
    for (const date of Object.keys(json))
      chartsDownloadsData.push({ date: new Date(date), value: parseInt(json[date]) });
    chartsDownloadsData = dataAggregateForDownloads(chartsDownloadsData);
    return chartsDownloadsData;
  }
  catch (err) {
    console.error(`Failed to fetch download stats for ${slug}:`, err.message);
    return null;
  }
}

const fetchWordPressVersion = async () => {
  try {
    const data = await fetchWithHttps(`${WP_API}/core/version-check/1.7/`);
    // The latest version is in the first offer
    if (data.offers && data.offers.length > 0) {
      return data.offers[0].version;
    }
    return null;
  }
  catch (err) {
    console.warn('Failed to fetch WordPress version, using fallback:', err.message);
    return 'Unknown';
  }
}

export { fetchPluginInfo, fetchWordPressVersion, fetchActiveStats, fetchDownloadsStats };