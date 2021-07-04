import Head from 'next/head'
import { fetchActiveStats, fetchDownloadsStats, fetchPluginInfo, fetchWordPressVersion } from '../libs/requests';
import { decode } from 'html-entities';
import { PluginCard } from '../components/PluginCard';

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
      last_updated = last_updated?.split(' ')[0];
      last_updated = last_updated ? (new Date(last_updated)).toString() : null;
      plugins.push({
        name: decode(name),
        slug,
        tags,
        screenshots,
        banners,
        version: parseFloat(version),
        tested: parseFloat(tested),
        rating: parseInt(rating),
        ratings,
        num_ratings: parseInt(num_ratings),
        support_threads: parseInt(support_threads) - parseInt(support_threads_resolved),
        active_installs: parseInt(active_installs),
        last_updated,
        downloads,
        activeInstalls
      });
    }
    else {
      console.log(`No data for ${cfgPlugin}.`);
    }
  }
  return { props: { plugins, wpVersion }, revalidate: 60 * 1 }
}