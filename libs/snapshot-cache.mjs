export const CACHE_TTL = 15 * 60 * 1000;
const RETRY_DELAY = 60 * 1000;
// Shared in-flight requests, persistent last-good data, and a retry cooldown.
// Failed refreshes never replace a complete snapshot or advance its timestamp.
export function createSnapshotCache({ load, read, write, now = Date.now, ttl = CACHE_TTL }) {
  let cached, pending, initialized = false, retryAt = 0;
  async function update() {
    if (!initialized) {
      initialized = true;
      try {
        const saved = await read();
        if (Array.isArray(saved?.plugins) && Number.isFinite(Date.parse(saved.fetchedAt))) cached = saved;
      } catch { /* First run or an unwritable/ephemeral filesystem. */ }
    }
    if (cached && now() - Date.parse(cached.fetchedAt) < ttl) return { ...cached, stale: false };
    if (cached && now() < retryAt) return { ...cached, stale: true };
    try {
      const fresh = await load();
      cached = fresh;
      retryAt = 0;
      try { await write(fresh); } catch { /* Memory caching still works. */ }
      return { ...fresh, stale: false };
    } catch (error) {
      retryAt = now() + RETRY_DELAY;
      if (cached) return { ...cached, stale: true };
      throw error;
    }
  }
  return () => {
    if (!pending) pending = update().finally(() => { pending = null; });
    return pending;
  };
}
