// Generates eval/messages200.json: 200 SYNTHETIC test messages with the structured result we expect.
// These are written by us, not collected from users. The real test set must come from the discovery interviews and pilot.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

type Exp = { intent: string; amount?: number; payer?: string | null; member?: string | null; from?: string | null; to?: string | null; items?: string[]; budget?: number | null; people?: number | null; days?: number | null; diet?: string | null; slot?: string; day_name?: string | null; text?: string };
type Msg = { id: number; text: string; lang: string; kind: string; needs_llm: boolean; expected: Exp };

const out: Msg[] = [];
let id = 0;
const add = (text: string, lang: string, kind: string, expected: Exp, needs_llm = false) => out.push({ id: ++id, text, lang, kind, needs_llm, expected });
const names = ['Aman', 'Raj', 'Priya', 'Simran', 'Rahul', 'Neha', 'Gurpreet', 'Karan'];

// purchases: Roman Hinglish
const hp: [string, number, string[]][] = [['saman', 650, []], ['sabzi', 240, ['sabzi']], ['doodh', 112, ['doodh']], ['atta aur chawal', 980, ['atta', 'chawal']], ['ration', 1500, []], ['paneer', 380, ['paneer']], ['fruits', 300, ['fruits']], ['anda aur bread', 145, ['anda', 'bread']], ['grocery', 2200, []], ['dal', 420, ['dal']]];
hp.forEach(([w, a, items], i) => { const n = names[i % names.length]; add(`${n} ne ${a} ka ${w} liya`, 'hinglish', 'purchase', { intent: 'record_purchase', amount: a, payer: n.toLowerCase(), items }); });
['laya', 'kharida', 'le liya'].forEach((v, i) => add(`${names[i]} ne 500 ka saman ${v}`, 'hinglish', 'purchase', { intent: 'record_purchase', amount: 500, payer: names[i].toLowerCase(), items: [] }));
add('maine 450 ki sabzi li', 'hinglish', 'purchase', { intent: 'record_purchase', amount: 450, payer: null, items: ['sabzi'] });
add('maine 300 ka saman liya', 'hinglish', 'purchase', { intent: 'record_purchase', amount: 300, payer: null, items: [] });
add('Rahul ne 1.5k ka saman liya', 'hinglish', 'purchase', { intent: 'record_purchase', amount: 1500, payer: 'rahul', items: [] });
add('Aman ne ₹720 ka saman liya', 'hinglish', 'purchase', { intent: 'record_purchase', amount: 720, payer: 'aman', items: [] });
add('Priya ne rs 260 ki sabzi kharidi', 'hinglish', 'purchase', { intent: 'record_purchase', amount: 260, payer: 'priya', items: ['sabzi'] }, true);
add('650 ka saman liya', 'hinglish', 'purchase', { intent: 'record_purchase', amount: 650, payer: null, items: [] });
// purchases: English
[['Aman paid 650 for groceries', 650, 'aman', []], ['Raj spent 300 on veggies', 300, 'raj', ['veggies']], ['Priya bought milk for 60', 60, 'priya', ['milk']], ['I spent 450 on groceries', 450, 'i', []], ['Neha paid 1200 for rice and dal', 1200, 'neha', ['rice', 'dal']], ['spent 800 on fruits', 800, null, ['fruits']], ['Karan paid 90 for bread', 90, 'karan', ['bread']], ['bought paneer for 250', 250, null, ['paneer']]].forEach(([t, a, p, it]) => add(t as string, 'en', 'purchase', { intent: 'record_purchase', amount: a as number, payer: p === 'i' ? null : (p as string | null), items: it as string[] }));
// purchases: Devanagari
add('अमन ने 650 का सामान लिया', 'hi', 'purchase', { intent: 'record_purchase', amount: 650, payer: 'अमन', items: [] });
add('राज ने 300 की सब्ज़ी खरीदी', 'hi', 'purchase', { intent: 'record_purchase', amount: 300, payer: 'राज', items: ['सब्ज़ी'] }, true);
add('मैंने 500 का सामान लिया', 'hi', 'purchase', { intent: 'record_purchase', amount: 500, payer: null, items: [] });

