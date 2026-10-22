import type { Lang } from './lang.js';

// Hindi (hi) and Punjabi (pa) strings cover the core flows only and need review by fluent speakers before launch.
// Missing keys fall back to Hinglish, then English.
type P = Record<string, string | number>;
type Entry = Partial<Record<Lang, string>> & { en: string };

const D: Record<string, Entry> = {
  // --- onboarding & consent ---
  welcome_consent: {
    en: 'Hi! I help flatmates plan meals, track groceries and split food costs on WhatsApp.\n\nWe will save your name, your household\'s groceries/expenses and the messages you send, only to run this service. Reply STOP any time to opt out, DELETE to erase your data.\n\nReply YES to start. If you were invited, send: JOIN <code>',
    hinglish: 'Namaste! Main flatmates ke saath khana plan karne, grocery track karne aur kharcha baantne mein madad karta hoon.\n\nHum aapka naam, ghar ki grocery/kharcha aur aapke messages sirf is service ke liye save karenge. Kabhi bhi STOP likho to band, DELETE likho to data erase.\n\nShuru karne ke liye YES (ya haan) likho. Invite mila hai to bhejo: JOIN <code>',
    hi: 'नमस्ते! मैं फ्लैटमेट्स के साथ खाना प्लान करने, ग्रोसरी ट्रैक करने और खर्च बाँटने में मदद करता हूँ।\n\nहम आपका नाम, घर की ग्रोसरी/खर्च और आपके मैसेज सिर्फ इस सेवा के लिए सेव करेंगे। STOP लिखें तो बंद, DELETE लिखें तो डेटा मिटा देंगे।\n\nशुरू करने के लिए हाँ लिखें। इनवाइट मिला है तो भेजें: JOIN <code>',
    pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਫਲੈਟਮੇਟਸ ਨਾਲ ਖਾਣਾ ਪਲੈਨ ਕਰਨ, ਗਰੋਸਰੀ ਟ੍ਰੈਕ ਕਰਨ ਤੇ ਖਰਚਾ ਵੰਡਣ ਵਿੱਚ ਮਦਦ ਕਰਦਾ ਹਾਂ।\n\nਅਸੀਂ ਤੁਹਾਡਾ ਨਾਮ, ਘਰ ਦੀ ਗਰੋਸਰੀ/ਖਰਚਾ ਤੇ ਮੈਸੇਜ ਸਿਰਫ਼ ਇਸ ਸੇਵਾ ਲਈ ਸੇਵ ਕਰਾਂਗੇ। STOP ਲਿਖੋ ਤਾਂ ਬੰਦ, DELETE ਲਿਖੋ ਤਾਂ ਡੇਟਾ ਮਿਟਾ ਦੇਵਾਂਗੇ।\n\nਸ਼ੁਰੂ ਕਰਨ ਲਈ ਹਾਂ ਲਿਖੋ। ਇਨਵਾਈਟ ਮਿਲਿਆ ਹੈ ਤਾਂ ਭੇਜੋ: JOIN <code>',
  },
  consent_join: {
    en: 'You were invited to "{household}". We will save your name and the messages you send, only to run the service. Reply YES to join, or NO to cancel. STOP opts out any time.',
    hinglish: 'Aapko "{household}" mein invite kiya gaya hai. Hum aapka naam aur messages sirf service chalane ke liye save karenge. Join karne ke liye YES/haan, cancel ke liye NO. STOP se kabhi bhi band.',
    hi: 'आपको "{household}" में इनवाइट किया गया है। हम आपका नाम और मैसेज सिर्फ सेवा चलाने के लिए सेव करेंगे। जॉइन करने के लिए हाँ, रद्द करने के लिए नहीं लिखें।',
    pa: 'ਤੁਹਾਨੂੰ "{household}" ਵਿੱਚ ਇਨਵਾਈਟ ਕੀਤਾ ਗਿਆ ਹੈ। ਅਸੀਂ ਤੁਹਾਡਾ ਨਾਮ ਤੇ ਮੈਸੇਜ ਸਿਰਫ਼ ਸੇਵਾ ਲਈ ਸੇਵ ਕਰਾਂਗੇ। ਜੁੜਨ ਲਈ ਹਾਂ, ਰੱਦ ਕਰਨ ਲਈ ਨਹੀਂ ਲਿਖੋ।',
  },
  consent_declined: { en: 'No problem, nothing was saved. Message me any time to start.', hinglish: 'Koi baat nahi, kuch save nahi hua. Jab chaho message karke shuru karo.', hi: 'कोई बात नहीं, कुछ सेव नहीं हुआ।', pa: 'ਕੋਈ ਗੱਲ ਨਹੀਂ, ਕੁਝ ਸੇਵ ਨਹੀਂ ਹੋਇਆ।' },
  invite_bad: { en: 'That invite code is invalid or expired. Ask your flatmate for a new one.', hinglish: 'Ye invite code galat ya expire ho gaya hai. Flatmate se naya maango.', hi: 'यह इनवाइट कोड गलत या एक्सपायर हो गया है।', pa: 'ਇਹ ਇਨਵਾਈਟ ਕੋਡ ਗਲਤ ਜਾਂ ਮਿਆਦ ਪੁੱਗ ਗਿਆ ਹੈ।' },
  joined: { en: 'Welcome, {name}! You joined "{household}". Send "help" to see what I can do.', hinglish: 'Welcome, {name}! Aap "{household}" mein join ho gaye. "help" bhejo, dekho main kya kar sakta hoon.', hi: 'स्वागत है, {name}! आप "{household}" में जुड़ गए। "help" भेजें।', pa: 'ਜੀ ਆਇਆਂ ਨੂੰ, {name}! ਤੁਸੀਂ "{household}" ਵਿੱਚ ਜੁੜ ਗਏ। "help" ਭੇਜੋ।' },
  setup_budget: { en: 'Great, {name}! What is your flat\'s monthly food budget? (for example: 6000)', hinglish: 'Badhiya, {name}! Flat ka mahine ka food budget kitna rakhna hai? (jaise: 6000)', hi: 'बढ़िया, {name}! फ्लैट का महीने का फूड बजट कितना रखना है? (जैसे: 6000)', pa: 'ਵਧੀਆ, {name}! ਫਲੈਟ ਦਾ ਮਹੀਨੇ ਦਾ ਫੂਡ ਬਜਟ ਕਿੰਨਾ ਰੱਖਣਾ ਹੈ? (ਜਿਵੇਂ: 6000)' },
  setup_diet: { en: 'Budget set to {budget}. Food preference: veg, egg, non-veg or vegan? Add any allergies too (for example: veg, peanut allergy).', hinglish: 'Budget {budget} set. Khana: veg, egg, non-veg ya vegan? Allergy ho to wo bhi likho (jaise: veg, peanut allergy).', hi: 'बजट {budget} सेट। खाना: veg, egg, non-veg या vegan? एलर्जी हो तो वो भी लिखें।', pa: 'ਬਜਟ {budget} ਸੈੱਟ। ਖਾਣਾ: veg, egg, non-veg ਜਾਂ vegan? ਐਲਰਜੀ ਹੋਵੇ ਤਾਂ ਉਹ ਵੀ ਲਿਖੋ।' },
  setup_done: {
    en: 'All set! Your flatmates can join by sending "JOIN {code}" to this number:\n{link}\n\nTry: "Aman ne 650 ka saman liya", "milk aur paneer add karo", "kitna bacha hai?", "is hafte ka plan". Send "help" any time.',
    hinglish: 'Sab set! Flatmates is number par "JOIN {code}" bhej kar judh sakte hain:\n{link}\n\nTry karo: "Aman ne 650 ka saman liya", "milk aur paneer add karo", "kitna bacha hai?", "is hafte ka plan". "help" kabhi bhi.',
    hi: 'सब सेट! फ्लैटमेट्स इस नंबर पर "JOIN {code}" भेजकर जुड़ सकते हैं:\n{link}\n\nआज़माएँ: "Aman ne 650 ka saman liya", "kitna bacha hai?"',
    pa: 'ਸਭ ਸੈੱਟ! ਫਲੈਟਮੇਟਸ ਇਸ ਨੰਬਰ ਤੇ "JOIN {code}" ਭੇਜ ਕੇ ਜੁੜ ਸਕਦੇ ਹਨ:\n{link}',
  },
  need_start: { en: 'Send YES to start, or JOIN <code> if you have an invite.', hinglish: 'Shuru karne ke liye YES/haan bhejo, ya invite hai to JOIN <code>.', hi: 'शुरू करने के लिए हाँ भेजें, या JOIN <code>।', pa: 'ਸ਼ੁਰੂ ਕਰਨ ਲਈ ਹਾਂ ਭੇਜੋ, ਜਾਂ JOIN <code>।' },
  opted_out: { en: 'Okay, I will not message you again. Send START to come back, or DELETE to erase your data.', hinglish: 'Theek hai, ab message nahi karunga. Wapas aane ke liye START, data erase ke liye DELETE.', hi: 'ठीक है, अब मैसेज नहीं करूँगा। वापस आने के लिए START।', pa: 'ਠੀਕ ਹੈ, ਹੁਣ ਮੈਸੇਜ ਨਹੀਂ ਕਰਾਂਗਾ। ਵਾਪਸ ਆਉਣ ਲਈ START।' },
  opted_in: { en: 'Welcome back! Notifications are on again.', hinglish: 'Wapas swagat hai! Notifications phir se on.', hi: 'वापसी पर स्वागत! नोटिफिकेशन फिर चालू।', pa: 'ਵਾਪਸੀ ਤੇ ਜੀ ਆਇਆਂ ਨੂੰ!' },
  delete_confirm: { en: 'This erases your personal data (name, phone, meal logs, reminders). Shared expense records stay with an anonymised name. Reply YES to confirm.', hinglish: 'Isse aapka personal data (naam, phone, meal logs, reminders) erase hoga. Shared kharcha records anonymous naam se rahenge. Confirm karne ke liye YES.', hi: 'इससे आपका निजी डेटा मिट जाएगा। पुष्टि के लिए हाँ लिखें।', pa: 'ਇਸ ਨਾਲ ਤੁਹਾਡਾ ਨਿੱਜੀ ਡੇਟਾ ਮਿਟ ਜਾਵੇਗਾ। ਪੁਸ਼ਟੀ ਲਈ ਹਾਂ ਲਿਖੋ।' },
  deleted: { en: 'Done. Your personal data has been erased.', hinglish: 'Ho gaya. Aapka personal data erase kar diya.', hi: 'हो गया। आपका डेटा मिटा दिया गया।', pa: 'ਹੋ ਗਿਆ। ਤੁਹਾਡਾ ਡੇਟਾ ਮਿਟਾ ਦਿੱਤਾ ਗਿਆ।' },
  export_link: { en: 'Your data export is ready here (valid {mins} minutes): {link}', hinglish: 'Aapka data export yahan hai ({mins} minute valid): {link}', hi: 'आपका डेटा एक्सपोर्ट यहाँ है: {link}', pa: 'ਤੁਹਾਡਾ ਡੇਟਾ ਐਕਸਪੋਰਟ ਇੱਥੇ ਹੈ: {link}' },
  help: {
    en: 'I can:\n• Log spending: "Aman paid 650 for groceries"\n• Contributions: "Raj put in 1000"\n• Shopping list: "add milk and paneer", "show list", "milk bought"\n• Budget: "how much is left?", "who owes whom?"\n• Meal plan: "plan for this week, budget 3000, 2 people, veg"\n• Reminders: "remind me tonight to soak rajma"\n• Health: "how am I eating this week?"\n• "dashboard" for the website, "undo" for the last entry.',
    hinglish: 'Main ye kar sakta hoon:\n• Kharcha: "Aman ne 650 ka saman liya"\n• Contribution: "Raj ne 1000 diye"\n• Shopping list: "milk aur paneer add karo", "list dikhao", "milk le liya"\n• Budget: "kitna bacha hai?", "kisko kitna dena hai?"\n• Plan: "is hafte ka plan, budget 3000, 2 log, veg"\n• Reminder: "aaj raat rajma bhigona yaad dilana"\n• Health: "is hafte kaisa khaya?"\n• "dashboard" website ke liye, "undo" last entry hatane ke liye.',
    hi: 'मैं ये कर सकता हूँ:\n• खर्च: "Aman ne 650 ka saman liya"\n• लिस्ट: "दूध जोड़ो"\n• बजट: "कितना बचा है?"\n• प्लान: "is hafte ka plan, budget 3000, 2 log, veg"',
    pa: 'ਮੈਂ ਇਹ ਕਰ ਸਕਦਾ ਹਾਂ:\n• ਖਰਚਾ: "Aman ne 650 ka saman liya"\n• ਲਿਸਟ: "ਦੁੱਧ add karo"\n• ਬਜਟ: "ਕਿੰਨਾ ਬਚਿਆ?"',
  },
  unknown: { en: 'I did not understand that. Try: "Aman paid 650 for groceries", "add milk", "how much is left?" or send "help".', hinglish: 'Ye samajh nahi aaya. Aise try karo: "Aman ne 650 ka saman liya", "milk add karo", "kitna bacha hai?" ya "help" bhejo.', hi: 'यह समझ नहीं आया। "help" भेजें।', pa: 'ਇਹ ਸਮਝ ਨਹੀਂ ਆਇਆ। "help" ਭੇਜੋ।' },
  error_generic: { en: 'Something went wrong and nothing was saved. Please try again.', hinglish: 'Kuch gadbad ho gayi, kuch save nahi hua. Dobara try karo.', hi: 'कुछ गड़बड़ हुई, कुछ सेव नहीं हुआ।', pa: 'ਕੁਝ ਗੜਬੜ ਹੋ ਗਈ, ਕੁਝ ਸੇਵ ਨਹੀਂ ਹੋਇਆ।' },
  voice_failed: { en: 'I could not hear that voice note clearly. Please type it or record again.', hinglish: 'Voice note saaf sunai nahi diya. Type kar do ya dobara record karo.', hi: 'वॉइस नोट साफ़ नहीं सुनाई दिया। टाइप करें या फिर रिकॉर्ड करें।', pa: 'ਵੌਇਸ ਨੋਟ ਸਾਫ਼ ਨਹੀਂ ਸੁਣਿਆ। ਟਾਈਪ ਕਰੋ ਜਾਂ ਦੁਬਾਰਾ ਰਿਕਾਰਡ ਕਰੋ।' },
  image_unsupported: { en: 'Receipt and pantry photos are not supported yet. Please type the amount or items.', hinglish: 'Receipt/pantry photo abhi support nahi hai. Amount ya items type kar do.', hi: 'फोटो अभी सपोर्ट नहीं है।', pa: 'ਫੋਟੋ ਅਜੇ ਸਪੋਰਟ ਨਹੀਂ ਹੈ।' },
  // --- money ---
  purchase_saved: { en: 'Saved: {payer} paid {amount}{items}. Budget left this month: {remaining}.', hinglish: 'Likh liya: {payer} ne {amount} diye{items}. Is mahine budget bacha: {remaining}.', hi: 'सेव हुआ: {payer} ने {amount} दिए{items}। इस महीने बजट बचा: {remaining}।', pa: 'ਸੇਵ ਹੋਇਆ: {payer} ਨੇ {amount} ਦਿੱਤੇ{items}। ਇਸ ਮਹੀਨੇ ਬਜਟ ਬਚਿਆ: {remaining}।' },
  purchase_saved_nobudget: { en: 'Saved: {payer} paid {amount}{items}. (Set a monthly budget with "budget 6000".)', hinglish: 'Likh liya: {payer} ne {amount} diye{items}. (Budget set karo: "budget 6000")', hi: 'सेव हुआ: {payer} ने {amount} दिए{items}।', pa: 'ਸੇਵ ਹੋਇਆ: {payer} ਨੇ {amount} ਦਿੱਤੇ{items}।' },
  purchase_confirm: { en: '{payer} paid {amount}{items}, split equally. Save it? (yes/no)', hinglish: '{payer} ne {amount} diye{items}, barabar split. Save karun? (haan/nahi)', hi: '{payer} ने {amount} दिए{items}। सेव करूँ? (हाँ/नहीं)', pa: '{payer} ਨੇ {amount} ਦਿੱਤੇ{items}। ਸੇਵ ਕਰਾਂ? (ਹਾਂ/ਨਹੀਂ)' },
  contribution_saved: { en: 'Saved: {member} put {amount} into the kitty. Kitty balance: {pot}.', hinglish: 'Likh liya: {member} ne {amount} kitty mein daale. Kitty balance: {pot}.', hi: 'सेव हुआ: {member} ने {amount} किटी में डाले। किटी: {pot}।', pa: 'ਸੇਵ ਹੋਇਆ: {member} ਨੇ {amount} ਕਿਟੀ ਵਿੱਚ ਪਾਏ। ਕਿਟੀ: {pot}।' },
  settlement_saved: { en: 'Saved: {from} paid {to} {amount}. (This only records it; no money moves through me.)', hinglish: 'Likh liya: {from} ne {to} ko {amount} diye. (Sirf record hai; paisa mere through nahi jaata.)', hi: 'सेव हुआ: {from} ने {to} को {amount} दिए।', pa: 'ਸੇਵ ਹੋਇਆ: {from} ਨੇ {to} ਨੂੰ {amount} ਦਿੱਤੇ।' },
  remaining: { en: 'Budget {budget}, spent {spent}, left {remaining} ({days} days left, about {perDay}/day).', hinglish: 'Budget {budget}, kharch {spent}, bacha {remaining} ({days} din baaki, lagbhag {perDay}/din).', hi: 'बजट {budget}, खर्च {spent}, बचा {remaining} ({days} दिन बाकी, लगभग {perDay}/दिन)।', pa: 'ਬਜਟ {budget}, ਖਰਚ {spent}, ਬਚਿਆ {remaining} ({days} ਦਿਨ ਬਾਕੀ, ਲਗਭਗ {perDay}/ਦਿਨ)।' },
  remaining_unset: { en: 'No monthly budget yet. Spent this month: {spent}. Set one with "budget 6000".', hinglish: 'Abhi monthly budget set nahi hai. Is mahine kharch: {spent}. Set karo: "budget 6000".', hi: 'बजट सेट नहीं है। इस महीने खर्च: {spent}।', pa: 'ਬਜਟ ਸੈੱਟ ਨਹੀਂ ਹੈ। ਇਸ ਮਹੀਨੇ ਖਰਚ: {spent}।' },
  budget_set: { en: 'Monthly food budget set to {budget}.', hinglish: 'Mahine ka food budget {budget} set ho gaya.', hi: 'मासिक बजट {budget} सेट हो गया।', pa: 'ਮਹੀਨਾਵਾਰ ਬਜਟ {budget} ਸੈੱਟ ਹੋ ਗਿਆ।' },
  balances_even: { en: 'Everyone is settled up.', hinglish: 'Sabka hisaab barabar hai.', hi: 'सबका हिसाब बराबर है।', pa: 'ਸਭ ਦਾ ਹਿਸਾਬ ਬਰਾਬਰ ਹੈ।' },
  balances_header: { en: 'Who owes whom (suggested):', hinglish: 'Kisko kitna dena hai (suggestion):', hi: 'किसे कितना देना है:', pa: 'ਕਿਸ ਨੇ ਕਿਸ ਨੂੰ ਕਿੰਨਾ ਦੇਣਾ ਹੈ:' },
  balance_line: { en: '• {from} → {to}: {amount}', hinglish: '• {from} → {to}: {amount}', hi: '• {from} → {to}: {amount}', pa: '• {from} → {to}: {amount}' },
  undo_ok: { en: 'Undone: last {kind} of {amount}.', hinglish: 'Hata diya: last {kind} ({amount}).', hi: 'हटा दिया: पिछला {kind} ({amount})।', pa: 'ਹਟਾ ਦਿੱਤਾ: ਪਿਛਲਾ {kind} ({amount})।' },
  undo_none: { en: 'Nothing to undo.', hinglish: 'Undo karne ke liye kuch nahi hai.', hi: 'हटाने के लिए कुछ नहीं।', pa: 'ਹਟਾਉਣ ਲਈ ਕੁਝ ਨਹੀਂ।' },
  who_paid_unclear: { en: 'Who paid? Reply with a name ({names}).', hinglish: 'Kisne diye? Naam batao ({names}).', hi: 'किसने दिए? नाम बताएँ ({names})।', pa: 'ਕਿਸ ਨੇ ਦਿੱਤੇ? ਨਾਮ ਦੱਸੋ ({names})।' },
  confirm_cancelled: { en: 'Okay, cancelled. Nothing was saved.', hinglish: 'Theek hai, cancel. Kuch save nahi hua.', hi: 'ठीक है, रद्द। कुछ सेव नहीं हुआ।', pa: 'ਠੀਕ ਹੈ, ਰੱਦ। ਕੁਝ ਸੇਵ ਨਹੀਂ ਹੋਇਆ।' },
  // --- shopping ---
  items_added: { en: 'Added to the list: {items}.', hinglish: 'List mein add kiya: {items}.', hi: 'लिस्ट में जोड़ा: {items}।', pa: 'ਲਿਸਟ ਵਿੱਚ ਜੋੜਿਆ: {items}।' },
  items_added_qty: { en: 'Added: {items}. How much of each? (optional)', hinglish: 'Add kiya: {items}. Kitna kitna chahiye? (optional)', hi: 'जोड़ा: {items}। कितना चाहिए?', pa: 'ਜੋੜਿਆ: {items}। ਕਿੰਨਾ ਚਾਹੀਦਾ?' },
  bought_ok: { en: 'Marked as bought: {items}.', hinglish: 'Le liya mark kiya: {items}.', hi: 'खरीदा हुआ मार्क किया: {items}।', pa: 'ਖਰੀਦਿਆ ਮਾਰਕ ਕੀਤਾ: {items}।' },
  not_on_list: { en: 'I could not find {items} on the list.', hinglish: '{items} list mein nahi mila.', hi: '{items} लिस्ट में नहीं मिला।', pa: '{items} ਲਿਸਟ ਵਿੱਚ ਨਹੀਂ ਮਿਲਿਆ।' },
  list_empty: { en: 'The shopping list is empty.', hinglish: 'Shopping list khaali hai.', hi: 'शॉपिंग लिस्ट खाली है।', pa: 'ਸ਼ਾਪਿੰਗ ਲਿਸਟ ਖਾਲੀ ਹੈ।' },
  list_header: { en: 'Shopping list ({total} est.):', hinglish: 'Shopping list (andaza {total}):', hi: 'शॉपिंग लिस्ट (अनुमान {total}):', pa: 'ਸ਼ਾਪਿੰਗ ਲਿਸਟ (ਅੰਦਾਜ਼ਾ {total}):' },
  removed_ok: { en: 'Removed: {items}.', hinglish: 'Hata diya: {items}.', hi: 'हटाया: {items}।', pa: 'ਹਟਾਇਆ: {items}।' },
  // --- plan ---
  plan_header: { en: 'Plan for {days} days, {servings} servings, budget {budget}:', hinglish: '{days} din ka plan, {servings} log, budget {budget}:', hi: '{days} दिन का प्लान, {servings} लोग, बजट {budget}:', pa: '{days} ਦਿਨ ਦਾ ਪਲੈਨ, {servings} ਲੋਕ, ਬਜਟ {budget}:' },
  plan_footer: { en: 'Estimated cost {total}. Shopping list updated. Say "swap friday dinner" to change one meal. Recipes and nutrition values are draft and not yet expert-reviewed.', hinglish: 'Andaza kharch {total}. Shopping list update ho gayi. Ek meal badalna ho to bolo "friday dinner badlo". Recipe aur nutrition abhi draft hain, expert review baaki hai.', hi: 'अनुमानित खर्च {total}। शॉपिंग लिस्ट अपडेट हो गई।', pa: 'ਅੰਦਾਜ਼ਨ ਖਰਚਾ {total}। ਸ਼ਾਪਿੰਗ ਲਿਸਟ ਅੱਪਡੇਟ ਹੋ ਗਈ।' },
  plan_over: { en: 'I cannot fit this budget: the cheapest plan I can make costs about {total}, which is {short} over. Increase the budget or reduce days/people.', hinglish: 'Is budget mein plan fit nahi ho raha: sabse sasta plan lagbhag {total} ka hai, yaani {short} zyada. Budget badhao ya din/log kam karo.', hi: 'इस बजट में प्लान फिट नहीं हो रहा: सबसे सस्ता प्लान लगभग {total} का है।', pa: 'ਇਸ ਬਜਟ ਵਿੱਚ ਪਲੈਨ ਫਿੱਟ ਨਹੀਂ ਹੋ ਰਿਹਾ: ਸਭ ਤੋਂ ਸਸਤਾ ਪਲੈਨ ਲਗਭਗ {total} ਦਾ ਹੈ।' },
  plan_none: { en: 'No recipe matches your diet, allergies and kitchen yet. Check household settings on the dashboard.', hinglish: 'Diet, allergy aur kitchen ke hisaab se koi recipe nahi mili. Dashboard par household settings dekho.', hi: 'कोई रेसिपी नहीं मिली।', pa: 'ਕੋਈ ਰੈਸਿਪੀ ਨਹੀਂ ਮਿਲੀ।' },
  need_budget: { en: 'Tell me a budget for the plan, for example "plan for this week, budget 3000".', hinglish: 'Plan ke liye budget batao, jaise "is hafte ka plan, budget 3000".', hi: 'प्लान के लिए बजट बताएँ।', pa: 'ਪਲੈਨ ਲਈ ਬਜਟ ਦੱਸੋ।' },
  no_plan: { en: 'No plan yet. Say "plan for this week, budget 3000".', hinglish: 'Abhi koi plan nahi hai. Bolo "is hafte ka plan, budget 3000".', hi: 'अभी कोई प्लान नहीं।', pa: 'ਅਜੇ ਕੋਈ ਪਲੈਨ ਨਹੀਂ।' },
  today_meals: { en: 'Today: {meals}', hinglish: 'Aaj: {meals}', hi: 'आज: {meals}', pa: 'ਅੱਜ: {meals}' },
  today_none: { en: 'Nothing planned for today.', hinglish: 'Aaj ke liye kuch plan nahi hai.', hi: 'आज के लिए कुछ प्लान नहीं।', pa: 'ਅੱਜ ਲਈ ਕੁਝ ਪਲੈਨ ਨਹੀਂ।' },
  swap_ok: { en: 'Changed {day} {slot} to {recipe} (about {cost}). Only that meal\'s shopping items were updated.', hinglish: '{day} {slot} badal kar {recipe} kar diya (lagbhag {cost}). Sirf us meal ke items update hue.', hi: '{day} {slot} बदलकर {recipe} किया।', pa: '{day} {slot} ਬਦਲ ਕੇ {recipe} ਕੀਤਾ।' },
  swap_fail: { en: 'I could not find that meal in the plan or no alternative fits.', hinglish: 'Wo meal plan mein nahi mila ya koi option fit nahi hua.', hi: 'वह मील नहीं मिला।', pa: 'ਉਹ ਮੀਲ ਨਹੀਂ ਮਿਲਿਆ।' },
  protein_header: { en: 'Cheapest protein (grams per rupee, higher is better):', hinglish: 'Sabse sasta protein (gram per rupee, zyada = behtar):', hi: 'सबसे सस्ता प्रोटीन (ग्राम प्रति रुपया):', pa: 'ਸਭ ਤੋਂ ਸਸਤਾ ਪ੍ਰੋਟੀਨ (ਗ੍ਰਾਮ ਪ੍ਰਤੀ ਰੁਪਿਆ):' },
  sub_found: { en: 'No {item}? Use: {use}.', hinglish: '{item} nahi mila? Ye use karo: {use}.', hi: '{item} नहीं मिला? ये इस्तेमाल करें: {use}।', pa: '{item} ਨਹੀਂ ਮਿਲਿਆ? ਇਹ ਵਰਤੋ: {use}।' },
  sub_none: { en: 'I do not have a substitute for {item} yet. Tell me the dish and I will note it.', hinglish: '{item} ka substitute abhi mere paas nahi hai.', hi: '{item} का विकल्प अभी नहीं है।', pa: '{item} ਦਾ ਬਦਲ ਅਜੇ ਨਹੀਂ ਹੈ।' },
  // --- reminders, health, tasks, misc ---
  reminder_saved: { en: 'Reminder set for {when}: {text}', hinglish: 'Reminder set: {when} — {text}', hi: 'रिमाइंडर सेट: {when} — {text}', pa: 'ਰੀਮਾਈਂਡਰ ਸੈੱਟ: {when} — {text}' },
  reminder_rejected: { en: 'I only set food-related reminders (like "soak rajma tonight").', hinglish: 'Main sirf khane se jude reminders set karta hoon (jaise "aaj raat rajma bhigona").', hi: 'मैं सिर्फ खाने से जुड़े रिमाइंडर सेट करता हूँ।', pa: 'ਮੈਂ ਸਿਰਫ਼ ਖਾਣੇ ਨਾਲ ਜੁੜੇ ਰੀਮਾਈਂਡਰ ਸੈੱਟ ਕਰਦਾ ਹਾਂ।' },
  reminder_when: { en: 'When should I remind you? (for example: tonight, tomorrow morning, 7pm)', hinglish: 'Kab yaad dilaun? (jaise: aaj raat, kal subah, 7 baje)', hi: 'कब याद दिलाऊँ?', pa: 'ਕਦੋਂ ਯਾਦ ਕਰਾਵਾਂ?' },
  reminder_fire: { en: 'Reminder: {text}', hinglish: 'Yaad dilana tha: {text}', hi: 'याद दिलाना था: {text}', pa: 'ਯਾਦ ਕਰਾਉਣਾ ਸੀ: {text}' },
  meal_logged: { en: 'Logged (private): {meal}.', hinglish: 'Log kar liya (private): {meal}.', hi: 'लॉग किया (निजी): {meal}।', pa: 'ਲਾਗ ਕੀਤਾ (ਨਿੱਜੀ): {meal}।' },
  balance_summary: { en: 'Last 7 days: {total} meals logged — {home} home-cooked, {ordered} ordered/outside; {veg} had vegetables, {prot} had protein.', hinglish: 'Pichle 7 din: {total} meals log — {home} ghar ka, {ordered} bahar/order; {veg} mein sabzi, {prot} mein protein.', hi: 'पिछले 7 दिन: {total} मील — {home} घर का, {ordered} बाहर।', pa: 'ਪਿਛਲੇ 7 ਦਿਨ: {total} ਮੀਲ — {home} ਘਰ ਦਾ, {ordered} ਬਾਹਰ।' },
  tip_few_logs: { en: 'Log a few more meals ("had dal rice") for useful feedback.', hinglish: 'Thode aur meals log karo ("dal chawal khaya") taaki feedback sahi mile.', hi: 'सही फीडबैक के लिए कुछ और मील लॉग करें।', pa: 'ਸਹੀ ਫੀਡਬੈਕ ਲਈ ਕੁਝ ਹੋਰ ਮੀਲ ਲਾਗ ਕਰੋ।' },
  tip_more_veg: { en: 'Tip: try adding vegetables to more meals.', hinglish: 'Tip: zyada meals mein sabzi add karne ki koshish karo.', hi: 'सुझाव: ज़्यादा मील में सब्जी जोड़ें।', pa: 'ਸੁਝਾਅ: ਹੋਰ ਮੀਲ ਵਿੱਚ ਸਬਜ਼ੀ ਜੋੜੋ।' },
  tip_more_protein: { en: 'Tip: dal, soya, eggs or paneer can raise protein cheaply ("cheap protein" shows the ranking).', hinglish: 'Tip: dal, soya, anda ya paneer se sasta protein badha sakte ho ("sasta protein" likho).', hi: 'सुझाव: दाल, सोया, अंडा या पनीर से प्रोटीन बढ़ाएँ।', pa: 'ਸੁਝਾਅ: ਦਾਲ, ਸੋਇਆ, ਅੰਡਾ ਜਾਂ ਪਨੀਰ ਨਾਲ ਪ੍ਰੋਟੀਨ ਵਧਾਓ।' },
  tip_ordered_often: { en: 'Tip: you ordered or ate out often; home-cooked meals from the plan could save money.', hinglish: 'Tip: bahar/order zyada hua; plan ke ghar ke khane se paisa bach sakta hai.', hi: 'सुझाव: बाहर का खाना ज़्यादा रहा।', pa: 'ਸੁਝਾਅ: ਬਾਹਰ ਦਾ ਖਾਣਾ ਜ਼ਿਆਦਾ ਰਿਹਾ।' },
  tip_looks_balanced: { en: 'Looks reasonably balanced. (General guidance only, not medical advice.)', hinglish: 'Kaafi balanced lag raha hai. (Sirf general salaah, medical advice nahi.)', hi: 'काफी संतुलित लगता है। (सामान्य सलाह, चिकित्सकीय नहीं)', pa: 'ਕਾਫ਼ੀ ਸੰਤੁਲਿਤ ਲੱਗਦਾ ਹੈ।' },
  dashboard_link: { en: 'Open your dashboard (link valid {mins} minutes, one use): {link}', hinglish: 'Dashboard kholo (link {mins} minute valid, ek baar): {link}', hi: 'डैशबोर्ड खोलें ({mins} मिनट, एक बार): {link}', pa: 'ਡੈਸ਼ਬੋਰਡ ਖੋਲ੍ਹੋ ({mins} ਮਿੰਟ, ਇੱਕ ਵਾਰ): {link}' },
  invite_created: { en: 'Share this with your flatmate: send "JOIN {code}" to this number: {link}', hinglish: 'Flatmate ko bhejo: is number par "JOIN {code}" likhna hai: {link}', hi: 'फ्लैटमेट को भेजें: "JOIN {code}": {link}', pa: 'ਫਲੈਟਮੇਟ ਨੂੰ ਭੇਜੋ: "JOIN {code}": {link}' },
  tasks_header: { en: 'Open tasks:', hinglish: 'Pending kaam:', hi: 'बाकी काम:', pa: 'ਬਾਕੀ ਕੰਮ:' },
  tasks_none: { en: 'No open tasks.', hinglish: 'Koi pending kaam nahi.', hi: 'कोई काम बाकी नहीं।', pa: 'ਕੋਈ ਕੰਮ ਬਾਕੀ ਨਹੀਂ।' },
  task_done: { en: 'Done: {title}.', hinglish: 'Ho gaya: {title}.', hi: 'हो गया: {title}।', pa: 'ਹੋ ਗਿਆ: {title}।' },
  reset_done: { en: 'Sunday reset: {assignments}. Check "tasks".', hinglish: 'Sunday reset: {assignments}. "tasks" likh kar dekho.', hi: 'रविवार रीसेट: {assignments}।', pa: 'ਐਤਵਾਰ ਰੀਸੈੱਟ: {assignments}।' },
  recap: {
    en: 'Weekly recap for {household}: spent {spent} of {budget} this month ({remaining} left). {open} open shopping items, {tasks} open tasks. Reply STOP to opt out.',
    hinglish: '{household} ka weekly recap: is mahine {spent}/{budget} kharch ({remaining} bacha). {open} shopping items, {tasks} kaam baaki. Band karne ke liye STOP.',
    hi: '{household} का साप्ताहिक रिकैप: इस महीने {spent}/{budget} खर्च ({remaining} बचा)। {open} शॉपिंग आइटम, {tasks} काम बाकी। बंद करने के लिए STOP।',
    pa: '{household} ਦਾ ਹਫ਼ਤਾਵਾਰੀ ਰਿਕੈਪ: ਇਸ ਮਹੀਨੇ {spent}/{budget} ਖਰਚ ({remaining} ਬਚਿਆ)। {open} ਸ਼ਾਪਿੰਗ ਆਈਟਮ, {tasks} ਕੰਮ ਬਾਕੀ। ਬੰਦ ਕਰਨ ਲਈ STOP।',
  },
  pantry_set: { en: 'Pantry updated: {items}.', hinglish: 'Pantry update ho gayi: {items}.', hi: 'पैंट्री अपडेट हुई: {items}।', pa: 'ਪੈਂਟਰੀ ਅੱਪਡੇਟ ਹੋ ਗਈ: {items}।' },
  pantry_need_qty: { en: 'Tell me how much, for example "2 kg rice".', hinglish: 'Kitna hai ye bhi batao, jaise "2 kg chawal".', hi: 'कितना है ये भी बताएँ, जैसे "2 kg चावल"।', pa: 'ਕਿੰਨਾ ਹੈ ਇਹ ਵੀ ਦੱਸੋ, ਜਿਵੇਂ "2 kg ਚੌਲ"।' },
  pantry_empty: { en: 'Pantry is empty. Say "we have 2 kg rice" to add things.', hinglish: 'Pantry khaali hai. Bolo "ghar mein 2 kg chawal hai".', hi: 'पैंट्री खाली है। बोलें "ghar mein 2 kg chawal hai"।', pa: 'ਪੈਂਟਰੀ ਖਾਲੀ ਹੈ। ਕਹੋ "ghar mein 2 kg chawal hai"।' },
  pantry_header: { en: 'At home:', hinglish: 'Ghar mein hai:', hi: 'घर में है:', pa: 'ਘਰ ਵਿੱਚ ਹੈ:' },
  expiring_none: { en: 'Nothing is close to its best-before date.', hinglish: 'Kuch bhi expire hone wala nahi hai.', hi: 'कुछ भी जल्दी खराब होने वाला नहीं है।', pa: 'ਕੁਝ ਵੀ ਜਲਦੀ ਖਰਾਬ ਹੋਣ ਵਾਲਾ ਨਹੀਂ ਹੈ।' },
  expiring_header: { en: 'Use these soon:', hinglish: 'Inhe jaldi use karo:', hi: 'इन्हें जल्दी इस्तेमाल करें:', pa: 'ਇਹਨਾਂ ਨੂੰ ਜਲਦੀ ਵਰਤੋ:' },
  expiry_alert: { en: 'Heads up: {items} should be used soon. Say "what can I cook from the pantry" for ideas.', hinglish: 'Dhyan do: {items} jaldi use karne hain. "ghar ke saman se kya banaun" bolo, idea milenge.', hi: 'ध्यान दें: {items} जल्दी इस्तेमाल करें।', pa: 'ਧਿਆਨ ਦਿਓ: {items} ਜਲਦੀ ਵਰਤੋ।' },
  cook_header: { en: 'You could cook with what is at home:', hinglish: 'Ghar ke saman se ye ban sakta hai:', hi: 'घर के सामान से ये बन सकता है:', pa: 'ਘਰ ਦੇ ਸਮਾਨ ਨਾਲ ਇਹ ਬਣ ਸਕਦਾ ਹੈ:' },
  cook_line: { en: '• {name}: have {have}; need {missing}', hinglish: '• {name}: hai {have}; chahiye {missing}', hi: '• {name}: है {have}; चाहिए {missing}', pa: '• {name}: ਹੈ {have}; ਚਾਹੀਦਾ {missing}' },
  cook_none: { en: 'Nothing matches well yet. Add what you have: "we have 2 kg rice".', hinglish: 'Abhi kuch match nahi hua. Pantry mein daalo: "ghar mein 2 kg chawal hai".', hi: 'अभी कुछ मेल नहीं खाया। पैंट्री में डालें।', pa: 'ਅਜੇ ਕੁਝ ਮੇਲ ਨਹੀਂ ਖਾਂਦਾ। ਪੈਂਟਰੀ ਵਿੱਚ ਪਾਓ।' },
  split_unknown: { en: 'I could not match these names for the split: {names}. Members are: {members}.', hinglish: 'Split ke naam samajh nahi aaye: {names}. Members: {members}.', hi: 'बँटवारे के नाम समझ नहीं आए: {names}। सदस्य: {members}।', pa: 'ਵੰਡ ਦੇ ਨਾਮ ਸਮਝ ਨਹੀਂ ਆਏ: {names}। ਮੈਂਬਰ: {members}।' },
  purchase_split_note: { en: ' split between {who}', hinglish: ', {who} ke beech split', hi: ', {who} के बीच बँटा', pa: ', {who} ਵਿੱਚ ਵੰਡਿਆ' },
  budget_alert_other: { en: '{who} just logged {amount}. {pct}% of this month\'s food budget is used ({remaining} left).', hinglish: '{who} ne {amount} likhe. Is mahine ka {pct}% budget ho gaya ({remaining} bacha).', hi: '{who} ने {amount} लिखे। इस महीने का {pct}% बजट हो गया ({remaining} बचा)।', pa: '{who} ਨੇ {amount} ਲਿਖੇ। ਇਸ ਮਹੀਨੇ ਦਾ {pct}% ਬਜਟ ਹੋ ਗਿਆ ({remaining} ਬਚਿਆ)।' },
  budget_alert: { en: 'Heads up: {pct}% of this month\'s food budget is used ({remaining} left).', hinglish: 'Dhyan do: is mahine ka {pct}% budget ho gaya ({remaining} bacha).', hi: 'ध्यान दें: इस महीने का {pct}% बजट हो गया ({remaining} बचा)।', pa: 'ਧਿਆਨ ਦਿਓ: ਇਸ ਮਹੀਨੇ ਦਾ {pct}% ਬਜਟ ਹੋ ਗਿਆ ({remaining} ਬਚਿਆ)।' },
};

export function t(lang: Lang, key: string, params: P = {}): string {
  const e = D[key];
  if (!e) throw new Error(`Missing i18n key ${key}`);
  const s = e[lang] ?? e.hinglish ?? e.en;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

export const hasKey = (k: string) => k in D;

export function money(currency: string, n: number): string {
  const v = Math.round(n * 100) / 100;
  const s = Number.isInteger(v) ? v.toLocaleString('en-IN') : v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'INR' ? `₹${s}` : `${currency} ${s}`;
}

/** For tests: every key must exist in all four languages. */
export const allKeys = () => Object.keys(D);
export const hasLang = (k: string, l: Lang) => !!D[k]?.[l];
