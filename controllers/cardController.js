const scry = require('scryfall-sdk');
const { rateLimitedRequest, RateLimitTimeoutError } = require('../src/helpers/rateLimiter');

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
    const card = await rateLimitedRequest(() => scry.Cards.byId(req.params.id));

    res.send(card);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    return res.status(404).send('Not Found');
  }
};

exports.find = async (req, res) => {
  try {
    const cards = await rateLimitedRequest(() => 
      scry.Cards.search('name:' + req.params.query).waitForAll()
    );

    return res.send(JSON.stringify(cards));
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
