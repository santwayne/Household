import { createHmac, timingSafeEqual } from 'node:crypto';

/** Verify Meta's X-Hub-Signature-256 over the RAW request body. */
export function verifySignature(rawBody: Buffer | string, header: string | undefined, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const m = header.match(/^sha256=([0-9a-f]{64})$/i);
  if (!m) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  const given = Buffer.from(m[1], 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const sign = (rawBody: Buffer | string, appSecret: string) => 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
