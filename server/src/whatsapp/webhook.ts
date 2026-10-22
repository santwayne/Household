import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { handleInbound, type Deps, type InboundMsg } from '../nlu/pipeline.js';
import { verifySignature } from './signature.js';

/** Convert Meta's webhook payload into our InboundMsg list (text, audio, image/other). */
export function extractMessages(body: any): InboundMsg[] {
  const out: InboundMsg[] = [];
  for (const entry of body?.entry ?? []) for (const ch of entry?.changes ?? []) {
    const v = ch?.value; if (!v?.messages) continue;
    const names = new Map<string, string>((v.contacts ?? []).map((c: any) => [c.wa_id, c.profile?.name]));
    for (const m of v.messages) {
      const base = { waMessageId: m.id, phone: m.from, profileName: names.get(m.from) ?? null, timestamp: Number(m.timestamp) };
      if (m.type === 'text') out.push({ ...base, type: 'text', text: m.text?.body ?? '' });
      else if (m.type === 'audio') out.push({ ...base, type: 'audio', mediaId: m.audio?.id });
      else if (m.type === 'image') out.push({ ...base, type: 'image', mediaId: m.image?.id });
      else if (m.type === 'button') out.push({ ...base, type: 'text', text: m.button?.text ?? m.button?.payload ?? '' });
      else if (m.type === 'interactive') out.push({ ...base, type: 'text', text: m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? '' });
      else out.push({ ...base, type: 'other' });
    }
  }
  return out;
}

export function registerWebhook(app: FastifyInstance, deps: Deps) {
  // GET: Meta's one-time verification handshake
  app.get('/webhook/whatsapp', async (req, reply) => {
    const q = req.query as Record<string, string>;
    if (q['hub.mode'] === 'subscribe' && config.wa.verifyToken && q['hub.verify_token'] === config.wa.verifyToken) return reply.type('text/plain').send(q['hub.challenge']);
    return reply.code(403).send('forbidden');
  });

  // POST: signature over the RAW body is verified before anything is parsed
  app.post('/webhook/whatsapp', { config: { rawBody: true } }, async (req, reply) => {
    const raw = (req as any).rawBody as Buffer | undefined;
    if (!raw || !verifySignature(raw, req.headers['x-hub-signature-256'] as string | undefined, config.wa.appSecret)) return reply.code(401).send('bad signature');
    const now = (deps.now ?? (() => new Date()))().getTime() / 1000;
    for (const m of extractMessages(req.body)) {
      if (m.timestamp && now - m.timestamp > config.wa.replayToleranceSec) continue; // too old to be a live message: ignore (and would be outside the 24h window anyway)
      await handleInbound(deps, m);
    }
    return reply.code(200).send('ok');
  });
}
