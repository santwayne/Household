# Manual Pilot Kit: Shared Living, Meals & Money (WhatsApp)

Based on: Product Blueprint, Target Market PDF, Developer Brief.
Status: planning document. Saare numbers aur prices assumptions hain, verify karne hain.

---

## 1. Pilot ka setup

| Cheez | Decision |
|---|---|
| Segment | Shared flat / PG mein rehne wale working professionals (India). Students baad mein. |
| City | EK city, jahan aap 20 households tak khud pahunch sako: [city yahan likho] |
| Households | 10-20 |
| Duration | 4 hafte |
| Bot | Koi bot nahi. Ek insaan WhatsApp par reply karta hai, hisaab sheet se. |
| Price to test | ~Rs 149/month (hypothesis, sirf test ke liye) |

### Go / Stop rules (PDF ke proposals)
| Go | Stop ya rethink |
|---|---|
| Hafta 3 mein >=50% households active | <33% active |
| >=20% pay ya clearly commit karein | Lagbhag koi pay na kare |
| Zyada households flatmate ke invite se aayein | Asli dard kuch aur nikle (jaise sirf bill split) |

---

## 2. Interview script (Hafta 1, 10-15 log)

**Screening (pehle poochho):**
- Aap kis shehar mein rehte ho? Kitne log flat/PG mein ho?
- Khana ghar par banta hai ya bahar se aata hai?
- Kharcha aapas mein share hota hai?
(Agar akela ho aur bahar hi khata ho, to ye pilot ka target nahi.)

**Main sawal (PDF se):**
1. Roz kya banega, ye kaise decide hota hai? Flat mein kaun decide karta hai?
2. Grocery aur shared kharcha abhi kaise track karte ho? Kya galat ho jata hai?
3. Mahine mein khane par kitna kharch hota hai? Delivery / bahar khane par kitna?
4. Ghar ka kaunsa khana yahan banana sabse mushkil hai? Kaunsi cheezein nahi milti?
5. Kya aap is kaam ke liye WhatsApp assistant use karoge? Ya app pasand hai? Kyun?
6. Iske liye mahine ka kitna doge? Kis price par seedha "nahi" bologe?
7. Kya flatmates ko invite karoge? Kya rok sakta hai?

**Notes mein likho:** unka asli shabd, current tool (Splitwise/notes/group), top 1 dard, price jo bola.
**Sawal 6 ka jawab "saboot" nahi hai.** Actual commitment hafta 3 mein dekhenge.

---

## 3. WhatsApp pilot messages (manual)

### Rules jo operator ko follow karne hain
- Pehle user message kare ya invite link se opt-in kare, tabhi aap unhe message karo. Sirf phone number likh dena consent nahi hai.
- User ki last message ke 24 ghante ke andar free reply. Uske baad reminder ke liye approved template lagega (paid; Meta rate card dekho).
- Reply usi script/language mein do jisme user ne likha (Roman Hinglish ka jawab Roman Hinglish).
- Hisaab (kitna bacha, kaun kisko dega) sheet mein calculate karo, andaze se nahi.
- "Save ho gaya" tabhi bolo jab sheet mein sach mein likh liya ho.
- Kisi ka personal meal log doosre ko mat dikhao.
- Health/medical salah mat do.
- Kisi normal WhatsApp group ko automate mat karo. Sab private chat mein.
- STOP likhne par turant band karo aur data delete karne ka option do.

### Invite (flatmate ko bhejne ke liye)
> Hi! [Naam] ne aapko ek chhota pilot join karne ko bola hai: flat ka khana, grocery aur shared kharcha ek hi jagah, WhatsApp par. Join karne ke liye is number par "JOIN" likho. Kabhi bhi "STOP" likh kar bahar aa sakte ho.

### Welcome + consent
> Namaste! Main [Naam] hoon, is pilot ki team se. Aapka message milte hi main yahan reply kar sakta hoon. Hum aapka naam, flat ka grocery/kharcha aur aapke bheje messages save karenge, sirf pilot ke liye. STOP likhoge to band, aur data delete bhi kar denge. Aage badhein? (Haan / Nahi)

