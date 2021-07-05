import Head from 'next/head';
import compareVersions from 'compare-versions';
import ago from 's-ago';
import { fetchActiveStats, fetchDownloadsStats, fetchPluginInfo, fetchWordPressVersion } from '../libs/requests';
import { decode } from 'html-entities';
import { PluginCard } from '../components/PluginCard';
import DayJS from 'dayjs';
var customParseFormat = require('dayjs/plugin/customParseFormat');
DayJS.extend(customParseFormat)

const ONE_DAY = 1000 * 60 * 60 * 24;
const ONE_WEEK = ONE_DAY * 7;

export default function Home(props) {
  const { plugins = [], wpVersion } = props;

  return (
    <>
      <Head>
        <title>Dash My Plugins</title>
        <meta name="description" content="Dashboard for WP Plugin Developers" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <h1>Dash My Plugins</h1>
      <p>The latest version of WordPress is {wpVersion}.</p>

      <main className="page">
        {plugins.map((x) => <PluginCard key={x.slug} data={x} wpVersion={wpVersion} />)}
      </main>

    </>
  )
}

export async function getStaticProps() {
  //const hubs = await loadHubs();
  //const blogPosts = await loadBlogPosts();
  let cfgPlugins = process.env.PLUGINS.split(',');
  let plugins = [];
  const wpVersion = await fetchWordPressVersion();
  for (let cfgPlugin of cfgPlugins) {
    const data = await fetchPluginInfo(cfgPlugin);
    const downloads = await fetchDownloadsStats(cfgPlugin);
    const activeInstalls = await fetchActiveStats(cfgPlugin);

    if (data.slug) {
      let { name, slug, version, tested, rating, num_ratings, ratings, tags, screenshots, banners,
        support_threads, support_threads_resolved, active_installs, last_updated } = data;
      last_updated = DayJS(last_updated.replace(' GMT', ''), 'YYYY-MM-DD h:mma').toDate().toString();
      const lastUpdated = new Date(last_updated);
      lastUpdated.setMinutes(lastUpdated.getMinutes() + lastUpdated.getTimezoneOffset() * -1);
      const msSinceRelease = (new Date() - lastUpdated);
      const pendingSupport = parseInt(support_threads) - parseInt(support_threads_resolved);

      const supportSlackScore = pendingSupport > 5 ? 2 : pendingSupport > 0 ? 1 : 0;
      const versionSlackScore = msSinceRelease > (ONE_WEEK * 4) ? 2 : (msSinceRelease > (ONE_WEEK * 2) ? 1 : 0);
      const testedSlackScore = !!compareVersions(wpVersion, data.tested.toString()) ? 2 : 0;
      const ratingSlackScore = rating > 92 ? 0 : (rating > 90 ? 1 : 2);

      plugins.push({
        name: decode(name),
        slug,
        tags,
        screenshots,
        banners,
        version: version,
        tested: tested,
        rating: parseInt(rating),
        ratings,
        num_ratings: parseInt(num_ratings),
        support_threads: pendingSupport,
        active_installs: parseInt(active_installs),
        downloads,
        activeInstalls,

        readableTime: ago(lastUpdated),

        versionSlackScore,
        testedSlackScore,
        ratingSlackScore,
        supportSlackScore,

        slackScore: supportSlackScore + versionSlackScore + testedSlackScore + ratingSlackScore

      });
    }
    else {
      console.log(`No data for ${cfgPlugin}.`);
    }
  }
  plugins.sort((a, b) => (a.slackScore > b.slackScore) ? -1 : 1);
  return { props: { plugins, wpVersion }, revalidate: 60 * 1 }
}