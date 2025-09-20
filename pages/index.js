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
  // Fallback to empty array if PLUGINS is not defined (during build)
  const pluginsEnv = process.env.PLUGINS || '';
  let cfgPlugins = pluginsEnv ? pluginsEnv.split(',') : [];
  let plugins = [];
  const wpVersion = await fetchWordPressVersion();
  for (let cfgPlugin of cfgPlugins) {
    const data = await fetchPluginInfo(cfgPlugin.trim());
    const downloads = await fetchDownloadsStats(cfgPlugin);
    const activeInstalls = await fetchActiveStats(cfgPlugin);

    if (data?.slug) {
      let { name, slug, version, tested, rating, num_ratings, ratings, tags, screenshots, banners,
        support_threads, support_threads_resolved, active_installs, last_updated } = data;
      last_updated = DayJS(last_updated.replace(' GMT', ''), 'YYYY-MM-DD h:mma').toDate().toString();
      const lastUpdated = new Date(last_updated);
      lastUpdated.setMinutes(lastUpdated.getMinutes() + lastUpdated.getTimezoneOffset() * -1);
      const msSinceRelease = (new Date() - lastUpdated);
      const pendingSupport = parseInt(support_threads) - parseInt(support_threads_resolved);

      // Support: use percentage of unresolved tickets
      const unresolvedPercent = support_threads > 0 ? (pendingSupport / support_threads) * 100 : 0;
      const supportSlackScore = unresolvedPercent > 30 ? 2 : unresolvedPercent > 10 ? 1 : 0;

      // Version: 3 months for orange, 6 months for red
      const versionSlackScore = msSinceRelease > (ONE_WEEK * 26) ? 2 : (msSinceRelease > (ONE_WEEK * 12) ? 1 : 0);

      // WordPress compatibility: check if 1 or 2+ major versions behind
      let testedSlackScore = 0;
      if (wpVersion && data.tested) {
        const wpParts = wpVersion.split('.');
        const testedParts = data.tested.toString().split('.');
        const wpMajor = parseInt(wpParts[0]);
        const wpMinor = parseInt(wpParts[1] || 0);
        const testedMajor = parseInt(testedParts[0]);
        const testedMinor = parseInt(testedParts[1] || 0);

        // Compare major.minor versions
        if (wpMajor > testedMajor) {
          const majorDiff = wpMajor - testedMajor;
          testedSlackScore = majorDiff >= 2 ? 2 : 1;
        } else if (wpMajor === testedMajor && wpMinor - testedMinor >= 2) {
          testedSlackScore = 1; // Consider 2+ minor versions as warning
        }
      }

      // Rating: 85+ green, 75-85 orange, <75 red
      const ratingSlackScore = rating >= 85 ? 0 : (rating >= 75 ? 1 : 2);

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