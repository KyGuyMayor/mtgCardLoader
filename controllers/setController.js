const scry = require('scryfall-sdk');
const fuzzysort = require('fuzzysort');

exports.search = async (req, res) => {
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
