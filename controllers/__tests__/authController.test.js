const bcrypt = require('bcrypt');
const authController = require('../authController');

jest.mock('bcrypt');
jest.mock('../../src/db', () => {
  const mockDb = jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn()
  });
  return mockDb;
});

const db = require('../../src/db');

describe('AuthController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  describe('register', () => {
    it('returns 400 if email is missing', async () => {
      req.body = { password: 'password123' };

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email and password are required' });
    });

    it('returns 400 if password is missing', async () => {
      req.body = { email: 'test@example.com' };

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email and password are required' });
    });

    it('returns 400 for invalid email format', async () => {
      req.body = { email: 'invalid-email', password: 'password123' };

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email format' });
    });

    it('returns 400 if email already exists', async () => {
      req.body = { email: 'existing@example.com', password: 'password123' };
      
      const mockFirst = jest.fn().mockResolvedValue({ id: 1, email: 'existing@example.com' });
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst });
      db.mockReturnValue({ where: mockWhere });

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email already exists' });
    });

    it('returns 201 with user id on successful registration', async () => {
      req.body = { email: 'new@example.com', password: 'password123' };
      
      const mockFirst = jest.fn().mockResolvedValue(null);
      const mockWhere = jest.fn().mockReturnValue({ first: mockFirst });
      const mockReturning = jest.fn().mockResolvedValue([{ id: 42 }]);
      const mockInsert = jest.fn().mockReturnValue({ returning: mockReturning });
      
      db.mockReturnValueOnce({ where: mockWhere });
      db.mockReturnValueOnce({ insert: mockInsert });
      
      bcrypt.hash.mockResolvedValue('hashed_password');

      await authController.register(req, res);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: 42 });
    });
  });
});
