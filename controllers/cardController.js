const mtg = require('mtgsdk');

exports.index = (req, res) => {
    const page = req.query.page ? req.query.page : 1;
    mtg.card.where({ page: page, pageSize: 50 }).then(cards => {
        res.send(cards);
    })
};

exports.get = (req, res) => {
    mtg.card.find(req.params.id).then(result => {
        res.send(result);
    });
};

exports.find = (req, res) => {
    mtg.card.all({ name: req.params.query}).on('data', card => {
        res.send(card);
    });
};
