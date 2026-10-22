# STATUS: kya bana, kya nahi (teeno PDF ke hisaab se)

Last verified: 56 automated tests pass; dashboard real browser (Chromium) mein chala kar dekha; chat flow signed webhooks se end-to-end chala.

**Status ke matlab**
- **Ho gaya**: code poora, tests mein verify.
- **Code ho gaya, bahar ka kaam baaki**: code poora aur test hua, par live credentials ya kisi insaan (expert / lawyer / native speaker) ki zaroorat hai.
- **Baaki**: bana hi nahi.

**Kabhi live nahi chala:** asli WhatsApp number, asli Claude/OpenAI API, asli voice-note transcription. Inke adapters ko local fake servers ke saath test kiya hai (`server/test/adapters.test.ts`): request ka shape, headers, retry, parsing sahi hai. Isse ye *pata nahi chalta* ki asli service kaise behave karti hai.

## Ho gaya
- 5 kaam: groceries, budget+expenses, weekly plan, healthy eating, food reminders (chat + dashboard).
- Budget-fit planner (cost code se), price book jo seekhta hai, protein per rupee.
- **Schedule (shifts/classes):** har member apne "busy" meals mark karta hai (dashboard). Jis meal par koi free nahi, wahan 20 min tak ki quick recipe aur cook unassigned. Free members mein cook assign hota hai.
- **Preference signals:** swap kiya hua meal, rating, cooked: sab planner ko feed hote hain (dobara plan mein disliked recipe nahi aati).
- **Pantry:** chat se add ("ghar mein 2 kg chawal hai"), dikhana, "kya expire ho raha hai", "ghar ke saman se kya banaun", daily expiry alert (sirf free text, template nahi).
- **Custom split chat mein:** "Aman ne 600 ka saman liya, sirf Aman aur Raj ke liye". Naam na mile to sawal.
- **Budget alert baaki members ko bhi** (24h window ke andar free text; paid template sirf `BUDGET_ALERT_TEMPLATES=1` par).
- **Delivery receipts:** WhatsApp status webhooks (delivered/read/failed) save hote hain.
- **Rate limiting:** API/login per IP (429), WhatsApp per number (30 msg/min se zyada ignore).
- **Privacy notice page** `/privacy` (consent message aur dashboard se linked). Draft hai, lawyer review baaki.
- **Pilot metrics:** retention week 1/2/3/4/8, correction rate (undo), rules vs model share, confirmation rate, AI cost per active household.
- **Dashboard:** login par "Start on WhatsApp" button (household hamesha WhatsApp se consent ke saath shuru hota hai), pantry/cook ideas card, schedule grid, task owner swap, activity log (audit trail).
- Pehle se: WhatsApp pipeline, signature, dedupe, consent, 24h window + templates ka code, outbox retries, voice guards, tasks, Sunday reset, weekly recap, data export/erase, household isolation tests, 6 dashboard screens, pilot go/stop endpoint.
- Reply strings: har key English, Hinglish, Hindi aur Punjabi mein hai (test se enforce).

## Code ho gaya, bahar ka kaam baaki
| Cheez | Kya chahiye |
|---|---|
| WhatsApp live | Business account + number, webhook jodna, templates `food_reminder` / `weekly_recap` / `budget_alert` Meta mein approve karwana |
| Claude/OpenAI parsing | API key lagao, `npm run eval` chalao (model path abhi measure nahi hua) |
| Voice notes | `OPENAI_API_KEY`, asli voice notes se test |
| Recipes (32) aur protein values | Nutrition expert review (`recipes.reviewed=false`, UI par disclaimer); prices bhi verify |
| Hindi/Punjabi replies | Maine likhe hain; fluent speakers se review |
| Privacy notice | Lawyer review (DPDP Act; EU/UK users ho to GDPR); contact email `PRIVACY_CONTACT` set karo |
| 200+ message eval | Hamare likhe synthetic messages hain; asli users ke messages jama karke badlo |

## Eval ka sach (`eval/report.json`)
- 226 synthetic messages. Jo "model ke liye nahi" flagged hain wo sab rules se sahi parse hote hain (test se enforce). Rules ne 201 handle kiye, sab 201 sahi (precision 100%); 25 messages model ke liye (number words, lambe sentences) hain.
- Model path measure nahi hua, isliye "90% target met" abhi pakka nahi.

## Database-level isolation (RLS)
Har household-table par Postgres row-level security hai; tenant kaam `sl_app` role aur `app.household_id` ke saath chalta hai (details: DEPLOY.md section 5). `server/test/rls.test.ts` ke 7 tests; policies ko jaan-boojh kar todkar check kiya ki tests fail hote hain.

## Baaki (bana hi nahi)
- Receipt OCR, pantry photos, fuller preference learning (Phase 3).
- Payments, billing, UPI/cards.
- WhatsApp Groups API (abhi invite-link fallback).
- Deployment (Docker/hosting), CI.
- Support hours, country-wise legal review, videsh payments.
- Interviews, pilot, Meta template approval, product name/domain/number: ye insaan ka kaam hai.

## Deviations (brief se alag)
- Redis/BullMQ ki jagah Postgres outbox; Next.js ki jagah React+Vite.