// contributions
[['Raj ne 1000 diye', 1000, 'raj'], ['Priya ne 500 de diye', 500, 'priya'], ['Aman ne 2000 daale', 2000, 'aman'], ['Simran ne 1500 jama kiye', 1500, 'simran'], ['Rahul ne 750 diye', 750, 'rahul'], ['Neha ne 1k diye', 1000, 'neha']].forEach(([t, a, m]) => add(t as string, 'hinglish', 'contribution', { intent: 'record_contribution', amount: a as number, member: m as string }));
[['Raj put in 1000', 1000, 'raj'], ['Priya added 500 to the kitty', 500, 'priya'], ['Aman contributed 2000', 2000, 'aman'], ['Karan chipped in 600', 600, 'karan']].forEach(([t, a, m]) => add(t as string, 'en', 'contribution', { intent: 'record_contribution', amount: a as number, member: m as string }));
add('Raj ने 1000 दिए', 'hi', 'contribution', { intent: 'record_contribution', amount: 1000, member: 'raj' });
add('Gurpreet ne kitty mein 800 daale', 'hinglish', 'contribution', { intent: 'record_contribution', amount: 800, member: 'gurpreet' });

// settlements
[['Priya ne Aman ko 200 de diye', 200, 'priya', 'aman'], ['Raj ne Simran ko 350 diye', 350, 'raj', 'simran'], ['Neha ne Rahul ko 120 bhej diye', 120, 'neha', 'rahul'], ['Karan ne Aman ko 450 chuka diye', 450, 'karan', 'aman']].forEach(([t, a, f, to]) => add(t as string, 'hinglish', 'settlement', { intent: 'record_settlement', amount: a as number, from: f as string, to: to as string }));
[['Raj paid Aman 300', 300, 'raj', 'aman'], ['Priya sent Neha 150', 150, 'priya', 'neha'], ['Simran paid back Rahul 400', 400, 'simran', 'rahul']].forEach(([t, a, f, to]) => add(t as string, 'en', 'settlement', { intent: 'record_settlement', amount: a as number, from: f as string, to: to as string }));
add('maine Aman ko 250 de diye', 'hinglish', 'settlement', { intent: 'record_settlement', amount: 250, from: null, to: 'aman' });

// add items
[['milk aur paneer add karo', ['milk', 'paneer']], ['doodh add karo', ['doodh']], ['atta, chawal, dal add kar do', ['atta', 'chawal', 'dal']], ['tamatar aur pyaz list mein daalo', ['tamatar', 'pyaz']], ['eggs add karo', ['eggs']], ['2 kg rice add karo', ['2 kg rice']], ['paneer jodo', ['paneer']], ['bread chahiye', ['bread']], ['ghee aur namak likh do', ['ghee', 'namak']], ['chai patti add kar do', ['chai patti']], ['aloo, gobi, matar add karo', ['aloo', 'gobi', 'matar']], ['curd khatam ho gaya', ['curd']], ['1 litre milk add karo', ['1 litre milk']], ['oil aur sugar daal do', ['oil', 'sugar']]].forEach(([t, it]) => add(t as string, 'hinglish', 'add_items', { intent: 'add_items', items: it as string[] }));
[['add milk', ['milk']], ['add milk and eggs', ['milk', 'eggs']], ['add rice, dal and oil to the list', ['rice', 'dal', 'oil']], ['we need onions', ['onions']], ['please add paneer', ['paneer']], ['add 2 kg atta to the shopping list', ['2 kg atta']]].forEach(([t, it]) => add(t as string, 'en', 'add_items', { intent: 'add_items', items: it as string[] }));
add('दूध जोड़ो', 'hi', 'add_items', { intent: 'add_items', items: ['दूध'] });
add('दूध और पनीर add करो', 'hi', 'add_items', { intent: 'add_items', items: ['दूध', 'पनीर'] });

