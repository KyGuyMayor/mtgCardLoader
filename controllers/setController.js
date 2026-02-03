const scry = require('scryfall-sdk');
const fuzzysort = require('fuzzysort');
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

/**
 * Retrieves sets that match a given search parameter.
 * @param {object} req Express request object 
 * @param {object} res Express response object 
 * @returns {json} JSON string of an array of scryFall set objects.
 */
exports.find = async (req, res) => {
  const query = req.params.query;

  scry.setFuzzySearch((search, targts, key) => {
    results = fuzzysort.go(search, targts, { key }).map((element) => {
      if (element.obj.set_type == 'expansion' || element.obj.set_type == "masters" || element.obj.set_type == "core") {
        console.log(element);
        return element.obj;
      }
    }).filter((set) => {
      if (set) {
        return set;
      }
    });

    return results;
  });

  try {
    const set = await rateLimitedRequest(() => scry.Sets.byName(query, true));

    return res.send(set);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    return res.status(500).json({ error: 'Internal Server Error', message: e.message });
  }
}

/**
 * Retrieves a set by a given uuid.
 * @param {object} req Express request object 
 * @param {object} res Express response object
 * @returns {json} JSON string of an array containing a ScryFall Set.
 */
exports.get = async (req, res) => {
  try {
    const set = await rateLimitedRequest(() => scry.Sets.byId(req.params.id));
    set.cards = await rateLimitedRequest(() => set.getCards());

    return res.send(set);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    return res.status(500).json({ error: 'Internal Server Error', message: e.message });
  }
}

/**
 * Returns all sets 
 * @param {object} req Express request object
 * @param {object} res Express response object
 * @returns {json} JSON string of an array of scryFall set objects.
 */
exports.index = async (req, res) => {
  try {
    const sets = await rateLimitedRequest(() => scry.Sets.all());

    return res.send(sets);
  } catch (e) {
    if (handleTimeoutError(e, res)) return;
    return res.status(500).json({ error: 'Internal Server Error', message: e.message });
  }
}
