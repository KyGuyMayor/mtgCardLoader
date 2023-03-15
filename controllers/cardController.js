const { rest } = require('lodash');
const scry = require('scryfall-sdk');

exports.index = async (req, res) => {
    const query = req.query.name ? 'name:' + req.query.name : 'name:aa';
    const page = req.query.page ? req.query.page : 1;

    const cards = await scry.Cards.search(query, page).cancelAfterPage().waitForAll();

    return res.send(cards);
};

exports.get = async (req, res) => {
    const card = await scry.Cards.byId(req.params.id);

    res.send(card);
};

exports.find = (req, res) => {
    const cards = [];

    scry.Cards.search('name:' + req.params.query).on('data', card => {
        cards.push(card);
    })
    .on('done', () => {
        return res.send(JSON.stringify(cards));
    });
};
