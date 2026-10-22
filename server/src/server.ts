import { pool } from './db/index.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { buildApp } from './app.js';
import { makeWaClient } from './whatsapp/client.js';
import { makeLlmClient } from './nlu/llm.js';
import { makeStt } from './nlu/stt.js';
import { startScheduler } from './jobs/scheduler.js';

async function main() {
  await migrate(pool);
  const wa = makeWaClient();
  const deps = { pool, wa, llm: makeLlmClient(), stt: makeStt() };
  const app = await buildApp(deps, { logger: true });
  const stop = startScheduler(pool, wa);
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info({ whatsapp: config.wa.dryRun ? 'dry-run (no WA_ACCESS_TOKEN)' : 'live', llm: deps.llm ? config.llm.provider : 'none (rules only)', stt: deps.stt ? 'on' : 'off' }, 'ready');
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, async () => { stop(); await app.close(); await pool.end(); process.exit(0); });
}
main().catch(e => { console.error(e); process.exit(1); });