// bought / remove / list
[['milk le liya', ['milk']], ['paneer le liya', ['paneer']], ['atta aur chawal le aaya', ['atta', 'chawal']], ['sabzi aa gayi', ['sabzi']], ['eggs mil gaye', ['eggs']]].forEach(([t, it]) => add(t as string, 'hinglish', 'mark_bought', { intent: 'mark_bought', items: it as string[] }, t === 'eggs mil gaye'));
[['bought milk', ['milk']], ['got bread', ['bread']], ['picked up eggs', ['eggs']]].forEach(([t, it]) => add(t as string, 'en', 'mark_bought', { intent: 'mark_bought', items: it as string[] }));
[['remove milk', ['milk']], ['paneer hata do', ['paneer']], ['bread nahi chahiye', ['bread']], ['delete eggs', ['eggs']], ['chai patti hatao', ['chai patti']]].forEach(([t, it]) => add(t as string, 'hinglish', 'remove_items', { intent: 'remove_items', items: it as string[] }));
['list dikhao', 'shopping list', 'show list', "what's on the list", 'list mein kya hai', 'grocery list', 'shopping list dikhao'].forEach(t => add(t, 'hinglish', 'show_list', { intent: 'show_list' }));

// budget / balances
['kitna bacha hai?', 'kitna bacha', 'budget kitna bacha hai', 'kitne paise bache', 'how much is left?', 'how much left', 'remaining budget', 'budget left', 'कितना बचा', 'ਕਿੰਨਾ ਬਚਿਆ', 'bacha kitna hai', 'abhi tak kitna kharch hua'].forEach(t => add(t, /[ऀ-ॿ]/.test(t) ? 'hi' : /[਀-੿]/.test(t) ? 'pa' : 'hinglish', 'budget_remaining', { intent: 'budget_remaining' }, t === 'abhi tak kitna kharch hua'));
['kisko kitna dena hai?', 'kaun kisko dega', 'who owes whom', 'who owes what', 'hisaab batao', 'balances', 'kitna dena hai'].forEach(t => add(t, 'hinglish', 'balances', { intent: 'show_balances' }));
[['budget 6000', 6000], ['monthly budget 5000', 5000], ['is mahine ka budget 7000', 7000], ['budget set karo 4500', 4500], ['set budget to 8000', 8000], ['budget 5k', 5000]].forEach(([t, b]) => add(t as string, 'hinglish', 'set_budget', { intent: 'set_budget', budget: b as number }, t === 'budget set karo 4500' || t === 'is mahine ka budget 7000'));

// plans
[['is hafte ka plan, budget 3000, 2 log, veg', 3000, 2, 7, 'veg'], ['weekly plan budget 2000 for 3 people', 2000, 3, 7, null], ['plan for this week, budget 1500, 1 person, veg', 1500, 1, 7, 'veg'], ['hafte ka plan budget 4000 4 log non-veg', 4000, 4, 7, 'nonveg'], ['5 din ka plan budget 1200 2 log', 1200, 2, 5, null], ['meal plan budget 2500 2 log egg', 2500, 2, null, 'egg'], ['plan banao budget 1800', 1800, null, null, null], ['is hafte ka plan, budget 3500, 3 log, vegan', 3500, 3, 7, 'vegan'], ['weekly plan under 2200, 2 people, veg', 2200, 2, 7, 'veg'], ['khane ka plan budget 900 2 log veg', 900, 2, null, 'veg']].forEach(([t, b, p, d, di], i) => add(t as string, i % 2 ? 'en' : 'hinglish', 'plan_week', { intent: 'plan_week', budget: b as number, people: p as number | null, days: d as number | null, diet: di as string | null }, t === 'plan banao budget 1800'));
['plan dikhao', 'show plan', 'current plan', 'plan kya hai'].forEach(t => add(t, 'hinglish', 'show_plan', { intent: 'show_plan' }));
['aaj kya banega', "what's for dinner today", 'aaj ka menu', "today's meals", 'aaj kya banana hai'].forEach(t => add(t, 'hinglish', 'show_today', { intent: 'show_today' }));
[['friday dinner badlo', 'dinner', 'friday'], ['swap monday lunch', 'lunch', 'monday'], ['kal ka lunch badlo', 'lunch', 'tomorrow'], ['change saturday dinner', 'dinner', 'saturday'], ['aaj ka dinner badal do', 'dinner', 'today'], ['replace sunday breakfast', 'breakfast', 'sunday']].forEach(([t, s, d]) => add(t, 'hinglish', 'swap_meal', { intent: 'swap_meal', slot: s, day_name: d }));

