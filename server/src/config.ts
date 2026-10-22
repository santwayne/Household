const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3000),
  databaseUrl: env.DATABASE_URL ?? 'postgres://postgres@localhost:5432/shared_living',
  publicUrl: env.PUBLIC_URL ?? 'http://localhost:3000',
  adminToken: env.ADMIN_TOKEN ?? '',
  wa: {
    phoneNumberId: env.WA_PHONE_NUMBER_ID ?? '',
    businessNumber: env.WA_BUSINESS_NUMBER ?? '910000000000',   // digits only, used for wa.me invite links
    accessToken: env.WA_ACCESS_TOKEN ?? '',
    appSecret: env.WA_APP_SECRET ?? '',
    verifyToken: env.WA_VERIFY_TOKEN ?? '',
    graphVersion: env.WA_GRAPH_VERSION ?? 'v21.0',
    graphBase: env.WA_GRAPH_BASE ?? 'https://graph.facebook.com',   // overridable so adapters can be tested against a local fake
    // Approved template names: they must exist and be approved in Meta Business Manager [verify]
    templates: {
      reminder: env.WA_TPL_REMINDER ?? 'food_reminder',
      weeklyRecap: env.WA_TPL_RECAP ?? 'weekly_recap',
      budgetAlert: env.WA_TPL_BUDGET ?? 'budget_alert',
      loginLink: env.WA_TPL_LOGIN ?? 'dashboard_login',
    },
    replayToleranceSec: Number(env.WA_REPLAY_TOLERANCE_SEC ?? 86400),
    dryRun: env.WA_DRY_RUN === '1' || !env.WA_ACCESS_TOKEN,
  },
  llm: {
    provider: (env.LLM_PROVIDER ?? (env.ANTHROPIC_API_KEY ? 'anthropic' : env.OPENAI_API_KEY ? 'openai' : 'none')) as 'anthropic' | 'openai' | 'none',
    anthropicKey: env.ANTHROPIC_API_KEY ?? '',
    anthropicBase: env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
    openaiBase: env.OPENAI_BASE_URL ?? 'https://api.openai.com',
    openaiKey: env.OPENAI_API_KEY ?? '',
    parseModel: env.LLM_PARSE_MODEL ?? (env.ANTHROPIC_API_KEY ? 'claude-haiku-5-5' : 'gpt-4o-mini'),
    planModel: env.LLM_PLAN_MODEL ?? (env.ANTHROPIC_API_KEY ? 'claude-sonnet-5-5' : 'gpt-4o'),
    // USD per million tokens. Placeholders: check current API pricing before relying on cost numbers [verify]
    pricing: { inPerM: Number(env.LLM_PRICE_IN_PER_M ?? 1), outPerM: Number(env.LLM_PRICE_OUT_PER_M ?? 5) },
    maxOutputTokens: 400,
  },
  stt: { model: env.STT_MODEL ?? 'whisper-1', openaiKey: env.OPENAI_API_KEY ?? '' },
  jobs: { enabled: env.JOBS_ENABLED !== '0', tickMs: Number(env.JOBS_TICK_MS ?? 15000) },
  plan: { pricePointInr: Number(env.PLAN_PRICE_INR ?? 149) }, // hypothesis to test, not data
  sessionTtlDays: 30,
  loginLinkTtlMin: 15,
};
