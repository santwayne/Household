import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fstatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { registerApi } from './http/api.js';
import { registerRateLimit } from './http/ratelimit.js';
import { privacyHtml } from './http/privacy.js';
import { registerWebhook } from './whatsapp/webhook.js';
import type { Deps } from './nlu/pipeline.js';

export async function buildApp(deps: Deps, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false, bodyLimit: 2 * 1024 * 1024 });
  await app.register(cookie);
  // keep the raw bytes for webhook signature verification
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => {
    (req as any).rawBody = body;
    if (!(body as Buffer).length) return done(null, {});
    try { done(null, JSON.parse((body as Buffer).toString('utf8'))); } catch (e) { (e as any).statusCode = 400; done(e as Error, undefined); }
  });
  registerRateLimit(app);
  app.get('/privacy', async (_req, reply) => reply.type('text/html; charset=utf-8').send(privacyHtml()));
  registerWebhook(app, deps);
  registerApi(app);

  const here = dirname(fileURLToPath(import.meta.url));
  const dist = join(here, '../../web/dist');
  if (existsSync(dist)) {
    await app.register(fstatic, { root: dist, prefix: '/', wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/webhook')) return reply.code(404).send({ error: 'not_found' });
      return reply.sendFile('index.html');
    });
  }
  return app;
}
