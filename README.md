# Shared Living: Meals, Groceries & Money on WhatsApp

WhatsApp-first assistant + mobile web dashboard for people who live alone or share a flat.
Built from three planning documents (Product Blueprint, Target Market, Developer Brief). See **STATUS.md** for what is and is not built.

## Run it
```bash
npm install
createdb shared_living                 # PostgreSQL 14+
cp .env.example .env                   # then export the variables (the server reads process.env)
npm run migrate                        # schema + starter recipes + default prices
npm run build:web                      # dashboard -> web/dist
npm start                              # http://localhost:3000
```
Without WhatsApp credentials the server is in **dry-run** mode. To try the chat without WhatsApp, POST a signed webhook (see `server/test/webhook.test.ts`), or run `npm test`.

Point Meta's webhook at `POST /webhook/whatsapp` (verification: `GET` with `WA_VERIFY_TOKEN`).

## Try the bot without WhatsApp
```bash
npm run chat -- --phone 919800000001 --name Aman   # type messages; "/as 919800000002 Raj" switches person
```
It runs the real message pipeline against your database and prints the replies (no WhatsApp, and no AI unless you set a key).

## Tests
```bash
createdb shared_living_test
npm test                 # 71 tests (incl. row-level security, splits, suggestions, recipe data): money, planner, schedule, isolation, pipeline, webhook, adapters (against local fakes), pantry, rate limits
npm run eval             # 237-message evaluation (rules, plus model if a key is set) -> eval/report.json
```
`TEST_DATABASE_URL` overrides the test DB (default `postgres://postgres@localhost:5433/shared_living_test`).

## Layout
- `server/src/domain` pure and DB logic (ledger, budget, price book, planner, shopping, tasks). The AI never touches this.
- `server/src/nlu` rules-first parser, strict JSON schema, LLM and speech adapters, replies in en/Hinglish/hi/pa.
- `server/src/whatsapp` webhook, signature check, Cloud API client, durable outbox (24-hour window, consent, templates).
- `server/src/http` REST API (session from a one-time WhatsApp link) and pilot admin metrics.
- `server/src/jobs` reminders, weekly recap.
- `web` React dashboard (Home, Weekly plan, Shopping, Money, Food log, Household).
- `eval` 237-message set and harness.

## Design rules (from the Developer Brief)
The AI proposes a structured action; the backend validates it, does all arithmetic and writes; the bot confirms only what was committed.
Budget remaining, splits, balances, meal costs and allergy/diet exclusions are always computed by plain code.
