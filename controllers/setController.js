const scry = require('scryfall-sdk');
const fuzzysort = require('fuzzysort');

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

exports.get = async (req, res) => {
  const set = await scry.Sets.byId(req.params.id);
  set.cards = await set.getCards()

  res.send(set);
}

exports.index = async (req, res) => {
  const sets = await scry.Sets.all();

  res.send(sets);
}