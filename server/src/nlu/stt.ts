import { config } from '../config.js';

export type SttResult = { ok: true; text: string } | { ok: false; reason: string };
export interface SttClient { transcribe(audio: Buffer, mime: string): Promise<{ text: string; segments?: { no_speech_prob?: number; avg_logprob?: number }[]; durationSec?: number }>; }

// Known speech-to-text hallucinations on silence/noise. These are real failure modes seen with Whisper-style models.
const HALLUCINATIONS = [
  /thanks? for watching/i, /please subscribe/i, /subtitles? by/i, /amara\.org/i, /^thank you\.?$/i, /^you\.?$/i, /^bye\.?$/i,
  /transcribed by/i, /mbc/i, /like and subscribe/i, /dimatorzok/i, /शुक्रिया देखने के लिए|देखने के लिए धन्यवाद/,
];

/**
 * Reject silence, noise and prompt-echo transcripts. We never send place names or example sentences as a prompt
 * (models read them back on silence); `promptUsed` is checked anyway.
 */
export function guardTranscript(text: string, opts: { promptUsed?: string; segments?: { no_speech_prob?: number }[]; bytes?: number } = {}): SttResult {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (opts.bytes != null && opts.bytes < 2000) return { ok: false, reason: 'too_short_audio' };
  if (t.length < 2) return { ok: false, reason: 'empty' };
  if (!/[\p{L}\p{N}]/u.test(t)) return { ok: false, reason: 'no_speech' };
  if (HALLUCINATIONS.some(r => r.test(t))) return { ok: false, reason: 'known_hallucination' };
  if (opts.promptUsed && t.toLowerCase().includes(opts.promptUsed.toLowerCase().slice(0, 30))) return { ok: false, reason: 'prompt_echo' };
  const words = t.toLowerCase().split(/\s+/);
  if (words.length >= 6) {
    const uniq = new Set(words).size;
    if (uniq / words.length < 0.3) return { ok: false, reason: 'repetition_loop' };
  }
  const seg = opts.segments ?? [];
  if (seg.length && seg.every(s => (s.no_speech_prob ?? 0) > 0.6)) return { ok: false, reason: 'no_speech_prob' };
  return { ok: true, text: t };
}

export class OpenAiStt implements SttClient {
  constructor(private key = config.stt.openaiKey, private model = config.stt.model) {}
  async transcribe(audio: Buffer, mime: string) {
    const fd = new FormData();
    fd.append('file', new Blob([new Uint8Array(audio)], { type: mime }), mime.includes('ogg') ? 'voice.ogg' : 'voice.m4a');
    fd.append('model', this.model);
    fd.append('response_format', 'verbose_json');
    // deliberately NO prompt parameter: prompts with names/example sentences get read back on silence
    const res = await fetch(`${config.llm.openaiBase}/v1/audio/transcriptions`, { method: 'POST', headers: { authorization: `Bearer ${this.key}` }, body: fd });
    if (!res.ok) throw new Error(`STT ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j: any = await res.json();
    return { text: j.text ?? '', segments: j.segments, durationSec: j.duration };
  }
}

export const makeStt = (): SttClient | null => (config.stt.openaiKey ? new OpenAiStt() : null);

export async function transcribeVoice(stt: SttClient, audio: Buffer, mime: string): Promise<SttResult> {
  try {
    const r = await stt.transcribe(audio, mime);
    return guardTranscript(r.text, { segments: r.segments, bytes: audio.length });
  } catch (e) {
    return { ok: false, reason: `stt_error:${(e as Error).message}` };
  }
}
