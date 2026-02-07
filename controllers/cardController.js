const scry = require('scryfall-sdk');
const { rateLimitedRequest, RateLimitTimeoutError } = require('../src/helpers/rateLimiter');
const https = require('https');
const ttlCache = require('../src/helpers/ttlCache');

const keepAliveAgent = new https.Agent({ keepAlive: true });

/**
 * Handles timeout errors by returning 503 status.
 * @param {Error} error - The error to handle
 * @param {object} res - Express response object
 * @returns {boolean} - True if error was handled, false otherwise
 */
function handleTimeoutError(error, res) {
  if (error instanceof RateLimitTimeoutError) {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: error.message
    });
  }
  return false;
}

exports.index = async (req, res) => {
  const query = req.query.name ? 'name:' + req.query.name : 'name:aa';
  const page = req.query.page ? req.query.page : 1;

  try {
    const cards = await rateLimitedRequest(() => 
      scry.Cards.search(query, page).cancelAfterPage().waitForAll()
    );

    return res.send(cards);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    return res.status(500).json({ error: 'Internal Server Error', message: e.message });
  }
};

exports.get = async (req, res) => {
  try {
    const cacheKey = `card:${req.params.id}`;
    const cached = ttlCache.get(cacheKey);
    if (cached) {
      res.set('Cache-Control', 'public, max-age=3600');
      return res.send(cached);
    }

    const card = await rateLimitedRequest(() => scry.Cards.byId(req.params.id));

    ttlCache.set(cacheKey, card, 3600000);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(card);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    return res.status(404).send('Not Found');
  }
};

exports.find = async (req, res) => {
  try {
    const cards = await rateLimitedRequest(() => 
      scry.Cards.search('name:' + req.params.query).cancelAfterPage().waitForAll()
    );

    res.set('Cache-Control', 'public, max-age=300');
    return res.json(cards);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    return res.status(500).json({ error: 'Internal Server Error', message: e.message });
  }
};

exports.random = async (req, res) => {
  try {
    const card = await rateLimitedRequest(() => scry.Cards.random());

    return res.send(card);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    return res.status(500).json({ error: 'Internal Server Error', message: e.message });
  }
};

exports.collection = async (req, res) => {
  const { identifiers } = req.body;

  if (!Array.isArray(identifiers) || identifiers.length === 0) {
    return res.status(400).json({ error: 'identifiers array is required' });
  }

  if (identifiers.length > 75) {
    return res.status(400).json({ error: 'Maximum 75 identifiers per request' });
  }

  try {
    const data = await rateLimitedRequest(() => {
      return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ identifiers });
        const options = {
          hostname: 'api.scryfall.com',
          path: '/cards/collection',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Accept': 'application/json',
            'User-Agent': 'MTGCardLoader/1.0',
          },
          agent: keepAliveAgent,
        };

        const request = https.request(options, (response) => {
          let body = '';
          response.on('data', (chunk) => { body += chunk; });
          response.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(new Error('Failed to parse Scryfall response'));
            }
          });
        });

        request.on('error', reject);
        request.write(postData);
        request.end();
      });
    });

    return res.json(data);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    return res.status(500).json({ error: 'Internal Server Error', message: e.message });
  }
};
