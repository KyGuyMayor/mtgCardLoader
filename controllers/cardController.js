const scry = require('scryfall-sdk');
const { rateLimitedRequest, RateLimitTimeoutError } = require('../src/helpers/rateLimiter');
const https = require('https');
const ttlCache = require('../src/helpers/ttlCache');

const keepAliveAgent = new https.Agent({ keepAlive: true });

const CACHE_TTL_MS = 3600000;
const CACHE_MAX_AGE_HEADER = 'public, max-age=3600';

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

exports.rulings = async (req, res) => {
  const { id } = req.params;

  const cacheKey = `rulings:${id}`;
  const cached = ttlCache.get(cacheKey);
  if (cached) {
    res.set('Cache-Control', CACHE_MAX_AGE_HEADER);
    return res.json(cached);
  }

  try {
    const data = await rateLimitedRequest(() => {
      return new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.scryfall.com',
          path: `/cards/${encodeURIComponent(id)}/rulings`,
          method: 'GET',
          headers: {
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
              const parsed = JSON.parse(body);
              if (response.statusCode === 404 || parsed.status === 404) {
                reject({ statusCode: 404 });
              } else {
                resolve(parsed);
              }
            } catch (err) {
              reject(new Error('Failed to parse Scryfall response'));
            }
          });
        });

        request.on('error', reject);
        request.end();
      });
    });

    const rulings = data.data || [];
    ttlCache.set(cacheKey, rulings, CACHE_TTL_MS);
    res.set('Cache-Control', CACHE_MAX_AGE_HEADER);
    return res.json(rulings);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    if (e.statusCode === 404) {
      return res.status(404).json({ error: 'Not Found', message: 'Card not found' });
    }
    return res.status(500).json({ error: 'Internal Server Error', message: e.message });
  }
};

exports.named = async (req, res) => {
  const { exact, fuzzy } = req.query;

  if (!exact && !fuzzy) {
    return res.status(400).json({ error: 'Bad Request', message: 'Query param exact or fuzzy is required' });
  }

  const mode = exact ? 'exact' : 'fuzzy';
  const name = exact || fuzzy;
  const cacheKey = `named:${mode}:${name.toLowerCase()}`;
  const cached = ttlCache.get(cacheKey);
  if (cached) {
    res.set('Cache-Control', CACHE_MAX_AGE_HEADER);
    return res.json(cached);
  }

  try {
    const data = await rateLimitedRequest(() => {
      return new Promise((resolve, reject) => {
        const queryParam = `${mode}=${encodeURIComponent(name)}`;
        const options = {
          hostname: 'api.scryfall.com',
          path: `/cards/named?${queryParam}`,
          method: 'GET',
          headers: {
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
              const parsed = JSON.parse(body);
              if (response.statusCode === 404 || parsed.status === 404) {
                reject({ statusCode: 404 });
              } else {
                resolve(parsed);
              }
            } catch (err) {
              reject(new Error('Failed to parse Scryfall response'));
            }
          });
        });

        request.on('error', reject);
        request.end();
      });
    });

    ttlCache.set(cacheKey, data, CACHE_TTL_MS);
    res.set('Cache-Control', CACHE_MAX_AGE_HEADER);
    return res.json(data);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    if (e.statusCode === 404) {
      return res.status(404).json({ error: 'Not Found', message: 'No card found matching that name' });
    }
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

/**
 * Get all printings of a card (proxies Scryfall printings endpoint).
 * Fetches the card first to get prints_search_uri, then paginates through all printings.
 */
exports.printings = async (req, res) => {
  const { id } = req.params;

  const cacheKey = `printings:${id}`;
  const cached = ttlCache.get(cacheKey);
  if (cached) {
    res.set('Cache-Control', CACHE_MAX_AGE_HEADER);
    return res.json(cached);
  }

  try {
    // Fetch card to get prints_search_uri
    const card = await rateLimitedRequest(() => scry.Cards.byId(id));

    if (!card) {
      return res.status(404).json({ error: 'Not Found', message: 'Card not found' });
    }

    let allPrintings = [];
    let nextPage = card.prints_search_uri;

    // Paginate through all printings
    while (nextPage) {
      const data = await rateLimitedRequest(() => {
        return new Promise((resolve, reject) => {
          const options = {
            hostname: 'api.scryfall.com',
            path: new URL(nextPage).pathname + new URL(nextPage).search,
            method: 'GET',
            headers: {
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
          request.end();
        });
      });

      // Simplify each printing to essential fields
      const simplified = (data.data || []).map(card => ({
        id: card.id,
        name: card.name,
        set: card.set,
        set_name: card.set_name,
        collector_number: card.collector_number,
        image_uris: card.image_uris || (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris),
        prices: card.prices,
        finishes: card.finishes,
        rarity: card.rarity,
        released_at: card.released_at,
      }));

      allPrintings = allPrintings.concat(simplified);

      // Check if there's another page
      if (data.has_more && data.next_page) {
        nextPage = data.next_page;
      } else {
        nextPage = null;
      }
    }

    // Sort by released_at descending (newest first)
    allPrintings.sort((a, b) => {
      const dateA = new Date(a.released_at || '1970-01-01').getTime();
      const dateB = new Date(b.released_at || '1970-01-01').getTime();
      return dateB - dateA;
    });

    // Cache and return
    ttlCache.set(cacheKey, allPrintings, CACHE_TTL_MS);
    res.set('Cache-Control', CACHE_MAX_AGE_HEADER);
    return res.json(allPrintings);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    if (e.statusCode === 404) {
      return res.status(404).json({ error: 'Not Found', message: 'Card not found' });
    }
    return res.status(500).json({ error: 'Internal Server Error', message: e.message });
  }
};
