# STATUS: kya bana, kya nahi (teeno PDF ke hisaab se)

Last verified: 42 automated tests pass; dashboard ko real browser (Chromium) mein 6 screens par chala kar dekha; chat flow signed webhooks se end-to-end chala.
**Kabhi live chala nahi:** asli WhatsApp number, asli LLM API (Claude/OpenAI), asli voice-note transcription. Inke adapters likhe hain par live credentials ke bina test nahi hue.

## Bana hai (aur test hua hai)
**Developer Brief**
- 5 kaam: groceries, budget+expenses, weekly meal plan, healthy-eating feedback, food reminders (chat + dashboard dono se).
- Budget-fit planner: cost code se nikalta hai (price book x quantity), AI guess nahi karta. Budget kam ho to saaf bolta hai "itne mein fit nahi", chup-chaap exceed nahi karta.
- Price book jo seekhta hai (regional default -> household ka apna logged price). Protein-per-rupee ranking.
- Ek meal badlo to sirf us meal ke shopping items badalte hain (test mein verify).
- Diet/allergy filter deterministic (fail-closed). Medical advice nahi, disclaimers hain.
- WhatsApp: signature check (raw body), webhook dedupe + purani messages ignore, private chats, consent pehle (first message ya invite link), STOP/START/DELETE, 24-hour window + paid template fallback, durable outbox with retries.
- Message pipeline: rules pehle -> phir model strict JSON schema (zod) -> validate -> ek chhota sawal -> transaction mein save -> reply. Har model call `ai_calls` mein log (tokens, cost, outcome).
- Voice note: transcribe + silence/noise/known-hallucination/prompt-echo reject (mock STT se test). STT ko koi prompt nahi bhejte.
- Reply language: Roman Hinglish -> Hinglish, Devanagari -> Hindi, Gurmukhi -> Punjabi, English -> English.
- Data model: brief ke saare tables (+ tasks, pantry, audit_log, conversation_state, pilot_commitments). Budget/contribution/purchase/settlement alag records. App paisa hold/move nahi karta.
- Dashboard 6 screens: Home, Weekly plan, Shopping, Money, Food log, Household.
- Security/privacy: har query household se scoped (2-household isolation tests), session sirf WhatsApp ke one-time link se, personal meal log private by default, data export, member ka personal data erase, poora household delete, idempotent handlers (retry par double entry nahi).
- Evaluation harness + 200 messages (`npm run eval`).

**Blueprint**
- New City Mode ka MVP: living setup (solo/flat/PG/room), food budget, practical meal plan (time, equipment, diet, region), shared expenses, Hinglish/English.
- Tasks: cooking rotation (assigned cook), grocery-run/cleaning tasks, recurring + rotate weekly, Sunday Household Reset, weekly recap (Sunday shaam).
- Pantry (manual) + shopping list se safe unit par subtract; leftovers/best-before store hote hain.
- Equal/custom/percent splits (API), corrections void se (audit trail ke saath).

**Target Market**
- Regional recipes (north, punjabi, gujarati, south, bengali, maharashtrian, general) + "curry leaves nahi mile" jaise 16 substitutes.
- Pilot tooling: `/admin/pilot` (go/stop rules ke saath: >=50% active, >=20% pay, <33% active = stop), paid/committed record karne ka endpoint. Price point ₹149 config mein hai.
- Currency/time zone per household.

## Eval ka sach (`eval/report.json`)
- 200 messages **hamne khud likhe hain** (synthetic), asli users ke nahi.
- Sirf rules: 184/200 handle, 184 sahi (precision 100%), overall 92%. Baaki 16 model ke liye (number words, lambe sentences).
- Model path **abhi measure nahi hua** (API key nahi thi). To "90% target met" tabhi kehna jab key laga ke `npm run eval` chale aur asli messages bhi daalo.

## Aadha / simplified
- Recipes (32) aur nutrition/protein numbers **draft hain, expert review baaki** (`recipes.reviewed=false`, UI par disclaimer). Prices bhi assumption hain [verify].
- Hindi/Punjabi replies sirf core flows ke liye; native speaker review chahiye. Baaki keys Hinglish par fallback.
- Queue: BullMQ/Redis ki jagah Postgres outbox. Web: Next.js ki jagah React+Vite. (Dono kaam karte hain, par brief se alag.)
- Household banana/join sirf WhatsApp se; web par nahi (Phase-1 criteria "WhatsApp aur web dono se" adhoora).
- Rating/swap ke "preference signals" store hote hain par planner ko feed nahi hote.
- Weekly recap/reminder templates ke naam config mein hain par Meta mein banane aur approve karwane padenge.
- Custom/percent split sirf API/dashboard-level; chat mein sirf equal.
- Row-level isolation application queries se hai (tested); Postgres RLS nahi lagaya.
- Budget alert sirf us user ke reply mein (80%/100%), baaki members ko alag push nahi.

## Nahi bana
- Receipt OCR / pantry photos / fuller preference learning / consent-based insights (Phase 3).
- Shifts/classes ke hisaab se schedule adjust (`schedule_prefs` column hai, use nahi hota).
- Payments, subscription billing, UPI/cards, Splitwise-type money movement (PDF mein bhi out of scope/hypothesis).
- Official WhatsApp Groups API support (brief ne verify karne ko kaha; abhi sirf invite-link fallback).
- Formal privacy policy page, support hours, GDPR/country-wise legal review, rate limiting, CI, deployment (Docker/hosting).
- Retention week-4/8 jaise success metrics aur correction-rate dashboards.
- Competitor/price/WhatsApp-rate verification (ye research/business kaam hai, code nahi).
- Phase 0 ka asli kaam: interviews, pilot, template approval, product name/domain/number, recipe reviewer.

## Jo aapko karna padega
1. WhatsApp Business account + number + templates (food_reminder, weekly_recap) approve karwana.
2. `ANTHROPIC_API_KEY` ya `OPENAI_API_KEY` set karke `npm run eval` chalana; voice ke liye `OPENAI_API_KEY`.
3. Recipes aur protein values kisi expert se review karwana, local prices verify karna.
4. Pehle manual pilot (pilot_kit.md), phir is build ko 10-20 households par chalana.
