import compareVersions from 'compare-versions';
import Image from 'next/image';
import DayJS from 'dayjs';
import { Icon } from '@iconify/react';
import alertIcon from '@iconify/icons-mdi/alert';
import accountCircle from '@iconify/icons-mdi/account-circle';
import { ResponsiveContainer, ReferenceLine, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip } from 'recharts';

import ago from 's-ago';
import css from '../styles/Card.module.css'

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const dataAggregateForDownloads = (data, aggregateBy = 'month') => {
	if (data.length < 90)
		return data;
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
	if (data.length < 90)
		return data;
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

const PluginCard = ({ data, wpVersion }) => {
  const readableTime = ago(new Date(data.last_updated));
  const isOutdated = compareVersions(wpVersion, data.tested.toString());
  const needsPush = (new Date() - new Date(data.last_updated)) > (1000 * 60 * 60 * 24 * 7 * 3);

  let chartsDownloadsData = [];
  for (const date of Object.keys(data.downloads))
    chartsDownloadsData.push({ date: new Date(date), value: parseInt(data.downloads[date]) });
  chartsDownloadsData = dataAggregateForDownloads(chartsDownloadsData);

  let chartsInstallsData = [];
  for (const date of Object.keys(data.activeInstalls))
    chartsInstallsData.push({ date: new Date(date), value: data.activeInstalls[date] });
  chartsInstallsData = dataAggregateForInstalls(chartsInstallsData);

  const finalData = [];
  for (let c = 0; c < chartsDownloadsData.length; c++) {
    finalData.push({
      date: chartsDownloadsData[c].date,
      downloads: chartsDownloadsData[c].value,
      installsGrowth: chartsInstallsData[c].value,
    });
  }

  return (<div key={data.slug} className={css.card}>
    <div className={css.banner}><Image src={data.banners.high} layout='fill' alt={data.slug} /></div>
    <h2 className={css.cardTitle}>
      {data.name}
      <small>
        {numberWithCommas(data.active_installs)}
        <Icon icon={accountCircle} width={18} style={{ position: 'relative', top: 4, marginLeft: 4, marginTop: 0 }} /> 
      </small>
    </h2>
    <div className={css.content}>
      
      <div className={css.attributes}>

        <div className={css.attribute}>
          <div className={needsPush ? css.redFont : ''}>{data.version}
            {needsPush && <Icon icon={alertIcon} color={'orange'} />}</div>
          <small>{readableTime}</small>
        </div>

        <div className={css.attribute}>
          <div className={isOutdated ? css.redFont : ''}>{data.tested}
            {isOutdated && <Icon icon={alertIcon} color={'orange'} />}
          </div>
          <small>WordPress</small>
        </div>

        <div className={css.attribute}>
          <a href={`https://wordpress.org/support/plugin/${data.slug}/`} rel="noreferrer" target="_blank">
            <div className={data.support_threads ? css.redFont : css.greenFont}>
              {!data.support_threads ? '0' : data.support_threads}
              {!!data.support_threads && <Icon icon={alertIcon} color={'orange'} />}
            </div>
          </a>
          <small>Support</small>
        </div>

        <div className={css.attribute}>
          <a href={`https://wordpress.org/support/plugin/media-cleaner/${data.slug}/reviews/`} rel="noreferrer" target="_blank">
            <div className={data.rating > 90 ? css.greenFont : css.redFont}>{data.rating}
              <small style={{ color: '#d2d2d2' }}> / 100</small>
            </div>
          </a>
          <small>Score</small>
        </div>

      </div>

      <div style={{ display: 'flex', height: 90, width: '100%', marginTop: 10, marginBottom: -10 }}>
        <ResponsiveContainer>
          <ComposedChart data={finalData} margin={0} padding={0}>
            <defs>
              <linearGradient id="downloadsGradient" x1="0" y1="0" x2="0" y2="100%" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="var(--blue)" />
                <stop offset="0.5" stopColor="#c3ddff" />
                <stop offset="1" stopColor="#c3ddff" />
              </linearGradient>
            </defs>
            <Bar dataKey="downloads" yAxisId="yDownloads"
              fill="url(#downloadsGradient)" strokeWidth={0} isAnimationActive={false} />
            <Line dataKey="installsGrowth" yAxisId="yInstallsGrowth" stroke="orange" strokeWidth={2} dot={false} />
            <XAxis dataKey="date" hide={false} interval={'preserveStart'} 
              tickFormatter={x => DayJS(x).format('YYYY/MM')} style={{ fontFamily: 'Open Sans', fontSize: 9 }} />
            <ReferenceLine y={0} yAxisId="yInstallsGrowth" stroke="#ffdc9d" strokeWidth={2} />
            <YAxis dataKey="downloads" yAxisId="yDownloads" hide={true} />
            <YAxis dataKey="installsGrowth" yAxisId="yInstallsGrowth" hide={true} />
            <Tooltip labelFormatter={x => DayJS(x).format('MMMM YYYY')} formatter={(value, name, props) => { 
              if (name === 'installsGrowth') {
                if (value.toFixed) {
                  return [value.toFixed(2) + '%', "Installs Growth"]; 
                }
              }
              return [numberWithCommas(value), "Downloads"]; 
            }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

    </div>
  </div>);
}

export { PluginCard };