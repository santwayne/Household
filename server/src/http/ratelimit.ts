import type { FastifyInstance } from 'fastify';

/** Small in-memory sliding-window limiter per IP and bucket. Enough for one server; use a shared store (Redis) if you scale out. */
export function registerRateLimit(app: FastifyInstance, limits: { auth: number; api: number; windowMs: number } = { auth: 20, api: 300, windowMs: 60_000 }) {
  const hits = new Map<string, number[]>();
  app.addHook('onRequest', async (req, reply) => {
    const bucket = req.url.startsWith('/auth') ? 'auth' : req.url.startsWith('/api') || req.url.startsWith('/admin') ? 'api' : null;
    if (!bucket) return;
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter(t => now - t < limits.windowMs);
    arr.push(now); hits.set(key, arr);
    if (arr.length > limits[bucket]) { reply.header('retry-after', String(Math.ceil(limits.windowMs / 1000))); return reply.code(429).send({ error: 'too_many_requests' }); }
  });
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < limits.windowMs)) hits.delete(k); }, limits.windowMs).unref();
}
