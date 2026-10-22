import type { Action, When } from './schema.js';

// Cheap deterministic rules first (Developer Brief section 5, step 3). Returns null when the AI should look at it.
const NAME = String.raw`[\p{L}][\p{L}.'’-]*`;
const AMT = String.raw`((?:₹|rs\.?\s*|inr\s*)?\d[\d,]*(?:\.\d+)?\s*(?:k|hazaar|hazar|हज़ार|हजार)?(?:\s*(?:rs\.?|rupees|rupaye|rupay|rupiye|रुपये|रुपए|ਰੁਪਏ|inr|/-))?)`;
const FIRST_PERSON = new Set(['maine', 'mene', 'mainey', 'main', 'i', 'me', 'mai', 'मैंने', 'ਮੈਂ', 'we', 'hamne', 'humne', 'hum']);

export function parseAmount(raw: string): number | null {
  const s = raw.toLowerCase().replace(/[₹,]/g, '').replace(/rs\.?|inr|rupees|rupaye|rupay|rupiye|रुपये|रुपए|ਰੁਪਏ|\/-/g, '').trim();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(k|hazaar|hazar|हज़ार|हजार)?$/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] ? 1000 : 1);
  return n > 0 && isFinite(n) ? n : null;
}

const GENERIC = new Set(['saman', 'samaan', 'सामान', 'ਸਮਾਨ', 'grocery', 'groceries', 'kirana', 'ration', 'things', 'stuff', 'shopping', 'items', 'kuch', 'sab', 'ghar ka saman', 'ghar ka samaan']);

export function splitItems(s: string): string[] {
  return s
    .replace(/\b(?:to )?(?:the |our )?(?:shopping |grocery )?list(?: (?:mein|me|main))?\b/g, ' ')
    .split(/\s*(?:,|;|\baur\b|\band\b|&|\+|और|ਤੇ|\bte\b)\s*/i)
    .map(x => x.trim().replace(/^(?:the|a|an|ek|thoda|thodi)\s+/i, ''))
    .filter(x => x && !GENERIC.has(x));
}

function normalize(t: string): string {
  return t.normalize('NFC').toLowerCase().replace(/[“”"]/g, '').replace(/\s+/g, ' ').replace(/[.!?।]+$/u, '').trim();
}

const who = (w: string | undefined): string | null => (!w || FIRST_PERSON.has(w) ? null : w);

const DAYS: Record<string, string> = { monday: 'monday', mon: 'monday', somvar: 'monday', tuesday: 'tuesday', tue: 'tuesday', mangalvar: 'tuesday', wednesday: 'wednesday', wed: 'wednesday', budhvar: 'wednesday', thursday: 'thursday', thu: 'thursday', guruvar: 'thursday', friday: 'friday', fri: 'friday', shukravar: 'friday', saturday: 'saturday', sat: 'saturday', shanivar: 'saturday', sunday: 'sunday', sun: 'sunday', ravivar: 'sunday', kal: 'tomorrow', tomorrow: 'tomorrow', aaj: 'today', today: 'today' };

export function parseWhen(t: string): { when: When | null; rest: string } {
  let rest = ` ${t} `;
  const when: When = {};
  const strip = (re: RegExp) => { rest = rest.replace(re, ' '); };
  if (/\b(?:parso)\b/.test(rest)) { when.day = 'day_after'; strip(/\bparso\b/); }
  else if (/\b(?:kal|tomorrow|कल)\b/.test(rest)) { when.day = 'tomorrow'; strip(/\b(?:kal|tomorrow)\b|कल/); }
  else if (/\b(?:aaj|today|tonight|आज)\b/.test(rest)) { when.day = 'today'; if (/\btonight\b/.test(rest)) when.part = 'night'; strip(/\b(?:aaj|today|tonight)\b|आज/); }
  const part = rest.match(/\b(subah|morning|dopahar|afternoon|shaam|evening|raat|night)\b/);
  if (part) { when.part = ({ subah: 'morning', morning: 'morning', dopahar: 'afternoon', afternoon: 'afternoon', shaam: 'evening', evening: 'evening', raat: 'night', night: 'night' } as const)[part[1] as 'subah']; strip(/\b(subah|morning|dopahar|afternoon|shaam|evening|raat|night)\b/); }
  const tm = rest.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|bje)\b/);
  if (tm) {
    let h = Number(tm[1]); const mi = Number(tm[2] ?? 0);
    if (tm[3] === 'pm' && h < 12) h += 12;
    if (tm[3] === 'am' && h === 12) h = 0;
    if (tm[3] === 'baje' || tm[3] === 'bje') { if (when.part === 'night' || when.part === 'evening' || when.part === 'afternoon') { if (h < 12) h += 12; } }
    if (h <= 23) { when.hour = h; when.minute = mi; }
    strip(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|baje|bje)\b/);
  }
  const any = when.day || when.part || when.hour != null;
  return { when: any ? when : null, rest: rest.replace(/\s+/g, ' ').trim() };
}

