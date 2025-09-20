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