### Setup questions
> 3 chhote sawal: 1) Flat mein kitne log? 2) Mahine ka food budget kitna rakhna hai (poore flat ka)? 3) Veg / non-veg / koi allergy?

### Din-to-din (user message -> aapka reply)
| User likhe | Aap kya karo | Reply |
|---|---|---|
| "Aman ne 650 ka saman liya" | Sheet mein purchase, payer Aman, Rs 650 | "Likh liya: Aman, Rs 650. Equal split theek hai? Is mahine bacha: Rs X." |
| "milk aur paneer add karo" | List mein 2 items | "List mein add: milk, paneer. Quantity batao?" |
| "kitna bacha hai?" | Sheet se budget nikalo | "Budget Rs X mein se Rs Y kharch, Rs Z bacha." |
| "is hafte ka plan, budget 3000, 2 log, veg" | Plan banao, cost haath se jodo | Plan + estimated cost + shopping list |
| Voice note | Sun ke likho, silent/noise ho to ignore | Text jaisa hi handle |
| "kisko kitna dena hai" | Sheet se settlement nikalo | "Raj -> Aman: Rs 210. (Sirf record hai, paisa move nahi hota.)" |

### Weekly plan template (Hafta 2-3)
> Is hafte ka plan ([budget], [kitne log], [veg/non-veg]):
> Mon: ...  |  Tue: ...  |  ...
> Andaza cost: Rs ___
> Shopping list: ...
> Kisi din ka khana badalna ho to bolo, sirf wahi change karunga.

### Reminder (sirf khane se related)
> Kal rajma banana hai to aaj raat soak kar dena.

### Hafta 3 paid offer
> Pilot ke 2 hafte ho gaye. Agar ye aapke kaam aa raha hai, to aage ye Rs 149/month mein chalega (flat ka ek plan). Kya aap abhi jodna chahoge? Haan likho, main payment link bhejta hoon. Nahi bhi bolo to koi baat nahi, bas wajah bata do.

### Opt-out
> Theek hai, band kar diya. Aapka data delete karna ho to "DELETE" likh do.

---

## 4. 4-hafte ka schedule

| Hafta | Kaam | Output |
|---|---|---|
| 1 | 10-15 interviews | Top pain, current tools, delivery spend |
| 2 | 10-20 households WhatsApp par jodo, concierge reply | Asli messages, pehla usage data |
| 3 | Weekly plans + budget tracking, paid offer | Kaun active, kaun pay/commit |
| 4 | Numbers review | Go / segment badlo / stop |

---

## 5. Tracker (pilot_tracker.csv bhi bana hai)

Har household ke liye: household_id, city, flat_type, members, joined_via (founder / flatmate invite), consent_date, week1..week4 active (Y/N), messages_count, purchases_logged, plan_followed (Y/N), paid_or_committed (Y/N), price_said_yes_to, churn_reason, notes.

**Hafta 4 mein nikalo:**
- Active % (hafta 3 mein)
- Paid/commit %
- Invite se aaye % (viral signal)
- Sabse zyada use hui cheez (grocery / kharcha / plan)
- Corrections count (kitni baar galat samjha)

---

## 6. Verify karna baaki (PDFs ke hisaab se)
- India ke andar flat/PG mein rehne wale young logon ka size (PDF ko nahi mila).
- MEA ke official country-wise numbers (sources conflict karte hain).
- Splitwise Pro price (app mein dobara dekho).
- KitchenOS, Ollie, Splitwise ke actual features.
- Meta WhatsApp template rates aur Groups API rules.
- LLM API cost per household (build se pehle).
- Recipes aur nutrition ka expert review.

## 7. Pilot ke baad hi build
Agar Go ho: Developer Brief ka Phase 1 (Hinglish/English chat, groceries, kharcha, reminders). Acceptance: 200-message test set par >=90% sahi, "kitna bacha" hamesha ledger se match, webhook retry par double entry nahi.
