const cache = new Map();

function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function set(key, value, ttlMs) {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

function clear() {
  cache.clear();
}

module.exports = { get, set, clear };
