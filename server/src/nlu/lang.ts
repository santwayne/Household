export type Lang = 'en' | 'hinglish' | 'hi' | 'pa';

const HINGLISH_MARKERS = /\b(ne|ka|ki|ke|hai|hain|kitna|kitne|bacha|bache|liya|karo|kar|do|dena|aur|nahi|nahin|haan|han|aaj|kal|saman|samaan|mein|me|se|ko|ho|raha|rahi|chahiye|batao|dikhao|hafte|mahine|log|bana|banega|khana|doodh|sabzi|paisa|paise|maine|mene|mera|meri|hisaab|yaad|dila|bhigo|le|liye|daal|jodo|likho|khaya|khaaya|bhigona|bhigo|milte|milta|wala|wali|liye|diye|daale|bahar|sasta|kaisa|bacha|kharch|kaam|aaj|hafte|mahine)\b/i;

/** Reply in the script and language of the latest message: Roman Hinglish stays Roman, Gurmukhi gets Punjabi, Devanagari gets Hindi, English stays English. */
export function detectLang(text: string, fallback: Lang = 'hinglish'): Lang {
  if (/[਀-੿]/.test(text)) return 'pa';
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  if (/[a-z]/i.test(text)) return HINGLISH_MARKERS.test(text) ? 'hinglish' : 'en';
  return fallback;
}

export const asLang = (v: string | null | undefined): Lang => (v === 'en' || v === 'hinglish' || v === 'hi' || v === 'pa' ? v : 'hinglish');
