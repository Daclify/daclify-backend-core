export const SPONSORED_WRITES_PER_WINDOW = 60;
export const SPONSORED_WINDOW_MS = 60_000;
export const SPONSORED_GLOBAL_PER_WINDOW = 600;
export const RESOURCE_CPU_FLOOR_USEC = 1_000;
export const RESOURCE_NET_FLOOR_BYTES = 512;
export const RESOURCE_RAM_FLOOR_BYTES = 1_024;

export function createWindowLimiter(
  limit: number,
  windowMs: number,
  globalLimit = limit,
  sharedKeys: readonly string[] = [],
) {
  const shared = new Set(sharedKeys);
  const hits = new Map<string, number[]>();
  const all: number[] = [];
  let pruneAt = 0;
  return function admit(key: string, now: number): boolean {
    const start = now - windowMs;
    if (now >= pruneAt) {
      for (const [subject, times] of hits) {
        const recent = times.filter((time) => time > start);
        if (recent.length) hits.set(subject, recent);
        else hits.delete(subject);
      }
      pruneAt = now + windowMs;
    }
    while (all.length > 0 && all[0] !== undefined && all[0] <= start) all.shift();
    const recent = (hits.get(key) ?? []).filter((time) => time > start);
    if (recent.length >= (shared.has(key) ? globalLimit : limit) || all.length >= globalLimit) {
      return false;
    }
    recent.push(now);
    all.push(now);
    hits.set(key, recent);
    return true;
  };
}
