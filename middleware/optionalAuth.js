const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production';

/**
 * Optional authentication middleware.
 * Extracts and validates JWT if present, but does NOT return 401 if missing.
 * Allows both authenticated and unauthenticated access.
 * Attaches req.user if token is valid, otherwise leaves it undefined.
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided - that's OK for optional auth
    req.user = null;
    return next();
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (error) {
    // Token is invalid or expired - that's OK for optional auth
    req.user = null;
    next();
  }
};

module.exports = optionalAuth;
