"""Builds docs/Project_Status_Hinglish_v2.pdf: the part-by-part status with four labels.
Ho gaya = poora ho gaya. Aadha bacha = kuch ho gaya, kuch bacha. Baaki hai = bana hi nahi. Mera kaam = sirf aap kar sakte ho."""
import os
from collections import Counter
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'Project_Status_Hinglish_v2.pdf')
pdfmetrics.registerFont(TTFont('D', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DB', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
INK, LINE, GREEN = colors.HexColor('#1e2420'), colors.HexColor('#d8d6cc'), colors.HexColor('#2f7d4f')
COL = {'Ho gaya': GREEN, 'Aadha bacha': colors.HexColor('#b4531c'), 'Baaki hai': colors.HexColor('#b3261e'), 'Mera kaam': colors.HexColor('#1a5fb4')}
hexc = lambda c: '#%02x%02x%02x' % (int(c.red * 255), int(c.green * 255), int(c.blue * 255))
H1 = ParagraphStyle('h1', fontName='DB', fontSize=19, leading=24, textColor=INK, spaceAfter=3)
H2 = ParagraphStyle('h2', fontName='DB', fontSize=12.5, leading=16, textColor=GREEN, spaceBefore=12, spaceAfter=6)
P = ParagraphStyle('p', fontName='D', fontSize=9.5, leading=13.5, textColor=INK)
C = ParagraphStyle('c', fontName='D', fontSize=8.4, leading=11.2, textColor=INK)
CB = ParagraphStyle('cb', parent=C, fontName='DB')
TH = ParagraphStyle('th', parent=CB, textColor=colors.white)
SM = ParagraphStyle('sm', fontName='D', fontSize=8, leading=11, textColor=colors.HexColor('#66706a'))

def status_cell(st):
    return Paragraph(f"<font color='{hexc(COL[st])}'><b>{st}</b></font>", C)

counts = Counter()
def tbl(header, rows, widths, status_idx):
    d = [[Paragraph(h, TH) for h in header]]
    for r in rows:
        counts_key = r[status_idx]
        assert counts_key in COL, counts_key
        counts[counts_key] += 1
        d.append([status_cell(c) if i == status_idx else Paragraph(c, CB if i == 0 else C) for i, c in enumerate(r)])
    t = Table(d, colWidths=[w * 1.27 * mm for w in widths], repeatRows=1)
    t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), GREEN), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('GRID', (0, 0), (-1, -1), 0.4, LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f6f5f1')]), ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    return t

G, A, B, M = 'Ho gaya', 'Aadha bacha', 'Baaki hai', 'Mera kaam'

glance = [
 ['WhatsApp bot (chat)', G, 'Kharcha, list, budget, plan, reminder, pantry, custom split; 4 bhashaon mein. Mock/fake se tested; asli number par nahi chala.'],
 ['Budget-fit meal plan', G, 'Cost code se; schedule aur pasand-napasand ka dhyan rakhta hai.'],
 ['Dashboard', G, '6 screens + schedule grid, task swap, activity log, pantry card, Start on WhatsApp.'],
 ['Privacy aur data isolation', G, 'Consent, export, erase, rate limit, household isolation (app + database row-level security).'],
 ['Pilot tooling', G, 'Go/stop, retention, correction rate, paid commitment record.'],
 ['Docker aur CI', G, 'Image build, health check, GitHub Actions (tests + stack boot).'],
 ['AI (Claude/OpenAI) aur voice', A, 'Code + fake-server test ho gaya. Asli API key se test baaki (Mera kaam).'],
 ['Recipes aur nutrition', A, '32 recipes ka starter set. Zyada recipes aur expert review baaki.'],
 ['Hindi/Punjabi replies', A, 'Har message 4 bhashaon mein likha hai. Native speaker review baaki.'],
 ['Receipt/photo, payments, billing', B, 'Pilot ke baad ya PDF mein out of scope.'],
 ['Pilot, interviews, WhatsApp setup, hosting', M, 'Insaan ka kaam: account, number, templates, expert/lawyer review, server.'],
]
modules = [
 ['Database', 'Saare tables, audit log, feedback, delivery status.', 'server/src/db', G, 'Kuch nahi.'],
 ['Money engine', 'Split, balances, kitty, settlements. Sirf code, AI nahi.', 'domain/money, ledger', G, 'Kuch nahi.'],
 ['Meal planner + price book', 'Budget-fit plan, schedule-aware, preference se seekhta hai, swap, protein per rupee.', 'domain/planner, plans, pricebook', A, 'Code poora. Recipes/prices ka expert verify baaki.'],
 ['Shopping, pantry, tasks, health', 'Merged list, pantry+expiry, rotation, balance feedback.', 'domain/shopping, pantry, tasks, health', G, 'Kuch nahi.'],
 ['Message parser (rules)', 'Rules pehle: Hinglish/Hindi/Punjabi/English.', 'server/src/nlu', G, 'Kuch nahi.'],
 ['AI parsing + voice adapters', 'Claude/OpenAI parsing, speech-to-text, noise guard.', 'nlu/llm.ts, stt.ts', A, 'Fake servers se tested. Asli key aur voice test baaki.'],
 ['WhatsApp layer', 'Webhook, signature, outbox, consent, 24h window, receipts.', 'server/src/whatsapp', A, 'Code poora. Asli number aur templates baaki.'],
 ['Background jobs', 'Reminders, weekly recap, expiry alerts.', 'server/src/jobs', A, 'Tests pass. Live WhatsApp par test baaki.'],
 ['REST API + login', 'Dashboard API, one-time link login, rate limit.', 'server/src/http', G, 'Kuch nahi.'],
 ['Dashboard (web)', '6 screens + extras.', 'web/src', G, 'Kuch nahi.'],
 ['Row-level security', 'Database level par household alag.', 'db/rls.sql, tenant.ts', G, 'Kuch nahi.'],
 ['Privacy notice page', '/privacy, consent message se linked.', 'http/privacy.ts', A, 'Page ho gaya. Lawyer review aur contact email baaki.'],
 ['Pilot admin', 'Go/stop, retention, correction rate, AI cost.', 'http/pilot.ts', G, 'Kuch nahi.'],
 ['Tests aur eval', f'63 tests, 226-message eval (rules ke liye flagged sab sahi).', 'server/test, eval', A, 'Asli users ke messages aur model-path eval baaki.'],
 ['Docker + CI', 'Dockerfile, compose, GitHub Actions.', 'Dockerfile, .github', G, 'Kuch nahi.'],
 ['Docs aur pilot kit', 'README, STATUS, DEPLOY, PILOT_DECISION, pilot kit, status PDFs.', 'repo root, docs/', G, 'Kuch nahi.'],
 ['Hosting par deploy, monitoring, secrets', 'Asli server par chalana.', '-', M, 'Aapka server/account chahiye.'],
 ['Billing, payments, receipt OCR', 'Paise, subscription, photo reading.', '-', B, 'Pilot ke baad.'],
]
brief = [
 ['5 kaam: groceries, budget, plan, healthy eating, reminders', 'Chat aur dashboard dono se.', G, 'Pilot mein use karke dekho.'],
 ['Budget-fit planning', 'Cost code se; budget kam ho to "fit nahi" bolta hai.', G, 'Kuch nahi.'],
 ['Price book jo seekhta hai', 'Regional default, phir household ke logged prices.', G, 'Kuch nahi.'],
 ['Local prices ka verify', 'Starter prices assumption hain.', M, 'Real markets se prices check karo.'],
 ['Protein per rupee', 'Ranking chat aur dashboard mein; values approximate.', A, 'Ranking ho gayi. Nutrition expert se values review baaki.'],
 ['WhatsApp: signature, dedupe, consent, 24h window', 'Sab code mein; receipts, retries, rate limit bhi. Mock/fake se tested.', A, 'Code poora. Asli number par chalana baaki.'],
 ['WhatsApp Business account, number, webhook', 'Meta ki taraf ka setup.', M, 'Account + number lo, webhook jodo.'],
 ['Templates (reminder, recap, budget)', 'Window ke baad template ka code tayyar.', M, 'Meta mein 3 templates banao aur approve karwao.'],
 ['AI pipeline (rules -> model -> validate -> save)', 'Strict JSON schema, ek chhota sawal, transaction mein save, har call log. Fake server se tested.', A, 'Asli API key se chalana baaki.'],
 ['API key lagana, eval chalana, cost naapna', 'Model path abhi measure nahi hua.', M, 'ANTHROPIC/OPENAI key lagao, npm run eval chalao.'],
 ['Voice notes', 'Silence/noise reject; STT adapter fake se tested.', A, 'Asli voice notes se test baaki.'],
 ['Reply language', 'Har message English, Hinglish, Hindi, Punjabi mein.', A, 'Native speaker review baaki.'],
 ['Hindi/Punjabi review', 'Maine likhe hain.', M, 'Fluent speaker se check karwao.'],
 ['Data model (saare tables)', 'Budget, contribution, purchase, settlement alag. App paisa move nahi karta.', G, 'Kuch nahi.'],
 ['Security: isolation, private log, export, erase, rate limit, RLS', 'App aur database dono level par.', G, 'Kuch nahi.'],
 ['Privacy policy', 'Draft page ban gaya.', M, 'Lawyer review karwao, contact email daalo.'],
 ['Phase 3: receipt reading, pantry photo', 'Photo par polite "abhi support nahi".', B, 'Pilot ke baad.'],
 ['Evaluation 200+ messages', 'Harness aur 226 synthetic messages; rules ke liye flagged sab sahi.', A, 'Asli messages jodna aur model eval baaki.'],
 ['Asli users ke messages jama karna', 'Interviews aur pilot se.', M, 'Pilot ke saath jama karo.'],
]
blueprint = [
 ['New City Mode', 'Living setup, food budget, plan, shared expenses, Hinglish.', G, 'Pilot mein dekho kya use hota hai.'],
 ['Meal planning', 'Diet, allergy, kitchen, time, region, cook, swap, schedule, pasand-napasand.', A, 'Sab ho gaya; sirf har meal ke servings alag se badalna dashboard mein nahi.'],
 ['Groceries aur pantry', 'Merged list, pantry subtract, expiry alert, ghar ke saman se meal idea.', G, 'Kuch nahi.'],
 ['Money aur fairness', 'Equal split chat mein; custom/percent API mein; void aur audit trail.', A, 'Custom/percent split ka dashboard/chat UI baaki.'],
 ['Tasks', 'Cooking rotation, Sunday reset, recurring, weekly recap, owner swap.', G, 'Kuch nahi.'],
 ['AI assistant', 'Structured actions, confirm only after save, no autonomous purchases.', A, 'Sab ho gaya; "agla kya karein" jaisi general proactive suggestions baaki.'],
 ['Success measures', 'Weekly active, paid share, retention week 1-8, correction rate, AI cost.', G, 'Pilot chalao.'],
 ['Fuller preference learning', 'Abhi sirf rating/swap/cooked signals.', B, 'Pilot ke baad.'],
 ['Member voting, live prices, checkout', 'Jaan-boojh kar nahi (brief mein out of scope).', B, 'Pilot ke baad decide.'],
 ['Business model: billing', 'Subscription/payment nahi bana. Paid/committed record hota hai.', B, 'Pilot ke baad.'],
 ['Pilot mein real payment ya written commitment lena', 'Price Rs 149 sirf hypothesis.', M, 'Pilot mein pucho aur record karo.'],
]
market = [
 ['Segment aur city ka recommendation', 'Shared flat/PG working professionals, Bengaluru.', G, 'Kuch nahi.'],
 ['Segment aur city ka final faisla', 'Meri sirf recommendation hai.', M, 'Aap final karo.'],
 ['Market numbers verify', '34M overseas (MEA Jan 2026 mein ~37.3M), 1.88M students sahi, 76k girawat sahi.', A, 'Search se check hua. MEA original table save karna baaki (Mera kaam).'],
 ['Segment A (city movers) ka size', 'Abhi bhi nahi mila.', M, 'Interviews se andaza lagao.'],
 ['Splitwise India price', 'Sirf USD mila ($2.99-4.99).', M, 'Indian App Store mein dekho.'],
 ['WhatsApp India rates', 'Sources conflict; India rate nahi mila.', M, 'Meta ka rate card kholo.'],
 ['KitchenOS competitor', 'Real hai, Bangalore, cook coordination, free, early-stage.', A, 'Web se check hua. Product khud try karna baaki (Mera kaam).'],
 ['Ollie, AnyList, Samsung Food, PLFS', 'Check nahi hue.', B, 'Web par check karna baaki.'],
 ['Regional recipes aur substitutes', '7 regions, 32 recipes, 16 substitutes.', A, 'Zyada recipes aur expert review baaki.'],
 ['Pilot kit aur go/stop rules', 'Interview script, WhatsApp messages, tracker, metrics endpoint.', G, 'Kuch nahi.'],
 ['Manual pilot chalana', '10-15 interviews, 10-20 households, 4 hafte.', M, 'Hafta 1-4 mein karo.'],
 ['Household web se banana', 'Login par "Start on WhatsApp" (consent WhatsApp mein hi).', G, 'Kuch nahi.'],
 ['Videsh segments (B, C): payments, country rules', 'Currency/time zone set hota hai; baaki nahi.', B, 'India pilot ke baad.'],
 ['Country-wise legal review, support hours', 'Business/legal kaam.', M, 'Launch se pehle.'],
]
mine = [
 ['1', 'Repo ko Private karo (GitHub Settings)', 'Aaj'],
 ['2', 'Manual pilot: 10-15 interviews, 10-20 households (docs/pilot_kit.md)', 'Hafta 1-4'],
 ['3', 'Meta rate card, Splitwise India price, MEA original table, KitchenOS try', 'Is hafte'],
 ['4', 'WhatsApp Business account + number; webhook jodo; 3 templates approve karwao', 'Pilot ke saath'],
 ['5', 'ANTHROPIC/OPENAI key lagao; npm run eval; asli voice notes se test', 'Number milte hi'],
 ['6', 'Recipes aur protein values expert se verify; local prices verify', 'Launch se pehle'],
 ['7', 'Hindi/Punjabi replies fluent speaker se review', 'Launch se pehle'],
 ['8', 'Privacy notice lawyer review; contact email (PRIVACY_CONTACT) daalo', 'Launch se pehle'],
 ['9', 'Hosting par deploy (DEPLOY.md), monitoring, secrets', 'Pilot se pehle'],
 ['10', 'Pilot ke baad go/stop faisla: 50%+ active, 20%+ pay = go; 33% se kam active = stop', 'Hafta 4'],
]

story_tables = []
sections = [
 ('2. Pura software: module by module', ['Module', 'Kya karta hai', 'Kahan (repo mein)', 'Status', 'Ab kya karna hai'], modules, [28, 46, 34, 20, 42], 3),
 ('3. Developer Brief: part by part', ['Part', 'Kya bana', 'Status', 'Ab kya karna hai'], brief, [48, 62, 20, 50], 2),
 ('4. Product Blueprint: part by part', ['Part', 'Kya bana', 'Status', 'Ab kya karna hai'], blueprint, [48, 62, 20, 50], 2),
 ('5. Target Market: part by part', ['Part', 'Kya bana / mila', 'Status', 'Ab kya karna hai'], market, [48, 62, 20, 50], 2),
]
# build tables first so counts are known for the header
glance_t = tbl(['Hissa', 'Status', 'Ek line mein'], glance, [58, 22, 100], 1)
counts.clear()  # the summary table repeats items from the detailed tables, so only count the detailed ones
built = [(t, tbl(h, r, w, s)) for t, h, r, w, s in sections]
total = sum(counts.values())

s = [Paragraph('Shared Living: Project Status (Ho gaya / Aadha bacha / Baaki hai / Mera kaam)', H1),
     Paragraph('Pehli PDF jaisi hi list, par ab har line par ek saaf label. 22 Oct 2026.', SM), Spacer(1, 6),
     Paragraph(f"Kul {total} lines: " + ', '.join(f"<font color='{hexc(COL[k])}'><b>{counts[k]} {k}</b></font>" for k in COL) + '.', P), Spacer(1, 4)]
legend = [[status_cell(G), Paragraph('Poora ho gaya (code aur tests mein verify).', C)],
          [status_cell(A), Paragraph('Kuch hissa ho gaya, kuch bacha. Bacha hua kya hai wo "Ab kya karna hai" mein likha hai.', C)],
          [status_cell(B), Paragraph('Abhi bana hi nahi (pilot ke baad ya jaan-boojh kar chhoda).', C)],
          [status_cell(M), Paragraph('Sirf aap kar sakte ho: account, number, expert/lawyer, pilot, server.', C)]]
lt = Table(legend, colWidths=[28 * mm, 150 * mm]); lt.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 2), ('BOTTOMPADDING', (0, 0), (-1, -1), 2)]))
s += [lt, Paragraph('1. Ek nazar mein', H2), glance_t]
for i, (title, t) in enumerate(built):
    s += ([PageBreak()] if i == 0 else []) + [Paragraph(title, H2), t]
mine_rows = [[Paragraph(n, CB), Paragraph(k, C), Paragraph(w, C)] for n, k, w in mine]
mt = Table([[Paragraph(h, TH) for h in ['#', 'Mera kaam (aapka)', 'Kab']]] + mine_rows, colWidths=[10 * 1.27 * mm, 130 * 1.27 * mm, 40 * 1.27 * mm], repeatRows=1)
mt.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, 0), COL[M]), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('GRID', (0, 0), (-1, -1), 0.4, LINE), ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f6f5f1')]), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
s += [Paragraph('6. Mera kaam: aapki list (is order mein)', H2), mt,
      Spacer(1, 8), Paragraph('Saare numbers, prices aur competitor claims assumptions/secondary sources par hain. Details: STATUS.md, PILOT_DECISION.md, DEPLOY.md (repo mein).', SM)]
SimpleDocTemplate(out, pagesize=landscape(A4), leftMargin=12 * mm, rightMargin=12 * mm, topMargin=12 * mm, bottomMargin=12 * mm, title='Shared Living: Project Status', author='Claude').build(s)
print('wrote', os.path.abspath(out), dict(counts))