// meals / health / protein
[['dal chawal khaya', 'dal chawal'], ['maine rajma chawal khaya', 'rajma chawal'], ['aaj paneer sabzi roti khaya', 'paneer sabzi roti'], ['had poha', 'poha'], ['ate khichdi', 'khichdi'], ['pizza order kiya', 'pizza'], ['biryani zomato se mangaya', 'biryani zomato se'], ['aaj bahar se burger khaya', 'bahar se burger']].forEach(([t, w]) => add(t, 'hinglish', 'log_meal', { intent: 'log_meal' }, t === 'biryani zomato se mangaya'));
['how am i eating', 'health summary', 'healthy eating', 'meri healthy eating'].forEach(t => add(t, 'en', 'weekly_balance', { intent: 'weekly_balance' }));
['sasta protein', 'cheap protein', 'protein per rupee', 'sabse sasta protein kya hai', 'best protein'].forEach(t => add(t, 'hinglish', 'protein_rank', { intent: 'protein_rank' }, t === 'sabse sasta protein kya hai'));

// reminders (food-only), substitutions
['aaj raat rajma bhigona yaad dilana', 'kal subah dahi jamana yaad dilana', 'remind me tonight to soak chole', 'tomorrow morning remind me to buy milk', 'kal shaam 6 baje atta gundhna yaad dilana', 'remind me at 7pm to start dal', 'aaj shaam khana banana yaad dilana', 'kal subah 8 baje paratha banana yaad dilana'].forEach(t => add(t, 'hinglish', 'reminder', { intent: 'create_reminder' }));
['reminders', 'mere reminders', 'my reminders'].forEach(t => add(t, 'hinglish', 'reminder', { intent: 'list_reminders' }));
['curry leaves nahi milte', 'paneer nahi mil raha', 'no curry leaves here', 'substitute for ghee', 'methi nahi mili', 'tamarind ka substitute', 'toor dal nahi milti', 'replace besan'].forEach(t => add(t, 'hinglish', 'substitution', { intent: 'substitution' }));

// control
for (const [t, i] of [['stop', 'stop'], ['STOP', 'stop'], ['start', 'start'], ['help', 'help'], ['undo', 'undo'], ['galti hui', 'undo'], ['dashboard', 'dashboard'], ['invite', 'invite'], ['yes', 'yes'], ['haan', 'yes'], ['no', 'no'], ['nahi', 'no'], ['hi', 'greeting'], ['delete my data', 'delete_data']] as [string, string][]) add(t, 'hinglish', 'control', { intent: i });

// pantry, expiry, custom split (added in the completion pass)
[['ghar mein 2 kg chawal hai', 'set_pantry'], ['pantry mein 500 g paneer hai', 'set_pantry'], ['we have 1 kg atta', 'set_pantry'], ['pantry', 'show_pantry'], ['show pantry', 'show_pantry'], ['kya expire ho raha hai', 'expiring'], ["what's expiring", 'expiring'], ['ghar ke saman se kya banaun', 'cook_from_pantry'], ['what can i cook from the pantry', 'cook_from_pantry'], ['pantry se kya bana sakte hain', 'cook_from_pantry']].forEach(([t, i]) => add(t, 'hinglish', 'pantry', { intent: i }));
[['Aman ne 600 ka saman liya, sirf Aman aur Raj ke liye', 600, 'aman'], ['Raj ne 90 ka doodh liya Aman aur Priya ke beech', 90, 'raj'], ['Priya paid 500 for groceries, split between Priya and Neha', 500, 'priya'], ['Rahul ne 300 ki sabzi li, sirf Rahul aur Karan mein', 300, 'rahul']].forEach(([t, a, p]) => add(t as string, 'hinglish', 'split', { intent: 'record_purchase', amount: a as number, payer: p as string }));

