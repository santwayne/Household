export type Lang = 'en' | 'hinglish' | 'hi' | 'pa';

// Strong markers are not English words. Ambiguous ones (do, me, le...) only count when there are at least two of them.
const HINGLISH_STRONG = /\b(hain|kitna|kitne|bacha|bache|liya|karo|dena|nahi|nahin|haan|han|aaj|kal|saman|samaan|mein|raha|rahi|chahiye|batao|dikhao|hafte|mahine|log|bana|banega|khana|doodh|sabzi|paisa|paise|maine|mene|mera|meri|hisaab|yaad|dila|bhigo|liye|daal|jodo|likho|khaya|khaaya|bhigona|bhigo|milte|milta|wala|wali|liye|diye|daale|bahar|sasta|kaisa|bacha|kharch|kaam|aaj|hafte|mahine|kya|karein|karun|banaun|kab|kaun)\b/i;
const HINGLISH_AMBIGUOUS = /\b(ab|aur|do|hai|ho|ka|kar|ke|ki|ko|le|me|ne|se)\b/gi;

/** Reply in the script and language of the latest message: Roman Hinglish stays Roman, Gurmukhi gets Punjabi, Devanagari gets Hindi, English stays English. */
export function detectLang(text: string, fallback: Lang = 'hinglish'): Lang {
  if (/[਀-੿]/.test(text)) return 'pa';
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  if (/[a-z]/i.test(text)) return HINGLISH_STRONG.test(text) || (text.match(HINGLISH_AMBIGUOUS)?.length ?? 0) >= 2 ? 'hinglish' : 'en';
  return fallback;
}

export const asLang = (v: string | null | undefined): Lang => (v === 'en' || v === 'hinglish' || v === 'hi' || v === 'pa' ? v : 'hinglish');
