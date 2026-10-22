// Reference data. EVERYTHING here is a starting assumption: prices need a [verify] pass against
// real local markets, and recipe/nutrition values need expert review before launch (flag: reviewed=false).

export type Ing = { item: string; qty: number; unit: 'g' | 'ml' | 'piece' };
export type RecipeSeed = {
  id: string; name: string; region: string; diet: 'vegan' | 'veg' | 'egg' | 'nonveg';
  allergens: string[]; protein: number; mins: number; slot?: string[]; equipment?: string[]; ing: Ing[];
};

const i = (item: string, qty: number, unit: Ing['unit'] = 'g'): Ing => ({ item, qty, unit });

// base_servings = 2 for all recipes
export const RECIPES: RecipeSeed[] = [
  { id: 'dal-tadka', name: 'Dal tadka + rice', region: 'north', diet: 'vegan', allergens: [], protein: 17, mins: 35, ing: [i('toor dal', 120), i('rice', 150), i('onion', 100), i('tomato', 100), i('oil', 20, 'ml'), i('jeera', 3), i('haldi', 2), i('green chilli', 10)] },
  { id: 'rajma-chawal', name: 'Rajma chawal', region: 'punjabi', diet: 'vegan', allergens: [], protein: 20, mins: 50, ing: [i('rajma', 150), i('rice', 150), i('onion', 120), i('tomato', 150), i('oil', 25, 'ml'), i('garam masala', 4), i('ginger', 10), i('garlic', 10)] },
  { id: 'chole-rice', name: 'Chole + rice', region: 'punjabi', diet: 'vegan', allergens: [], protein: 18, mins: 50, ing: [i('chole', 150), i('rice', 150), i('onion', 120), i('tomato', 150), i('oil', 25, 'ml'), i('garam masala', 4)] },
  { id: 'aloo-gobi-roti', name: 'Aloo gobi + roti', region: 'north', diet: 'vegan', allergens: ['gluten'], protein: 11, mins: 40, ing: [i('potato', 200), i('cauliflower', 250), i('atta', 150), i('onion', 80), i('tomato', 80), i('oil', 25, 'ml'), i('haldi', 2)] },
  { id: 'paneer-bhurji-roti', name: 'Paneer bhurji + roti', region: 'north', diet: 'veg', allergens: ['dairy', 'gluten'], protein: 24, mins: 25, ing: [i('paneer', 200), i('atta', 150), i('onion', 100), i('tomato', 100), i('oil', 15, 'ml'), i('green chilli', 10)] },
  { id: 'palak-paneer-roti', name: 'Palak paneer + roti', region: 'punjabi', diet: 'veg', allergens: ['dairy', 'gluten'], protein: 22, mins: 40, ing: [i('spinach', 400), i('paneer', 150), i('atta', 150), i('onion', 80), i('oil', 20, 'ml'), i('garlic', 10)] },
  { id: 'kadhi-chawal', name: 'Kadhi chawal', region: 'punjabi', diet: 'veg', allergens: ['dairy'], protein: 14, mins: 45, ing: [i('curd', 250), i('besan', 60), i('rice', 150), i('onion', 80), i('oil', 20, 'ml'), i('haldi', 2)] },
  { id: 'moong-khichdi', name: 'Moong dal khichdi', region: 'general', diet: 'vegan', allergens: [], protein: 14, mins: 30, ing: [i('moong dal', 100), i('rice', 100), i('oil', 15, 'ml'), i('jeera', 3), i('haldi', 2), i('potato', 100)] },
  { id: 'poha', name: 'Poha', region: 'maharashtrian', diet: 'vegan', allergens: ['peanut'], protein: 7, mins: 15, slot: ['breakfast'], ing: [i('poha', 120), i('onion', 80), i('potato', 80), i('peanuts', 20), i('oil', 15, 'ml'), i('haldi', 2), i('lemon', 1, 'piece')] },
  { id: 'upma', name: 'Upma', region: 'south', diet: 'vegan', allergens: ['gluten'], protein: 8, mins: 20, slot: ['breakfast'], ing: [i('suji', 120), i('onion', 80), i('oil', 15, 'ml'), i('mustard seeds', 3), i('curry leaves', 4), i('green chilli', 10)] },
  { id: 'besan-chilla', name: 'Besan chilla', region: 'north', diet: 'vegan', allergens: [], protein: 14, mins: 20, slot: ['breakfast', 'dinner'], ing: [i('besan', 120), i('onion', 80), i('tomato', 80), i('oil', 15, 'ml'), i('green chilli', 10)] },
  { id: 'egg-bhurji-roti', name: 'Egg bhurji + roti', region: 'north', diet: 'egg', allergens: ['egg', 'gluten'], protein: 22, mins: 20, ing: [i('eggs', 4, 'piece'), i('atta', 150), i('onion', 100), i('tomato', 100), i('oil', 15, 'ml'), i('green chilli', 10)] },
  { id: 'egg-curry-rice', name: 'Egg curry + rice', region: 'bengali', diet: 'egg', allergens: ['egg'], protein: 21, mins: 35, ing: [i('eggs', 4, 'piece'), i('rice', 150), i('onion', 120), i('tomato', 120), i('oil', 25, 'ml'), i('garam masala', 3)] },
  { id: 'chicken-curry-rice', name: 'Chicken curry + rice', region: 'north', diet: 'nonveg', allergens: [], protein: 38, mins: 50, ing: [i('chicken', 300), i('rice', 150), i('onion', 150), i('tomato', 150), i('oil', 30, 'ml'), i('garam masala', 4), i('ginger', 10), i('garlic', 10)] },
  { id: 'soya-chunk-curry', name: 'Soya chunk curry + roti', region: 'north', diet: 'vegan', allergens: ['soy', 'gluten'], protein: 28, mins: 30, ing: [i('soya chunks', 80), i('atta', 150), i('onion', 100), i('tomato', 120), i('oil', 20, 'ml'), i('garam masala', 3)] },
  { id: 'masoor-dal-rice', name: 'Masoor dal + rice', region: 'general', diet: 'vegan', allergens: [], protein: 18, mins: 30, ing: [i('masoor dal', 120), i('rice', 150), i('onion', 80), i('tomato', 80), i('oil', 15, 'ml'), i('jeera', 3)] },
  { id: 'lauki-dal-roti', name: 'Lauki + chana dal + roti', region: 'north', diet: 'vegan', allergens: ['gluten'], protein: 16, mins: 40, ing: [i('lauki', 300), i('chana dal', 80), i('atta', 150), i('oil', 15, 'ml'), i('haldi', 2)] },
  { id: 'bhindi-roti-dal', name: 'Bhindi sabzi + dal + roti', region: 'north', diet: 'vegan', allergens: ['gluten'], protein: 17, mins: 40, ing: [i('bhindi', 250), i('moong dal', 80), i('atta', 150), i('onion', 80), i('oil', 25, 'ml')] },
  { id: 'gujarati-dal-bhat', name: 'Gujarati dal bhat', region: 'gujarati', diet: 'vegan', allergens: ['peanut'], protein: 15, mins: 40, ing: [i('toor dal', 120), i('rice', 150), i('peanuts', 20), i('jaggery', 15), i('oil', 15, 'ml'), i('mustard seeds', 3), i('lemon', 1, 'piece')] },
  { id: 'methi-thepla', name: 'Methi thepla + curd', region: 'gujarati', diet: 'veg', allergens: ['gluten', 'dairy'], protein: 12, mins: 35, ing: [i('atta', 200), i('methi', 100), i('curd', 200), i('oil', 25, 'ml'), i('haldi', 2)] },
  { id: 'sambar-rice', name: 'Sambar rice', region: 'south', diet: 'vegan', allergens: [], protein: 16, mins: 45, ing: [i('toor dal', 100), i('rice', 150), i('tomato', 100), i('onion', 80), i('drumstick', 100), i('tamarind', 10), i('oil', 15, 'ml'), i('curry leaves', 4), i('mustard seeds', 3)] },
  { id: 'curd-rice', name: 'Curd rice', region: 'south', diet: 'veg', allergens: ['dairy'], protein: 10, mins: 15, ing: [i('rice', 150), i('curd', 300), i('mustard seeds', 3), i('curry leaves', 4), i('green chilli', 10)] },
  { id: 'idli-sambar', name: 'Idli + sambar', region: 'south', diet: 'vegan', allergens: [], protein: 14, mins: 40, slot: ['breakfast', 'dinner'], ing: [i('idli batter', 300), i('toor dal', 60), i('tomato', 80), i('onion', 60), i('oil', 10, 'ml'), i('mustard seeds', 3)] },
  { id: 'lemon-rice-peanut', name: 'Lemon rice + peanuts', region: 'south', diet: 'vegan', allergens: ['peanut'], protein: 11, mins: 20, ing: [i('rice', 180), i('peanuts', 30), i('lemon', 2, 'piece'), i('oil', 15, 'ml'), i('curry leaves', 4), i('mustard seeds', 3)] },
  { id: 'veg-pulao-raita', name: 'Veg pulao + raita', region: 'general', diet: 'veg', allergens: ['dairy'], protein: 12, mins: 35, ing: [i('rice', 180), i('peas', 80), i('carrot', 80), i('onion', 80), i('curd', 150), i('oil', 20, 'ml')] },
  { id: 'macher-jhol-rice', name: 'Fish curry + rice', region: 'bengali', diet: 'nonveg', allergens: ['fish'], protein: 32, mins: 40, ing: [i('fish', 300), i('rice', 150), i('potato', 100), i('tomato', 100), i('mustard oil', 30, 'ml'), i('haldi', 2)] },
  { id: 'khichuri-begun', name: 'Bhuna khichuri + begun bhaja', region: 'bengali', diet: 'vegan', allergens: [], protein: 15, mins: 40, ing: [i('moong dal', 100), i('rice', 100), i('brinjal', 200), i('potato', 100), i('mustard oil', 30, 'ml'), i('ginger', 10)] },
  { id: 'misal-pav-lite', name: 'Usal (sprouted moth) + roti', region: 'maharashtrian', diet: 'vegan', allergens: ['gluten'], protein: 18, mins: 40, ing: [i('moth beans', 120), i('atta', 150), i('onion', 100), i('tomato', 100), i('oil', 20, 'ml')] },
  { id: 'cabbage-peas-roti', name: 'Cabbage-peas sabzi + roti', region: 'north', diet: 'vegan', allergens: ['gluten'], protein: 12, mins: 30, ing: [i('cabbage', 300), i('peas', 80), i('atta', 150), i('oil', 20, 'ml'), i('jeera', 3)] },
  { id: 'sprout-salad-bowl', name: 'Chana sprout salad bowl', region: 'general', diet: 'vegan', allergens: [], protein: 15, mins: 10, slot: ['breakfast', 'lunch'], equipment: [], ing: [i('chole', 100), i('onion', 50), i('tomato', 80), i('lemon', 1, 'piece'), i('cucumber', 100)] },
  { id: 'bread-egg-toast', name: 'Egg toast (pan)', region: 'general', diet: 'egg', allergens: ['egg', 'gluten'], protein: 16, mins: 10, slot: ['breakfast'], ing: [i('eggs', 3, 'piece'), i('bread', 4, 'piece'), i('oil', 10, 'ml'), i('onion', 40)] },
];

