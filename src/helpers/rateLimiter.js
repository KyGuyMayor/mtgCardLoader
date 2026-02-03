/**
 * Rate limiter for Scryfall API calls.
 * Ensures minimum delay between requests to comply with Scryfall's rate limit policy
 * (50-100ms between requests).
 * 
 * @module rateLimiter
 */

const RATE_LIMIT_DELAY = 100; // 100ms between requests (upper bound of Scryfall recommendation)
const REQUEST_TIMEOUT = 30000; // 30 seconds timeout

let lastRequestTime = 0;
let queue = [];
let isProcessing = false;

/**
 * Checks if debug logging is enabled.
 * @returns {boolean} - True if RATE_LIMIT_DEBUG is set to 'true'
 * @private
 */
function isDebugEnabled() {
  return process.env.RATE_LIMIT_DEBUG === 'true';
}

/**
 * Logs a rate limiter debug message if debug is enabled.
 * @param {string} message - The message to log
 * @private
 */
function debugLog(message) {
  if (isDebugEnabled()) {
    console.log(`[RateLimiter] ${message}`);
  }
}

/**
 * Custom error class for timeout errors.
 */
class RateLimitTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitTimeoutError';
    this.statusCode = 503;
  }
}

/**
 * Wraps a promise with a timeout.
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} - Promise that rejects if timeout is exceeded
 * @private
 */
function withTimeout(promise, ms) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new RateLimitTimeoutError(
        `Request timed out after ${ms}ms. This may be due to rate limiting or high server load.`
      ));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

/**
 * Processes the next item in the queue.
 * @private
 */
async function processQueue() {
  if (isProcessing || queue.length === 0) {
    return;
  }

  isProcessing = true;

  while (queue.length > 0) {
    const { asyncFn, resolve, reject, queuePosition } = queue.shift();

    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    const waitTime = Math.max(0, RATE_LIMIT_DELAY - timeSinceLastRequest);

    if (waitTime > 0) {
      debugLog(`Delaying request (position ${queuePosition}) for ${waitTime}ms to respect rate limit`);
      await new Promise(r => setTimeout(r, waitTime));
    }

    lastRequestTime = Date.now();

    try {
      const result = await withTimeout(asyncFn(), REQUEST_TIMEOUT);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  }

  isProcessing = false;
}

/**
 * Executes an async function with rate limiting and timeout.
 * Queues the request and ensures minimum delay between Scryfall API calls.
 * 
 * @param {Function} asyncFn - Async function that makes the Scryfall API call
 * @returns {Promise<*>} - Promise that resolves with the result of asyncFn
 * @throws {RateLimitTimeoutError} - If request exceeds 30 second timeout
 * 
 * @example
 * const card = await rateLimitedRequest(() => scry.Cards.byId(id));
 * 
 * @example
 * const cards = await rateLimitedRequest(() => scry.Cards.search(query).waitForAll());
 */
function rateLimitedRequest(asyncFn) {
  return new Promise((resolve, reject) => {
    const pendingCount = queue.length;
    const queuePosition = pendingCount + 1;
    
    // Only log when request is queued behind other requests
    if (pendingCount > 0) {
      const estimatedWaitTime = pendingCount * RATE_LIMIT_DELAY;
      debugLog(`Request queued at position ${queuePosition}, ${pendingCount} request(s) ahead, estimated wait: ${estimatedWaitTime}ms`);
    }
    
    queue.push({ asyncFn, resolve, reject, queuePosition });
    processQueue();
  });
}

/**
 * Gets the current queue length for monitoring purposes.
 * @returns {number} - Number of pending requests in the queue
 */
function getQueueLength() {
  return queue.length;
}

/**
 * Resets the rate limiter state (primarily for testing).
 */
function reset() {
  lastRequestTime = 0;
  queue = [];
  isProcessing = false;
}

module.exports = {
  rateLimitedRequest,
  getQueueLength,
  reset,
  RateLimitTimeoutError,
  RATE_LIMIT_DELAY,
  REQUEST_TIMEOUT
};