type Rule = (t: string, raw: string) => Action | null;
const A = (a: Partial<Action> & { intent: Action['intent'] }): Action => ({ confidence: 1, needs_confirmation: false, ...a }) as Action;
const re = (src: string, flags = 'iu') => new RegExp(src, flags);

const BOUGHT_VERBS = String.raw`(?:le liya|le liye|le li|liya|lia|liye|li|lee|laayi|layi|kharida|khareeda|kharide|laya|le aaya|le aya|le aayi|le aaye|lekar aaya|खरीदा|लिया|लाया|ले लिया|ਲਿਆ|ਖਰੀਦਿਆ)`;
const PURCHASE: RegExp[] = [
  re(String.raw`^(?<who>${NAME}) (?:ne|ने|ਨੇ) ${AMT}\s*(?:ka|ke|ki|का|के|की|ਦਾ|ਦੇ)\s*(?<what>.*?)\s*${BOUGHT_VERBS}$`),
  re(String.raw`^${AMT}\s*(?:ka|ke|ki|का|के|की)\s*(?<what>.*?)\s*${BOUGHT_VERBS}$`),
  re(String.raw`^(?<who>maine|mene|mainey|main|hamne|humne|मैंने) ${AMT}\s*(?:ka|ke|ki|का|के|की)\s*(?<what>.*?)\s*${BOUGHT_VERBS}$`),
  re(String.raw`^(?<who>${NAME})\s+(?:paid|spent|bought|got|purchased)\s+(?:for\s+)?${AMT}\s*(?:for|on|of|worth)?\s*(?<what>.*)$`),
  re(String.raw`^(?:i |we )?(?:bought|got|purchased) (?<what>.+?) (?:for|worth) ${AMT}$`),
  re(String.raw`^(?:spent|kharch kiye|kharch kiya)\s+${AMT}\s*(?:on|for|par|pe)?\s*(?<what>.*)$`),
];

const CONTRIB: RegExp[] = [
  re(String.raw`^(?<who>${NAME}) (?:ne|ने|ਨੇ) ${AMT}\s*(?:diye|diya|de diye|de diya|jama kiye|jama kiya|jama karwaye|daale|dale|daal diye|dala|daale hain|contribute kiye|contribute kiya|दिए|दिये|ਦਿੱਤੇ|ਪਾਏ)(?:\s+(?:kitty|pool|fund|budget)(?: mein| me)?)?$`),
  re(String.raw`^(?<who>${NAME}) (?:ne )?(?:kitty|pool|fund) (?:mein|me) ${AMT}\s*(?:daale|dale|daal diye|diye|jama kiye)$`),
  re(String.raw`^(?<who>${NAME})\s+(?:added|put in|put|contributed|gave|deposited|chipped in)\s+${AMT}(?:\s+(?:to|in|into)\s+(?:the\s+)?(?:kitty|pool|fund|budget))?$`),
];

