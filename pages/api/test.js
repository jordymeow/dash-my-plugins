const WP_API = 'https://api.wordpress.org';

export default async function handler(req, res) {
  const testSlug = req.query.slug || 'media-cleaner';
  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      PLUGINS: process.env.PLUGINS || 'NOT SET',
      SITE_NAME: process.env.SITE_NAME || 'NOT SET',
      NODE_ENV: process.env.NODE_ENV
    },
    tests: {}
  };

  // Test WordPress version
  try {
    const wpRes = await fetch(`${WP_API}/core/version-check/1.7/`);
    const wpData = await wpRes.json();
    results.tests.wordpressVersion = {
      success: true,
      version: wpData.offers?.[0]?.version || 'Unknown',
      status: wpRes.status
    };
  } catch (err) {
    results.tests.wordpressVersion = {
      success: false,
      error: err.message,
      stack: err.stack
    };
  }

  // Test plugin info
  try {
    const pluginRes = await fetch(`${WP_API}/plugins/info/1.2/?action=plugin_information&request[slug]=${testSlug}`);
    const pluginData = await pluginRes.json();
    results.tests.pluginInfo = {
      success: true,
      slug: pluginData.slug,
      name: pluginData.name,
      version: pluginData.version,
      status: pluginRes.status
    };
  } catch (err) {
    results.tests.pluginInfo = {
      success: false,
      error: err.message,
      stack: err.stack
    };
  }

  // Test downloads stats
  try {
    const dlRes = await fetch(`${WP_API}/stats/plugin/1.0/downloads.php?slug=${testSlug}&limit=10`);
    const dlData = await dlRes.json();
    results.tests.downloadStats = {
      success: true,
      dataPoints: Object.keys(dlData).length,
      status: dlRes.status
    };
  } catch (err) {
    results.tests.downloadStats = {
      success: false,
      error: err.message,
      stack: err.stack
    };
  }

  // Test active installs
  try {
    const aiRes = await fetch(`${WP_API}/stats/plugin/1.0/active-installs.php?slug=${testSlug}&limit=10`);
    const aiData = await aiRes.json();
    results.tests.activeInstalls = {
      success: true,
      dataPoints: Object.keys(aiData).length,
      status: aiRes.status
    };
  } catch (err) {
    results.tests.activeInstalls = {
      success: false,
      error: err.message,
      stack: err.stack
    };
  }

  res.status(200).json(results);
}
