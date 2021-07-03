import compareVersions from 'compare-versions';
import Image from 'next/image';
import { Icon } from '@iconify/react';
import alertIcon from '@iconify/icons-mdi/alert';
import accountCircle from '@iconify/icons-mdi/account-circle';

import ago from 's-ago';
import css from '../styles/Card.module.css'

function numberWithCommas(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const PluginCard = ({ data, wpVersion }) => {
  const readableTime = ago(new Date(data.last_updated));
  const isOutdated = compareVersions(wpVersion, data.tested.toString());
  const needsPush = (new Date() - new Date(data.last_updated)) > (1000 * 60 * 60 * 24 * 7 * 3);

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

    </div>
  </div>);
}

export { PluginCard };