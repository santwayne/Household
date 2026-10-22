import { config } from '../config.js';

export interface WaClient {
  sendText(to: string, body: string): Promise<{ id: string }>;
  sendTemplate(to: string, name: string, lang: string, params: string[]): Promise<{ id: string }>;
  getMedia(mediaId: string): Promise<{ data: Buffer; mime: string }>;
}

export class CloudApiClient implements WaClient {
  private get base() { return `${config.wa.graphBase}/${config.wa.graphVersion}`; }
  private get headers() { return { authorization: `Bearer ${config.wa.accessToken}`, 'content-type': 'application/json' }; }

  private async post(body: unknown): Promise<{ id: string }> {
    const res = await fetch(`${this.base}/${config.wa.phoneNumberId}/messages`, { method: 'POST', headers: this.headers, body: JSON.stringify({ messaging_product: 'whatsapp', ...(body as object) }) });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok) { const e = new Error(`WhatsApp ${res.status}: ${j?.error?.message ?? 'send failed'}`) as Error & { status?: number }; e.status = res.status; throw e; }
    return { id: j.messages?.[0]?.id ?? '' };
  }
  sendText(to: string, body: string) { return this.post({ to, type: 'text', text: { body, preview_url: false } }); }
  sendTemplate(to: string, name: string, lang: string, params: string[]) {
    return this.post({ to, type: 'template', template: { name, language: { code: lang }, components: params.length ? [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }] : [] } });
  }
  async getMedia(mediaId: string) {
    const meta: any = await (await fetch(`${this.base}/${mediaId}`, { headers: this.headers })).json();
    if (!meta.url) throw new Error('media url missing');
    const res = await fetch(meta.url, { headers: { authorization: `Bearer ${config.wa.accessToken}` } });
    if (!res.ok) throw new Error(`media download ${res.status}`);
    return { data: Buffer.from(await res.arrayBuffer()), mime: meta.mime_type ?? 'audio/ogg' };
  }
}

/** Used when no WhatsApp credentials are configured (local development, tests): records instead of sending. */
export class DryRunClient implements WaClient {
  sent: { to: string; kind: 'text' | 'template'; body: string; template?: string }[] = [];
  media = new Map<string, { data: Buffer; mime: string }>();
  async sendText(to: string, body: string) { this.sent.push({ to, kind: 'text', body }); return { id: `dry.${this.sent.length}` }; }
  async sendTemplate(to: string, name: string, _lang: string, params: string[]) { this.sent.push({ to, kind: 'template', body: params.join(' | '), template: name }); return { id: `dry.${this.sent.length}` }; }
  async getMedia(id: string) { const m = this.media.get(id); if (!m) throw new Error('no media'); return m; }
}

export const makeWaClient = (): WaClient => (config.wa.dryRun ? new DryRunClient() : new CloudApiClient());
