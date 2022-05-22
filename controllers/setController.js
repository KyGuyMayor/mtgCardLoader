const scry = require('scryfall-sdk');
const fuzzysort = require('fuzzysort');

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
      if (element.obj.set_type == 'expansion') {
        return element.obj;
      }
    }).filter((set) => {
      if (set) {
        return set;
      }
    });

    return results;
  });

  const set = await scry.Sets.byName(query,  true);

  return  res.send(set);
}

/**
 * Retrieves a set by a given uuid.
 * @param {object} req Express request object 
 * @param {object} res Express response object
 * @returns {json} JSON string of an array containing a ScryFall Set.
 */
exports.get = async (req, res) => {
  const set = await scry.Sets.byId(req.params.id);
  set.cards = await set.getCards()

  return res.send(set);
}

/**
 * Returns all sets 
 * @param {object} req Express request object
 * @param {object} res Express response object
 * @returns {json} JSON string of an array of scryFall set objects.
 */
exports.index = async (req, res) => {
  const sets = await scry.Sets.all();

  return res.send(sets);
}