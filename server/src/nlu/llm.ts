import { config } from '../config.js';
import { ActionSchema, ACTION_JSON_SCHEMA, type Action } from './schema.js';

export type LlmUsage = { model: string; promptTokens: number; completionTokens: number; latencyMs: number };
export type LlmContext = { memberNames: string[]; senderName: string; currency: string; today: string; timezone: string };
export interface LlmClient {
  /** Returns the raw model JSON. The caller validates it with zod; anything that does not match is rejected. */
  proposeAction(text: string, ctx: LlmContext): Promise<{ raw: unknown; usage: LlmUsage }>;
}

const SYSTEM = `You convert one WhatsApp message from a flat/PG household into ONE structured action for a meals, groceries and shared-expense assistant.
Rules:
- Output only the action. Never do arithmetic, never compute balances, budgets or meal costs, never give medical advice.
- Messages are Roman Hinglish, Hindi (Devanagari), Punjabi (Gurmukhi) or English, possibly with typos or from a voice transcript.
- Use the member names provided. If the speaker says "I/maine/mene", leave payer/member/from null (it means the sender).
- Amounts are plain numbers in the household currency ("1.5k" = 1500).
- Items are short singular-or-plural grocery names in English where obvious ("doodh" -> "milk"), no quantities unless stated ("2 kg rice").
- If the message is not clearly one of the intents, return intent "unknown" with low confidence. Set confidence honestly (0 to 1). Set needs_confirmation true when a key detail (who paid, how much, which items) is guessed.
- Reminders are food-related only. Put the dish/task in "text" and the time in "when".`;

function costUsd(u: LlmUsage) {
  return (u.promptTokens * config.llm.pricing.inPerM + u.completionTokens * config.llm.pricing.outPerM) / 1_000_000;
}
export { costUsd };

function userPrompt(text: string, ctx: LlmContext) {
  return `Household members: ${ctx.memberNames.join(', ')}. Sender: ${ctx.senderName}. Currency: ${ctx.currency}. Today: ${ctx.today} (${ctx.timezone}).\nMessage: """${text}"""`;
}

export class AnthropicClient implements LlmClient {
  constructor(private key = config.llm.anthropicKey, private model = config.llm.parseModel) {}
  async proposeAction(text: string, ctx: LlmContext) {
    const t0 = Date.now();
    const res = await fetch(`${config.llm.anthropicBase}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': this.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model, max_tokens: config.llm.maxOutputTokens,
        // stable prompt part is cached
        system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
        tools: [{ name: 'record_action', description: 'Record the structured action for this message', input_schema: ACTION_JSON_SCHEMA }],
        tool_choice: { type: 'tool', name: 'record_action' },
        messages: [{ role: 'user', content: userPrompt(text, ctx) }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j: any = await res.json();
    const tool = (j.content ?? []).find((c: any) => c.type === 'tool_use');
    return { raw: tool?.input ?? null, usage: { model: this.model, promptTokens: j.usage?.input_tokens ?? 0, completionTokens: j.usage?.output_tokens ?? 0, latencyMs: Date.now() - t0 } };
  }
}

export class OpenAiClient implements LlmClient {
  constructor(private key = config.llm.openaiKey, private model = config.llm.parseModel) {}
  async proposeAction(text: string, ctx: LlmContext) {
    const t0 = Date.now();
    const res = await fetch(`${config.llm.openaiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: this.model, max_tokens: config.llm.maxOutputTokens, temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `${SYSTEM}\nReturn a JSON object matching this JSON schema:\n${JSON.stringify(ACTION_JSON_SCHEMA)}` },
          { role: 'user', content: userPrompt(text, ctx) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j: any = await res.json();
    let raw: unknown = null;
    try { raw = JSON.parse(j.choices?.[0]?.message?.content ?? 'null'); } catch { raw = null; }
    return { raw, usage: { model: this.model, promptTokens: j.usage?.prompt_tokens ?? 0, completionTokens: j.usage?.completion_tokens ?? 0, latencyMs: Date.now() - t0 } };
  }
}

export function makeLlmClient(): LlmClient | null {
  if (config.llm.provider === 'anthropic' && config.llm.anthropicKey) return new AnthropicClient();
  if (config.llm.provider === 'openai' && config.llm.openaiKey) return new OpenAiClient();
  return null;
}

export type ParsedByLlm = { action: Action | null; usage: LlmUsage | null; outcome: 'ok' | 'schema_rejected' | 'error'; raw: unknown; error?: string };

/** Strict: output that does not match the schema is rejected, never repaired by guessing. */
export async function parseWithLlm(client: LlmClient, text: string, ctx: LlmContext): Promise<ParsedByLlm> {
  try {
    const { raw, usage } = await client.proposeAction(text, ctx);
    const parsed = ActionSchema.safeParse(raw);
    if (!parsed.success) return { action: null, usage, outcome: 'schema_rejected', raw, error: parsed.error.issues[0]?.message };
    return { action: parsed.data, usage, outcome: 'ok', raw };
  } catch (e) {
    return { action: null, usage: null, outcome: 'error', raw: null, error: (e as Error).message };
  }
}
