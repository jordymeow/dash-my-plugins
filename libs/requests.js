import DayJS from 'dayjs';

const WP_API = 'https://api.wordpress.org';

// Custom fetch with timeout to handle slow/IPv6 connections
const fetchWithTimeout = async (url, timeout = 30000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'dash-my-plugins/1.0'
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
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
    const res = await fetchWithTimeout(`${WP_API}/plugins/info/1.2/?action=plugin_information&request[slug]=${slug}`);
    const json = await res.json();
    return json;
  }
  catch (err) {
    console.error(`Failed to fetch plugin info for ${slug}:`, err.message);
    return null;
  }
}

const fetchActiveStats = async (slug) => {
  try {
    const res = await fetchWithTimeout(`${WP_API}/stats/plugin/1.0/active-installs.php?slug=${slug}&limit=730`);
    const json = await res.json();
    let chartsInstallsData = [];
    for (const date of Object.keys(json))
      chartsInstallsData.push({ date: new Date(date), value: json[date] });
    chartsInstallsData = dataAggregateForInstalls(chartsInstallsData);
    return chartsInstallsData;
  }
  catch (err) {
    console.error(`Failed to fetch active stats for ${slug}:`, err.message);
    return null;
  }
}

const fetchDownloadsStats = async (slug) => {
  try {
    const res = await fetchWithTimeout(`${WP_API}/stats/plugin/1.0/downloads.php?slug=${slug}&limit=730`);
    const json = await res.json();
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
    const res = await fetchWithTimeout(`${WP_API}/core/version-check/1.7/`);
    const data = await res.json();
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