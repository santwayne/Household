# Deploying Shared Living

## 1. Run it with Docker
```bash
cp .env.example .env        # fill in the values you have (see the table below)
docker compose up -d --build
curl localhost:3000/healthz  # {"ok":true}
```
The server creates the tables and loads the starter recipes/prices on every start (safe to repeat). Data lives in the `dbdata` volume.

Without WhatsApp credentials it runs in **dry-run** mode (nothing is sent). Without an AI key it works on rules only.

## 2. Settings that matter (`.env`)
| Variable | Why |
|---|---|
| `PUBLIC_URL` | Public **https** address. Used in login links and the privacy link. |
| `POSTGRES_PASSWORD` | Change it for anything beyond local use. |
| `ADMIN_TOKEN` | Protects `/admin/pilot`. Use a long random value. |
| `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, `WA_BUSINESS_NUMBER` | WhatsApp Business Platform. Without `WA_ACCESS_TOKEN` nothing is sent. |
| `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | Understanding messages the rules cannot; `OPENAI_API_KEY` also enables voice notes. |
| `PRIVACY_CONTACT` | Shown on `/privacy`. |

## 3. HTTPS and the WhatsApp webhook
Meta only calls https URLs. Put a reverse proxy in front, for example Caddy (automatic certificates):
```
yourdomain.com {
  reverse_proxy localhost:3000
}
```
In the Meta developer console set the webhook to `https://yourdomain.com/webhook/whatsapp` and the verify token to `WA_VERIFY_TOKEN`, and subscribe to `messages`.
Create and get approved the templates named in `.env.example` (`food_reminder`, `weekly_recap`, `budget_alert`).

## 4. Operating notes
- **Backups:** back up the Postgres volume (`docker compose exec db pg_dump -U postgres shared_living > backup.sql`). Household records are the product.
- **One app instance** is the tested setup. Background jobs claim rows safely (so two instances will not double-send), but the rate limiter is in memory per instance.
- **Logs:** `docker compose logs -f app`.
- **Updates:** `git pull && docker compose up -d --build`.
- **Not included:** a managed host, monitoring/alerting and a secrets manager. Add those for real users.

## 5. Database-level household isolation (row-level security)
Every table that holds household data has a Postgres row-level security policy. Tenant work (dashboard requests and WhatsApp messages from a known member) runs in a transaction as the role `sl_app` with `app.household_id` set, so Postgres itself only shows and accepts that household's rows. With no household set it shows nothing.

- The migration creates the role and policies on every start (safe to repeat). The database user in `DATABASE_URL` must be a superuser or allowed to `SET ROLE sl_app` (the migration grants this to a non-superuser owner).
- **Trusted system paths** run as the connection's own role and are cross-household by nature: login by phone number, first-contact onboarding, the outbox sender, scheduled jobs and `/admin/pilot`. Keep that code small and reviewed.
- Not row-secured on purpose: `recipes` (shared reference data), `conversation_state`, `login_tokens` (hashes only) and `ai_calls`. `test/rls.test.ts` fails if any other table lacks a policy.
- What it protects against: a missing `WHERE`, a wrong id, a copy-paste bug. What it does not protect against: code that deliberately runs arbitrary SQL or changes `app.household_id` itself.
