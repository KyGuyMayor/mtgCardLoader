const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../src/db');

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JWT_EXPIRY = '7d';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production';

exports.register = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const existingUser = await db('users').where({ email }).first();
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const [user] = await db('users')
      .insert({ email, password_hash })
      .returning(['id']);

    return res.status(201).json({ id: user.id });
  } catch (error) {
    console.error('Registration error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  try {
    const user = await db('users').where({ email }).first();
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    return res.status(200).json({ token });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.logout = (req, res) => {
  return res.status(200).json({ message: 'Logged out successfully' });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await db('users').where({ email }).first();
    if (!user) {
      // Return success even if user not found (don't leak email existence)
      return res.status(200).json({ message: 'If an account with that email exists, a reset link has been sent' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db('users').where({ id: user.id }).update({
      reset_token: tokenHash,
      reset_token_expires: resetExpires,
    });

    // MVP: log reset link to console (no email service)
    console.log(`\n=== PASSWORD RESET ===`);
    console.log(`Email: ${email}`);
    console.log(`Reset link: http://localhost:3000/reset-password?token=${resetToken}`);
    console.log(`Expires: ${resetExpires.toISOString()}`);
    console.log(`======================\n`);

    return res.status(200).json({ message: 'If an account with that email exists, a reset link has been sent' });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await db('users').where({ reset_token: tokenHash }).first();

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    await db('users').where({ id: user.id }).update({
      password_hash,
      reset_token: null,
      reset_token_expires: null,
    });

    return res.status(200).json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
