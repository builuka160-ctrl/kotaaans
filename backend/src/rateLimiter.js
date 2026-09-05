/** Small in-memory rate limiter, no extra dependency needed for a single-shop API. */
function rateLimiter({ windowMs, max }) {
  const hits = new Map();

  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      return res.status(429).json({ error: "too_many_requests" });
    }
    next();
  };
}

module.exports = rateLimiter;
