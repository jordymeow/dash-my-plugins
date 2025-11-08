import https from 'https';

const WP_API = 'https://api.wordpress.org';

// Use native https module instead of fetch (works better in Alpine Docker)
const fetchWithHttps = (url) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout after 30s'));
    }, 30000);

    https.get(url, {
      family: 4, // Force IPv4 only
      headers: {
        'User-Agent': 'dash-my-plugins/1.0'
      },
      timeout: 30000
    }, (res) => {
      clearTimeout(timeout);

      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(new Error('Failed to parse JSON: ' + err.message));
        }
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    }).on('timeout', () => {
      clearTimeout(timeout);
      reject(new Error('Request timeout'));
    });
  });
};

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
    const wpData = await fetchWithHttps(`${WP_API}/core/version-check/1.7/`);
    results.tests.wordpressVersion = {
      success: true,
      version: wpData.offers?.[0]?.version || 'Unknown'
    };
  } catch (err) {
    results.tests.wordpressVersion = {
      success: false,
      error: err.message,
      cause: err.cause?.message || err.cause?.code || 'Unknown',
      stack: err.stack
    };
  }

  // Test plugin info
  try {
    const pluginData = await fetchWithHttps(`${WP_API}/plugins/info/1.2/?action=plugin_information&request[slug]=${testSlug}`);
    results.tests.pluginInfo = {
      success: true,
      slug: pluginData.slug,
      name: pluginData.name,
      version: pluginData.version
    };
  } catch (err) {
    results.tests.pluginInfo = {
      success: false,
      error: err.message,
      cause: err.cause?.message || err.cause?.code || 'Unknown',
      causeDetails: err.cause,
      stack: err.stack
    };
  }

  // Test downloads stats
  try {
    const dlData = await fetchWithHttps(`${WP_API}/stats/plugin/1.0/downloads.php?slug=${testSlug}&limit=10`);
    results.tests.downloadStats = {
      success: true,
      dataPoints: Object.keys(dlData).length
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
    const aiData = await fetchWithHttps(`${WP_API}/stats/plugin/1.0/active-installs.php?slug=${testSlug}&limit=10`);
    results.tests.activeInstalls = {
      success: true,
      dataPoints: Object.keys(aiData).length
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