// "No curry leaves here, use this" (Target Market PDF). Starting set, needs fluent/regional review.
export const SUBSTITUTIONS: { missing: string; use: string }[] = [
  { missing: 'curry leaves', use: 'a pinch of hing plus a little extra mustard seeds; or 1 bay leaf (flavour is different)' },
  { missing: 'paneer', use: 'firm tofu, or boiled chickpeas; for bhurji, crumbled tofu works well' },
  { missing: 'ghee', use: 'butter or a neutral oil with a small knob of butter' },
  { missing: 'curd', use: 'plain unsweetened yoghurt (Greek yoghurt thinned with a little water)' },
  { missing: 'besan', use: 'chickpea flour from any Indian/Middle Eastern shop, or blitz dry chana dal' },
  { missing: 'toor dal', use: 'masoor or split yellow lentils (cooks faster)' },
  { missing: 'methi', use: 'a spoon of kasuri methi, or spinach with a pinch of fenugreek seeds' },
  { missing: 'tamarind', use: 'lemon or lime juice plus a pinch of sugar' },
  { missing: 'jaggery', use: 'brown sugar' },
  { missing: 'garam masala', use: 'cumin + coriander powder + a pinch of cinnamon and black pepper' },
  { missing: 'kasuri methi', use: 'a pinch of fenugreek seeds, or skip' },
  { missing: 'atta', use: 'whole wheat flour (any shop); mix with a little plain flour if too tough' },
  { missing: 'green chilli', use: 'a pinch of red chilli flakes or cayenne' },
  { missing: 'coriander', use: 'parsley with a squeeze of lemon' },
  { missing: 'drumstick', use: 'green beans or raw mango pieces' },
  { missing: 'mustard oil', use: 'any neutral oil plus a pinch of mustard powder' },
];

