// Small in-memory rate limiter (no extra dependency). Good enough for a single
// server instance; use a shared store if you ever run several instances.
function rateLimit({ windowMs, max, message }) {
    const hits = new Map();

    const timer = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) {
                hits.delete(key);
            }
        }
    }, windowMs);
    timer.unref();

    return function limiter(req, res, next) {
        const key = req.ip;
        const now = Date.now();
        let entry = hits.get(key);

        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }

        entry.count += 1;
        if (entry.count > max) {
            res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
            return res.status(429).json({
                message: message || "Too many requests. Please try again later."
            });
        }

        return next();
    };
}

module.exports = { rateLimit };
