/**
 * Rate limiter de login en memoria, claveado por IP + email.
 * Ventana fija de 60 s, máximo 5 intentos (design.md decisión 5).
 */
export function createLoginRateLimiter({
  maxAttempts = 5,
  windowMs = 60_000,
  now = Date.now,
} = {}) {
  const buckets = new Map(); // key -> { count, start }

  function currentBucket(key) {
    const entry = buckets.get(key);
    if (!entry) return null;
    if (now() - entry.start >= windowMs) {
      buckets.delete(key);
      return null;
    }
    return entry;
  }

  return {
    isBlocked(key) {
      const entry = currentBucket(key);
      return entry !== null && entry.count >= maxAttempts;
    },

    register(key) {
      const entry = currentBucket(key);
      if (entry) {
        entry.count += 1;
      } else {
        buckets.set(key, { count: 1, start: now() });
      }
    },

    reset() {
      buckets.clear();
    },
  };
}