const SETTLE: RegExp[] = [
  re(String.raw`^(?<from>${NAME}) (?:ne )?(?<to>${NAME}) (?:ko|को|ਨੂੰ) ${AMT}\s*(?:de diye|de diya|diye|diya|bhej diye|bhej diya|return kiye|chuka diye|chuka diya|वापस किए)$`),
  re(String.raw`^(?<from>${NAME})\s+(?:paid|sent|gave|returned|settled with|paid back)\s+(?<to>${NAME})\s+${AMT}$`),
  re(String.raw`^(?:settled|settle)\s+${AMT}\s+(?:with|to)\s+(?<to>${NAME})$`),
];

const ADD_TAIL = String.raw`(?:add (?:karo|kar do|kar de|kro|krdo|kardo|kar dena|krna)|daal do|daalo|dalo|daal dena|jodo|jod do|likh do|likho|chahiye|mangwana hai|lena hai|lana hai|khatam ho gaya|khatam ho gayi|khatam hai|जोड़ो|जोड़ दो|add करो|ऐड करो|ਜੋੜੋ|ਜੋੜ ਦਿਓ|add ਕਰੋ)`;

const REMAINING = re(String.raw`(?:kitna|kitne|kitni)\s+(?:budget\s+|paise\s+|paisa\s+|paisey\s+)?(?:bacha|bache|bachi|baki|baaki|left)|bacha kitna|budget (?:left|remaining|bacha)|how much (?:is |do we have |money )?(?:left|remaining)|remaining budget|(?:budget|balance) kitna|kitna kharch|बचा|कितना बचा|ਕਿੰਨਾ ਬਚਿਆ|ਬਚਿਆ ਕਿੰਨਾ`);
const BALANCES = re(String.raw`kisko kitna|kaun kisko|kisne kisko|kisse kitna|who owes|owes whom|(?:hisaab|hisab|settle up|balances?)\b|kitna dena|किसको कितना|ਕਿਸ ਨੂੰ ਕਿੰਨਾ`);
const SHOW_LIST = re(String.raw`^(?:(?:shopping |grocery )?list (?:dikhao|dikha do|dikha|batao|bhejo|kya hai|mein kya hai|me kya hai|mein kya|me kya)|show (?:the |me the |our )?(?:shopping |grocery )?list|(?:what'?s|what is|whats) (?:on|in) the (?:shopping |grocery )?list|(?:shopping|grocery) list|list|सूची|लिस्ट दिखाओ|ਲਿਸਟ ਦਿਖਾਓ)$`);

