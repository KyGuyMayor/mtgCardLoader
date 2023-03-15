const scry = require('scryfall-sdk');
const cardController = require('../cardController');

describe('CardController', () => {
  describe('get', () => {
    it('should call scry.Cards.byId with the given id', async () => {
      scry.Cards.byId = jest.fn(() => {
        Promise.resolve();
      });

      const req = { params: { id: 'abcd12345' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };

      const card = await cardController.get(req, res);

      expect(scry.Cards.byId).toHaveBeenCalledTimes(1);
      expect(scry.Cards.byId).toHaveBeenCalledWith(req.params.id);
      expect(res.send).toHaveBeenCalledTimes(1);
    });
  });
});