// Regional default prices (INR). Assumed ranges for planning, [verify] with real markets. unit: kg | l | piece
export const DEFAULT_PRICES_INR: [string, string, number][] = [
  ['atta', 'kg', 45], ['rice', 'kg', 60], ['toor dal', 'kg', 150], ['moong dal', 'kg', 120], ['masoor dal', 'kg', 95],
  ['chana dal', 'kg', 90], ['rajma', 'kg', 140], ['chole', 'kg', 110], ['besan', 'kg', 90], ['poha', 'kg', 60],
  ['suji', 'kg', 50], ['moth beans', 'kg', 130], ['idli batter', 'kg', 70], ['potato', 'kg', 30], ['onion', 'kg', 35],
  ['tomato', 'kg', 40], ['cauliflower', 'kg', 50], ['cabbage', 'kg', 30], ['spinach', 'kg', 40], ['bhindi', 'kg', 60],
  ['brinjal', 'kg', 50], ['peas', 'kg', 100], ['carrot', 'kg', 50], ['lauki', 'kg', 40], ['methi', 'kg', 60],
  ['cucumber', 'kg', 40], ['drumstick', 'kg', 80], ['paneer', 'kg', 380], ['curd', 'kg', 70], ['milk', 'l', 56],
  ['oil', 'l', 150], ['mustard oil', 'l', 180], ['ghee', 'kg', 600], ['eggs', 'piece', 7], ['chicken', 'kg', 220],
  ['fish', 'kg', 300], ['soya chunks', 'kg', 160], ['peanuts', 'kg', 140], ['jaggery', 'kg', 70], ['sugar', 'kg', 45],
  ['ginger', 'kg', 120], ['garlic', 'kg', 150], ['green chilli', 'kg', 80], ['coriander', 'kg', 100], ['tamarind', 'kg', 200],
  ['lemon', 'piece', 4], ['bread', 'piece', 5], ['jeera', 'kg', 400], ['haldi', 'kg', 200], ['garam masala', 'kg', 600],
  ['mustard seeds', 'kg', 150], ['curry leaves', 'kg', 400], ['salt', 'kg', 20], ['tea', 'kg', 400],
];