export const RULES: Rule[] = [
  // --- control & consent ---
  (t) => (/^(?:stop|unsubscribe|band karo|band kar do|opt out|optout|रुकें|बंद करो|ਬੰਦ ਕਰੋ)$/.test(t) ? A({ intent: 'stop' }) : null),
  (t) => (/^(?:start|subscribe|unstop|shuru karo|शुरू)$/.test(t) ? A({ intent: 'start' }) : null),
  (t) => (/^(?:delete|delete my data|mera data delete(?: karo)?|data delete(?: karo)?|erase my data|forget me|मेरा डेटा डिलीट करो)$/.test(t) ? A({ intent: 'delete_data' }) : null),
  (t) => (/^(?:export(?: my)? data|mera data (?:do|bhejo|export)|data export|download my data)$/.test(t) ? A({ intent: 'export_data' }) : null),
  (t) => (/^(?:y|yes|yeah|yep|ya|haan|han|haa|ha|hanji|haan ji|ji haan|ji|ok|okay|theek hai|theek|thik hai|sahi|sahi hai|confirm|done|kar do|save karo|हाँ|हां|जी|ਹਾਂ|ਹਾਂ ਜੀ|ਠੀਕ ਹੈ)$/.test(t) ? A({ intent: 'yes' }) : null),
  (t) => (/^(?:n|no|nope|nahi|nahin|nahi karna|mat karo|cancel|ruko|नहीं|नही|ਨਹੀਂ|ਨਹੀ)$/.test(t) ? A({ intent: 'no' }) : null),
  (t) => (/^(?:undo|undo last|galti|galti hui|galat ho gaya|galat entry|last wala hata do|last entry hata do|cancel last|delete last|last hata do|undo karo)$/.test(t) ? A({ intent: 'undo' }) : null),
  (t) => (/^(?:help|madad|menu|options|kya kar sakte ho|kya kar sakta hai|kaise use karun|मदद|ਮਦਦ)$/.test(t) ? A({ intent: 'help' }) : null),
  (t) => (/^(?:hi|hello|hey|hii+|hlo|namaste|namaskar|sat sri akal|नमस्ते|ਸਤ ਸ੍ਰੀ ਅਕਾਲ)$/.test(t) ? A({ intent: 'greeting' }) : null),
  (t) => (/^(?:dashboard|website|web|login|link|open dashboard|dashboard link|dashboard dikhao|dashboard kholo|डैशबोर्ड)$/.test(t) ? A({ intent: 'dashboard' }) : null),
  (t) => (/^(?:invite|invite link|invite code|add flatmate|flatmate add karo|naya member|naya flatmate|invite flatmate)$/.test(t) ? A({ intent: 'invite' }) : null),

  // --- money ---
  (t) => {
    for (const r of SETTLE) {
      const m = r.exec(t); if (!m?.groups) continue;
      const amount = parseAmount(m[m.length - 1] && /\d/.test(m[m.length - 1]) ? m[m.length - 1] : '');
      const am = amount ?? parseAmount((t.match(/(\d[\d,]*(?:\.\d+)?\s*k?)/)?.[1]) ?? '');
      if (am) return A({ intent: 'record_settlement', from: who(m.groups.from), to: m.groups.to, amount: am });
    }
    return null;
  },
  (t) => {
    for (const r of CONTRIB) {
      const m = r.exec(t); if (!m?.groups) continue;
      const amt = parseAmount(m[2] ?? m[1] ?? '') ?? parseAmount(t.match(/(\d[\d,]*(?:\.\d+)?\s*k?)/)?.[1] ?? '');
      if (amt) return A({ intent: 'record_contribution', member: who(m.groups.who), amount: amt });
    }
    return null;
  },
  (t) => {
    for (const r of PURCHASE) {
      const m = r.exec(t); if (!m) continue;
      const g = m.groups ?? {};
      const amtStr = m.slice(1).find(x => x && /\d/.test(x));
      const amount = amtStr ? parseAmount(amtStr) : null;
      if (!amount) continue;
      const items = g.what ? splitItems(g.what.replace(/\b(?:liya|laya|kharida)\b/g, '').trim()) : [];
      return A({ intent: 'record_purchase', payer: who(g.who), amount, items, split: 'equal' });
    }
    return null;
  },
  (t) => {
    const m = t.match(re(String.raw`^(?:(?:monthly |mahine ka |is mahine ka |food )*budget)\s*(?:set |rakho |rakh do |hai |is |to )*(?:rs |₹)?${AMT}\s*(?:rakho|rakh do|set karo|kar do|set)?$`)) ?? t.match(re(String.raw`^(?:set )?budget (?:to )?${AMT}$`));
    const amt = m ? parseAmount(m[1]) : null;
    return amt ? A({ intent: 'set_budget', budget: amt }) : null;
  },
  (t) => (REMAINING.test(t) && !/plan/.test(t) ? A({ intent: 'budget_remaining' }) : null),
  (t) => (BALANCES.test(t) ? A({ intent: 'show_balances' }) : null),

  // --- shopping list ---
  (t) => (SHOW_LIST.test(t) ? A({ intent: 'show_list' }) : null),
  (t) => {
    const m = t.match(re(String.raw`^(?:remove|delete|hata do|hatao|hata de) (?<items>.+)$`)) ?? t.match(re(String.raw`^(?<items>.+?) (?:hata do|hatao|hata de|remove karo|nahi chahiye|cancel karo|list se hatao)$`));
    if (!m?.groups) return null;
    const items = splitItems(m.groups.items);
    return items.length ? A({ intent: 'remove_items', items }) : null;
  },

  (t) => {
    const m = t.match(re(String.raw`^(?:please |pls )?add (?<items>.+?)(?: to (?:the |our )?(?:shopping |grocery )?list)?$`)) ?? t.match(re(String.raw`^(?:we |i )?need (?<items>.+)$`)) ?? t.match(re(String.raw`^(?<items>.+?)\s+(?:(?:ko )?(?:shopping |grocery )?list (?:mein|me|main) )?${ADD_TAIL}$`));
    if (!m?.groups) return null;
    const items = splitItems(m.groups.items);
    if (items.some(i => /\b(?:ke liye|ne|ka|ke|ki)\b/.test(i) || i.split(' ').length > 3)) return null; // free-form sentence: leave it to the model
    return items.length ? A({ intent: 'add_items', items }) : null;
  },
  (t) => {
    const m = t.match(re(String.raw`^(?<items>.+?)\s+(?:le liya|le liye|le aaya|le aya|le aayi|kharid liya|kharid liye|kharid li|aa gaya|aa gayi|aa gaye|mil gaya|mil gayi|bought|purchased|got it|ले लिया|ਲੈ ਲਿਆ)(?:\s+${AMT})?$`)) ?? t.match(re(String.raw`^(?:bought|got|picked up) (?<items>[^\d]+?)$`));
    if (!m?.groups) return null;
    const items = splitItems(m.groups.items);
    const price = m[2] ? parseAmount(m[2]) : null;
    if (items.some(i => /\b(?:ne|ka|ke|ki)\b/.test(i) || i.split(' ').length > 3)) return null; // looks like a purchase sentence: leave it to the model
    return items.length ? A({ intent: 'mark_bought', items, amount: price }) : null;
  },
  // --- tasks ---
  (t) => (/^(?:tasks?|kaam|chores?|mere kaam|pending kaam|kaam dikhao|tasks dikhao)$/.test(t) ? A({ intent: 'show_tasks' }) : null),
  (t) => (/^(?:sunday reset|household reset|weekly reset|reset)$/.test(t) ? A({ intent: 'sunday_reset' }) : null),
  (t) => (/^(?:task done|kaam ho gaya|kaam done|done task|mera kaam ho gaya)$/.test(t) ? A({ intent: 'complete_task' }) : null),

  // --- meals ---
  (t) => {
    if (/(?:swap|badlo|badal do|badal de|change|replace|badalna)/.test(t) && /(breakfast|lunch|dinner)/.test(t)) {
      const slot = t.match(/(breakfast|lunch|dinner)/)![1] as 'breakfast' | 'lunch' | 'dinner';
      const d = Object.keys(DAYS).find(k => new RegExp(`\\b${k}\\b`).test(t));
      return A({ intent: 'swap_meal', slot, day_name: d ? DAYS[d] : null });
    }
    return null;
  },
  (t) => (/(?:plan (?:dikhao|dikha do|batao|dikha)|show (?:me )?(?:the |my |our )?(?:meal |weekly )?plan|current plan|plan kya hai)/.test(t) ? A({ intent: 'show_plan' }) : null),
  (t) => (/(?:aaj (?:kya|kaun sa) (?:banega|banana|khana|bana)|aaj ka (?:menu|khana)|what(?:'s| is| are)? (?:for )?(?:dinner|lunch|cooking|on the menu)(?: today)?|today'?s? (?:meals?|menu)|aaj kya)/.test(t) ? A({ intent: 'show_today' }) : null),
  (t) => {
    if (!/\b(?:plan|menu)\b|ਪਲੈਨ|प्लान/.test(t) || /(?:remind|yaad)/.test(t)) return null;
    const budget = parseAmount(t.match(re(String.raw`budget\s*(?:of |hai |is )?(?:rs\.? |₹)?${AMT}`))?.[1] ?? t.match(re(String.raw`${AMT}\s*(?:ka |ke )?budget`))?.[1] ?? t.match(re(String.raw`(?:under|within|upto|up to)\s*${AMT}`))?.[1] ?? '');
    const people = Number(t.match(/(\d+)\s*(?:log|people|persons?|members?|pax|jane|logon|lok)/)?.[1] ?? 0) || null;
    const daysM = t.match(/(\d+)\s*(?:din|days?)/);
    const days = daysM ? Number(daysM[1]) : /(?:hafte|hafta|week|weekly|saptah)/.test(t) ? 7 : null;
    const diet = /non[- ]?veg|nonveg|chicken|mutton/.test(t) ? 'nonveg' : /eggetarian|\begg\b|anda/.test(t) ? 'egg' : /vegan/.test(t) ? 'vegan' : /\bveg\b|vegetarian|shakahari/.test(t) ? 'veg' : null;
    return A({ intent: 'plan_week', budget, people, days, diet });
  },
  (t) => (/(?:sasta|cheap|cheapest|best|sabse)\s+protein|protein per rupee|protein kahan se|protein ranking/.test(t) ? A({ intent: 'protein_rank' }) : null),
  (t) => (/(?:how am i eating|health (?:summary|check)|healthy eating|is hafte kaisa khaya|meri eating|weekly (?:eating|health)|balance feedback)/.test(t) ? A({ intent: 'weekly_balance' }) : null),
  (t) => {
    const m = t.match(re(String.raw`^(?:aaj |kal |today |yesterday )?(?:maine |main |i )?(?<what>.+?)\s+(?:khaya|khaaya|kha liya|khayi|khaye|ate|had|eaten|mangaya|mangwaya|order kiya|ordered)$`));
    if (!m?.groups) return null;
    const what = m.groups.what.replace(/^(?:aaj|kal)\s+/, '');
    const ordered = /(?:bahar|order|zomato|swiggy|restaurant|dhaba|outside|ate out|eating out|pizza|burger|biryani)/.test(t);
    const veg = /(?:sabzi|sabji|veg|salad|palak|bhindi|gobi|aloo|lauki|tinda|matar|cabbage|vegetable)/.test(what);
    const prot = /(?:dal|daal|paneer|egg|anda|chicken|soya|rajma|chole|chana|fish|curd|dahi|kadhi|sprout)/.test(what);
    return A({ intent: 'log_meal', text: what, kind: ordered ? 'ordered' : 'home', has_vegetables: veg, has_protein: prot });
  },
  (t) => {
    const m = t.match(re(String.raw`^(?<item>[\p{L} ]+?)\s+(?:nahi mil(?:ta|te|ti|a|ya|raha|rahi|rahe)|nahi hai|available nahi)(?:\s+.*)?$`)) ??
      t.match(re(String.raw`^(?:substitute|alternative|replacement|replace)(?: for| of)? (?<item>.+)$`)) ??
      t.match(re(String.raw`^(?<item>.+?) ka (?:substitute|alternative|vikalp|option)$`)) ??
      t.match(re(String.raw`^no (?<item>[\p{L} ]+?) (?:here|available|around|nearby)(?:.*)?$`)) ??
      t.match(re(String.raw`^(?:can i |what can i )?(?:use|replace) (?:instead of|in place of) (?<item>.+)$`));
    return m?.groups ? A({ intent: 'substitution', text: m.groups.item.trim(), items: [m.groups.item.trim()] }) : null;
  },

  // --- reminders ---
  (t) => {
    if (!/(?:remind me|reminder|yaad dila|yaad kara|yaad dilana|yaad rakhna|याद दिला|ਯਾਦ ਕਰਾ)/.test(t)) return null;
    if (/^(?:my )?reminders?$|reminders? (?:dikhao|list|show)|mere reminders?/.test(t)) return A({ intent: 'list_reminders' });
    const { when, rest } = parseWhen(t);
    const text = rest
      .replace(/\b(?:remind me|reminder|please|pls|to|ki|ko|ka|yaad dilana|yaad dila do|yaad dila dena|yaad dila|yaad dilao|yaad dena|yaad rakhna|kar dena|karna|mujhe|set|karo|kardo|ke liye)\b/g, ' ')
      .replace(/\s+/g, ' ').trim();
    return A({ intent: 'create_reminder', text: text || null, when });
  },
  (t) => (/^(?:my reminders|reminders|mere reminders|reminders dikhao)$/.test(t) ? A({ intent: 'list_reminders' }) : null),
];

export function parseByRules(raw: string): Action | null {
  const t = normalize(raw);
  if (!t) return null;
  for (const rule of RULES) {
    const a = rule(t, raw);
    if (a) return a;
  }
  return null;
}
