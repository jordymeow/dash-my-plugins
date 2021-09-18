import DayJS from 'dayjs';

const WP_API = 'https://api.wordpress.org';

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
    const res = await fetch(`${WP_API}/plugins/info/1.2/?action=plugin_information&request[slug]=${slug}`);
    const json = await res.json();
    return json;
  }
  catch (err) {
    return null;
  }
}

const fetchActiveStats = async (slug) => {
  try {
    const res = await fetch(`${WP_API}/stats/plugin/1.0/active-installs.php?slug=${slug}&limit=730`);
    const json = await res.json();
    let chartsInstallsData = [];
    for (const date of Object.keys(json))
      chartsInstallsData.push({ date: new Date(date), value: json[date] });
    chartsInstallsData = dataAggregateForInstalls(chartsInstallsData);
    return chartsInstallsData;
  }
  catch (err) {
    return null;
  }
}

const fetchDownloadsStats = async (slug) => {
  try {
    const res = await fetch(`${WP_API}/stats/plugin/1.0/downloads.php?slug=${slug}&limit=730`);
    const json = await res.json();
    let chartsDownloadsData = [];
    for (const date of Object.keys(json))
      chartsDownloadsData.push({ date: new Date(date), value: parseInt(json[date]) });
    chartsDownloadsData = dataAggregateForDownloads(chartsDownloadsData);
    return chartsDownloadsData;
  }
  catch (err) {
    return null;
  }
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