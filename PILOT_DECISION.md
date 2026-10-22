# Pilot decision + PDF claims verification

Date: 22 Oct 2026. Ye document teeno PDF ke numbers/prices/competitor claims ko web par check karke bana hai.
**Limit:** `mea.gov.in` aur `developers.facebook.com` ke pages mere environment se khul nahi paye (network error). Isliye neeche ke kaafi numbers search-result summaries aur secondary sources se hain. Quote karne se pehle original page khud dekho.

## 1. Decision (meri recommendation, final faisla aapka)

| | Choice | Kyun |
|---|---|---|
| Segment | **Shared flat / PG mein rehne wale working professionals (India)**, 22-32 saal | Same time zone, UPI, India WhatsApp rates, Hinglish. Students se paying capacity zyada. Videsh wale segments mein currency, payments, GDPR aur time zones ka extra kaam hai, aur students abroad ka market 2024 se 2025 mein gira hai. |
| City | **Bengaluru** | Wahan migrants ki bheed aur shared flats/PG ka saboot milta hai (neeche), aur shared flats mein cook rakhne ka common pattern hai. |
| Agar team Punjab/Chandigarh side hai | Wahin se shuru karo | Pilot mein access sabse zaroori hai. Punjabi voice pehle se plan mein hai. Ye mera andaza hai, PDF mein team ki location nahi likhi. |
| Pilot size | 10-20 households, 4 hafte | PDF ka plan. Kit: `/home/user/pilot_kit.md` |

**Ek cheez test karni hai:** flats **cook ke saath** vs **bina cook ke**. KitchenOS (neeche) cook coordination par hai. Hamara edge budget + shared kharcha hona chahiye, isliye pilot mein dono tarah ke flats lo aur dekho kiska dard bada hai.

## 2. PDF ke claims: verify ka natija

| Claim (PDF mein) | Kya mila | Status |
|---|---|---|
| ~34 million overseas Indians (2025), 2012 mein ~16 million | Dataful ke MEA compilation mein 161.8 lakh (2012) -> 343.6 lakh (2025). Lekin MEA ki newer table (Jan 2026) mein **37,280,845** (~3.7 crore) dikhta hai. GKToday ~35.4M batata hai. | **Number badal gaya.** Reference date likh kar quote karo. Jan 2025 ya Jan 2026 MEA table seedha dekho. |
| Gulf ~8-9M, US ~5M (conflicting) | Jan 2026 table: US ~6.08M, UAE ~4.34M. Purani MEA table mein US 4.46M. Methodology/date ka farak. | **Conflict sach hai.** Country number tabhi quote karo jab MEA table ka date saath likho. |
| 1.88M Indian students abroad, 153 countries, ~1.25M higher education | Parliament winter session data (Madhyamam report): 18+ lakh, 153 countries, 12.54 lakh higher ed + **6.28 lakh school-level**. | **Sahi, par ek nuance:** 1.88M mein ~6.28 lakh school-level students bhi hain. Original Parliament text maine nahi dekha. |
| Canada ~427k, US ~255k, UK ~173k | Wahi numbers (4.27 / 2.55 / 1.73 lakh), higher-ed, 2025. | Report se match. Primary source baaki. |
| Higher-ed ~76,000 gira (first drop in 3 saal) | 7.5 lakh (2022) -> 13.3 lakh (2024) -> 12.54 lakh (2025). | **Match.** Market sikud bhi sakta hai, ye sach hai. |
| Segment A (city movers) ka size nahi mila | Ab bhi koi proper city-level number nahi mila. Sirf indicators: Bengaluru PG demand ka ~23% (Magicbricks FY22-23, via RealtyNMore), PG beds ~₹4,500/month se, co-living ₹15,000-25,000 (Deccan Herald). | **Abhi bhi unknown.** Ye pilot ke interviews se andaza lagana padega. |
| Splitwise Pro ~$3-5/month | Sirf USD tiers mile: $2.99/$3.99/$4.99 monthly, $29.99/$39.99 annual (secondary blog). **India ka rupee price nahi mila**, aur Splitwise khud kehta hai ki country ke hisaab se badalta hai. | **Aadha verify.** India price ke liye App Store/Play Store khud dekho. |
| KitchenOS = WhatsApp-first shared-flat kitchen aur cook coordination | **Real hai.** Bangalore ke ek product designer ka chhota early-stage product. WhatsApp bot flatmates aur cook ke beech, text/voice, Hindi/Kannada/English, free listed. Kuch Bangalore flats test kar rahe hain. Product Hunt par sirf 2 reviews. Zyada tar sources uske apne launch pages hain. | **Competitor Bengaluru mein hi hai**, par chhota. Uske features ka claim sirf founder ka hai. Product khud use karke dekho. |
| WhatsApp India rates (PDF: "Meta rate card dekho") | Sources aapas mein conflict karte hain. Meta ka page kehta hai rate card **1 April 2026** se effective, per-message pricing **July 2025** se. Ek reseller (AiSensy) kehta hai Oct 2026 se service messages chargeable honge, par ye Meta ke page se confirm nahi hua. CampaignHQ ka ₹0.35 purana conversation model hai. | **Unverified.** India ka asli per-message rate nahi mila. Meta ka rate card khud kholo. |
| PLFS 2020-21: migration 28.9%, mahilaon mein 47.9% (shaadi) | Is baar check nahi kiya. | **Baaki.** |
| Ollie, AnyList, Samsung Food claims | Check nahi kiye. | **Baaki.** |
| Price point ₹149/month | Koi data nahi. PG bed ₹4,500+ ke saamne ye chhota hai, par tabhi sahi jab log sach mein pay karein. | **Hypothesis.** Pilot mein actual payment/commitment se test hoga. |

