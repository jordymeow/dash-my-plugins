import Image from 'next/image';
import DayJS from 'dayjs';
import { Icon } from '@iconify/react';
import alertIcon from '@iconify/icons-mdi/alert';
import alertOctagon from '@iconify/icons-mdi/alert-octagon';
import accountCircle from '@iconify/icons-mdi/account-circle';
import { ResponsiveContainer, ReferenceLine, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip } from 'recharts';

import css from '../styles/Card.module.css'

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const PluginCard = ({ data, wpVersion }) => {
  const finalData = [];
  for (let c = 0; c < data.downloads.length; c++) {
    finalData.push({
      date: data?.downloads[c].date,
      downloads: data?.downloads[c].value,
      installsGrowth: data?.activeInstalls ? data?.activeInstalls[c]?.value : null,
    });
  }

  const slackClass = (score) => {
    return score === 1 ? css.orangeFont : score === 2 ? css.redFont : css.greenFont;
  }

  const slackIcon = (score) => {
    return <>
      {score === 1 && <Icon icon={alertIcon} style={{ marginLeft: 3 }} color={'var(--orange)'} />}
      {score === 2 && <Icon icon={alertOctagon} style={{ marginLeft: 3 }} color={'var(--red)'} />}
    </>;
  }

  //console.log(data.banners.high);

  // Add status class based on slack score
  const cardStatusClass = data.slackScore >= 6 ? css.cardCritical :
                          data.slackScore >= 2 ? css.cardWarning :
                          css.card;

  return (<div key={data.slug} className={cardStatusClass}>
    <div className={css.banner}><Image src={data.banners.high} alt={data.slug} width={280} height={240} /></div>
    <a className={css.cardTitle} title={`Slack Score: ${data.slackScore}`} 
      href={`https://wordpress.org/plugins/${data.slug}/`} rel="noreferrer" target="_blank">
      <h2>
        {data.name}
      </h2>
      <small>
        {numberWithCommas(data.active_installs)}
        <Icon icon={accountCircle} width={18} style={{ position: 'relative', top: 4, marginLeft: 4, marginTop: 0 }} /> 
      </small>
    </a>
    <div className={css.content}>
      
      <div className={css.attributes}>

        <div className={css.attribute}>
          <div className={slackClass(data.versionSlackScore)}>{data.version}{slackIcon(data.versionSlackScore)}</div>
          <small>{data.readableTime}</small>
        </div>

        <div className={css.attribute}>
          <div className={slackClass(data.testedSlackScore)}>{data.tested}{slackIcon(data.testedSlackScore)}</div>
          <small>WordPress</small>
        </div>

        <div className={css.attribute}>
          <a href={`https://wordpress.org/support/plugin/${data.slug}/`} rel="noreferrer" target="_blank">
            <div className={slackClass(data.supportSlackScore)}>
              {!data.support_threads ? '0' : data.support_threads}{slackIcon(data.supportSlackScore)}
            </div>
          </a>
          <small>Support</small>
        </div>

        <div className={css.attribute}>
          <a href={`https://wordpress.org/support/plugin/${data.slug}/reviews/`} rel="noreferrer" target="_blank">
            <div className={slackClass(data.ratingSlackScore)}>
              {data.rating}
              <small style={{ color: '#d2d2d2' }}> / 100</small>
            </div>
          </a>
          <small>Rating</small>
        </div>

      </div>

      <div style={{ display: 'flex', height: 100, width: '100%', marginTop: 15, marginBottom: -15 }}>
        <ResponsiveContainer>
          <ComposedChart data={finalData} margin={{ top: 10, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`downloadsGradient-${data.slug}`} x1="0" y1="0" x2="0" y2="100%" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="var(--blue)" stopOpacity={0.8} />
                <stop offset="0.95" stopColor="var(--blue)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id={`installsGradient-${data.slug}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="var(--purple)" stopOpacity={0.8} />
                <stop offset="1" stopColor="var(--orange)" stopOpacity={0.8} />
              </linearGradient>
            </defs>
            <Bar dataKey="downloads" yAxisId="yDownloads"
              fill={`url(#downloadsGradient-${data.slug})`}
              radius={[4, 4, 0, 0]}
              strokeWidth={0} isAnimationActive={false} />
            <Line dataKey="installsGrowth" yAxisId="yInstallsGrowth"
              stroke={`url(#installsGradient-${data.slug})`}
              strokeWidth={3} dot={false} />
            <XAxis dataKey="date" hide={false} interval={'preserveStart'}
              tickFormatter={x => DayJS(x).format('MMM')}
              tick={{ fontSize: 10, fill: 'var(--gray)' }}
              axisLine={{ stroke: 'var(--gray)', strokeOpacity: 0.2 }}
              tickLine={false} />
            <ReferenceLine y={0} yAxisId="yInstallsGrowth"
              stroke="var(--gray)" strokeOpacity={0.3} strokeDasharray="3 3" />
            <YAxis dataKey="downloads" yAxisId="yDownloads" hide={true} />
            <YAxis dataKey="installsGrowth" yAxisId="yInstallsGrowth" hide={true} />
            <Tooltip
              labelFormatter={x => DayJS(x).format('MMMM YYYY')}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid var(--gray)',
                borderRadius: '8px',
                fontSize: '12px'
              }}
              formatter={(value, name, props) => {
                if (name === 'installsGrowth') {
                  if (value && value.toFixed) {
                    const color = value >= 0 ? 'var(--green)' : 'var(--red)';
                    return [
                      <span key="growth" style={{ color }}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>,
                      "Growth"
                    ];
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