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

    it('reutrns 404 not found when given an invalid scryfall card id', async () => {
      scry.Cards.byId = jest.fn().mockRejectedValue(new Error('not found'));

      const req = { params: { id: '1' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };

      await cardController.get(req, res);

      expect(res.status).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Not Found');
    })
  });
});