## 3. Is hafte ke kaam

1. Meta ka India rate card khud kholo (utility/marketing, aur free window ka rule). Number yahan likho: ______
2. App Store/Play Store (Indian account) mein Splitwise Pro ka rupee price dekho: ______
3. KitchenOS ko 1 flat ke saath khud try karo, aur dekho wo paise/kharcha handle karta hai ya nahi.
4. MEA ki original table aur Parliament answer ka PDF save karo, date ke saath.
5. Bengaluru mein 20 logon ki list banao (PG/flat, alumni, office groups) jinse pilot mein baat ho sake.
6. Interviews mein ye bhi poochho: "flat mein cook hai?" aur "mahine ka PG/flat rent kitna?" (Segment A ka size aur paying capacity samajhne ke liye.)

## Sources
- [Madhyamam: Indians pursuing higher education abroad drops](https://madhyamamonline.com/amp/india/data-shows-drop-in-number-of-indians-pursuing-higher-education-abroad-1474176)
- [Business Standard: 13 lakh students 2024 (Rajya Sabha reply)](https://www.business-standard.com/external-affairs-defence-security/news/over-1-3-mn-indian-students-pursuing-higher-studies-abroad-in-2024-govt-124080101441_1.html)
- [MEA: population of overseas Indians](https://www.mea.gov.in/population-of-overseas-indians)
- [Dataful: overseas Indian population](https://insights.dataful.in/articles/saudi-arabia-us-canada-and-gulf-nations-lead-growth-in-overseas-indian-population)
- [Splitwise pricing 2026 (secondary blog)](https://getfinny.app/blog/splitwise-pricing-2026)
- [KitchenOS on Product Hunt](https://www.producthunt.com/products/kitchenos/reviews) · [KitchenOS on Hunted.space](https://hunted.space/product/kitchenos)
- [Meta: WhatsApp Business Platform pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) · [AiSensy: Oct 2026 pricing update (reseller)](https://m.aisensy.com/blog/whatsapp-pricing-update-october-2026/)
- [Deccan Herald: PGs boom in Bengaluru](https://deccanherald.com/india/karnataka/bengaluru/illegal-pgs-boom-in-bengaluru-due-to-lack-of-norms-2878304) · [RealtyNMore: Magicbricks PG demand](https://realtynmore.com/?p=86532)