// suggestions, custom amounts and percentages (second completion pass)
['suggestions', 'kya karna chahiye', 'what should we do next', 'ab kya karein', 'next kya'].forEach(t => add(t, 'hinglish', 'suggestions', { intent: 'suggestions' }));
[['Aman ne 900 ka saman liya Aman 500 Raj 400', 900, 'aman'], ['Priya paid 600 for groceries Priya 200 Neha 400', 600, 'priya'], ['Raj ne 1200 ki sabzi li Raj 700, Aman 500', 1200, 'raj'], ['Aman ne 1000 ka saman liya Aman 70% Raj 30%', 1000, 'aman'], ['Neha paid 800 for rice Neha 50% Rahul 50%', 800, 'neha'], ['Karan ne 450 ka doodh liya Karan 60% Simran 40%', 450, 'karan']].forEach(([t, a, p]) => add(t as string, 'hinglish', 'split', { intent: 'record_purchase', amount: a as number, payer: p as string }));

// free-form messages that need the model (number words, narrative, mixed). Expected values are what a human would record.
const llm: [string, Exp][] = [
  ['raj ne kal sabzi mandi se uthayi thi chaar sau ki', { intent: 'record_purchase', amount: 400, payer: 'raj' }],
  ['aman ne aaj chhe sau pachaas ka saman le aaya', { intent: 'record_purchase', amount: 650, payer: 'aman' }],
  ['bhai maine abhi dukaan se doodh aur dahi liya sau pachas mein', { intent: 'record_purchase', amount: 150, payer: null }],
  ['priya ne hazaar rupaye kitty mein rakhe', { intent: 'record_contribution', amount: 1000, member: 'priya' }],
  ['kal ke liye thoda sa aloo aur tamatar mangwana hai', { intent: 'add_items', items: ['aloo', 'tamatar'] }],
  ['ghar mein namak khatam hai aur cheeni bhi', { intent: 'add_items', items: ['namak', 'cheeni'] }],
  ['is mahine ab tak kitne paise gaye khane pe', { intent: 'budget_remaining' }],
  ['aman ko mujhe kitne dene hain pichle hisaab ke', { intent: 'show_balances' }],
  ['can you make a veg plan for the week, we are 3 and have about 2000', { intent: 'plan_week', budget: 2000, people: 3, diet: 'veg' }],
  ['thursday wala dinner pasand nahi aaya kuch aur karo', { intent: 'swap_meal', slot: 'dinner', day_name: 'thursday' }],
  ['kal subah jaldi uthna hai isliye raat ko dal bhigo dena yaad dila dena', { intent: 'create_reminder' }],
  ['aaj lunch mein maine bas maggi khayi', { intent: 'log_meal' }],
  ['mera pichla entry galat tha usko hata do', { intent: 'undo' }],
  ['raj ne mujhe do sau diye wapas', { intent: 'record_settlement', amount: 200, to: null }],
  ['udhaar chukta karna hai simran ko 500', { intent: 'record_settlement', amount: 500, to: 'simran' }],
  ['bhai ye dashboard ka link bhej na', { intent: 'dashboard' }],
  ['ਮੈਂ 300 ਦੀ ਸਬਜ਼ੀ ਲਈ', { intent: 'record_purchase', amount: 300, payer: null }],
  ['ਦੁੱਧ ਤੇ ਪਨੀਰ ਲਿਸਟ ਵਿੱਚ ਪਾ ਦਿਓ', { intent: 'add_items', items: ['ਦੁੱਧ', 'ਪਨੀਰ'] }],
  ['अमन ने सब्ज़ी के पाँच सौ दिए', { intent: 'record_purchase', amount: 500, payer: 'अमन' }],
  ['hey, what can we cook that is cheap with protein tonight?', { intent: 'show_today' }],
];
llm.forEach(([t, e]) => add(t, /[਀-੿]/.test(t) ? 'pa' : /[ऀ-ॿ]/.test(t) ? 'hi' : 'hinglish', 'free_form', e, true));

const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, 'messages200.json'), JSON.stringify(out, null, 1));
console.log('wrote', out.length, 'messages');