// Protein per 100 g (raw/dry weight, approximate). Needs expert review before launch.
export const PROTEIN_SOURCES: { item: string; per100g: number; gramsPerPiece?: number }[] = [
  { item: 'soya chunks', per100g: 52 }, { item: 'peanuts', per100g: 26 }, { item: 'masoor dal', per100g: 25 },
  { item: 'moong dal', per100g: 24 }, { item: 'toor dal', per100g: 22 }, { item: 'chana dal', per100g: 22 },
  { item: 'rajma', per100g: 22 }, { item: 'besan', per100g: 22 }, { item: 'chole', per100g: 19 },
  { item: 'paneer', per100g: 18 }, { item: 'chicken', per100g: 21 }, { item: 'fish', per100g: 20 },
  { item: 'eggs', per100g: 13, gramsPerPiece: 50 }, { item: 'curd', per100g: 3.5 }, { item: 'milk', per100g: 3.4 },
];

// Item aliases for parsing (Hinglish / Hindi / common spellings -> canonical item)
export const ITEM_ALIASES: Record<string, string> = {
  doodh: 'milk', dudh: 'milk', 'दूध': 'milk', dahi: 'curd', 'दही': 'curd', paneer: 'paneer', 'पनीर': 'paneer',
  chawal: 'rice', 'चावल': 'rice', aata: 'atta', 'आटा': 'atta', pyaz: 'onion', pyaaz: 'onion', 'प्याज': 'onion',
  tamatar: 'tomato', 'टमाटर': 'tomato', aloo: 'potato', alu: 'potato', 'आलू': 'potato', tel: 'oil', 'तेल': 'oil',
  anda: 'eggs', ande: 'eggs', egg: 'eggs', 'अंडे': 'eggs', cheeni: 'sugar', chini: 'sugar', namak: 'salt', adrak: 'ginger',
  lehsun: 'garlic', mirch: 'green chilli', hari: 'green chilli', nimbu: 'lemon', dhaniya: 'coriander', toor: 'toor dal',
  arhar: 'toor dal', moong: 'moong dal', masoor: 'masoor dal', chana: 'chole', chhole: 'chole', soya: 'soya chunks',
  matar: 'peas', gobi: 'cauliflower', patta: 'cabbage', palak: 'spinach', 'भिंडी': 'bhindi', baingan: 'brinjal',
  gajar: 'carrot', ghee: 'ghee', 'घी': 'ghee', chai: 'tea', bread: 'bread', 'ਦੁੱਧ': 'milk', 'ਦਹੀਂ': 'curd',
};
