/**
 * ForenText Per-Message Multilingual Language Detection Utility
 *
 * Stage 1 Scope:
 * - Individual message-level language detection
 * - Non-destructive multilingual text handling (original text is never modified)
 * - Supports:
 *   1. English ('english')
 *   2. Hindi in Devanagari script ('hindi_devanagari')
 *   3. Roman Hindi - Hindi written in Latin script ('roman_hindi')
 *   4. Hinglish - Mixed Hindi + English in the same message ('hinglish')
 *   5. Uncertain / Unknown ('unknown') for short, numeric, symbolic, or ambiguous messages
 */

import {
  DetectedLanguage,
  DetectedScript,
  LanguageConfidence,
  MessageLanguageMetadata,
} from '../types/forensics';

export interface LanguageDetectionOptions {
  isSystemMessage?: boolean;
  hasMediaAttachment?: boolean;
}

const LANGUAGE_LABELS: Record<DetectedLanguage, string> = {
  english: 'English',
  hindi_devanagari: 'Hindi (Devanagari)',
  roman_hindi: 'Roman Hindi',
  hinglish: 'Hinglish (Mixed)',
  unknown: 'Uncertain / Unknown',
};

// High-confidence Roman Hindi lexicon (includes common WhatsApp spelling variants)
// Excluded from English lexicons; 2-letter uppercase acronyms (KA, SE, NE, etc.) are ignored via case guard.
const ROMAN_HINDI_STRONG_WORDS = new Set([
  // Interrogatives & pronouns
  'kya', 'kyaa', 'kyu', 'kyun', 'kyon', 'kaise', 'kese', 'kahan', 'kaha', 'kahaan',
  'kidhar', 'kaun', 'kon', 'kab', 'kitna', 'kitni', 'kitne', 'kisko', 'kisne', 'kiske',
  'kiska', 'kiski', 'kisliye', 'kaisa', 'kaisi',
  'hum', 'ham', 'tum', 'tumhe', 'tumko', 'tumhara', 'tumhari', 'tumhare',
  'aap', 'aapko', 'apko', 'aapka', 'apka', 'aapki', 'apki', 'aapke', 'apke',
  'apna', 'apni', 'apne', 'mujhe', 'mjhe', 'mujhko', 'mujhse', 'mera', 'meri', 'mere',
  'tujhe', 'tjhe', 'tujhko', 'tujhse', 'tera', 'teri', 'tere',
  'hamara', 'humara', 'hamari', 'humari', 'hamare', 'humare',
  'woh', 'voh', 'yeh', 'usko', 'usse', 'usne', 'uska', 'uski', 'uske',
  'unko', 'unse', 'unhone', 'unka', 'unki', 'unke',
  'isko', 'isse', 'isne', 'iska', 'iski', 'iske', 'inko', 'inse', 'inhone',
  'maine', 'mein', 'koi', 'kuch', 'kuchh', 'kisi', 'sab', 'sabhi', 'saare', 'sare',

  // Copulas, auxiliaries, negation, affirmations
  'hai', 'hain', 'hoon', 'hun', 'hota', 'hoti', 'hote', 'tha', 'thi',
  'hoga', 'hogi', 'honge', 'hua', 'hui', 'hue', 'huye',
  'nahi', 'nahin', 'nhi', 'nai', 'nahee', 'mat',
  'haan', 'hanji', 'haanji', 'theek', 'thik', 'thk', 'accha', 'acha', 'achha', 'achaa',
  'bilkul', 'zaroor', 'jarur', 'zaroori', 'jaroori', 'zaruri', 'jaruri', 'sahi', 'galat',
  'badiya', 'badhiya', 'chahiye', 'chahie', 'chaie',

  // Verbs & common inflections / SMS abbreviations
  'karo', 'kro', 'karna', 'krna', 'karni', 'krni', 'karne', 'krne', 'karke', 'krke',
  'karta', 'krta', 'karti', 'krti', 'karte', 'krte', 'kiya', 'kiye', 'kar', 'kr',
  'raha', 'rha', 'rahi', 'rhi', 'rahe', 'rhe',
  'gaya', 'gya', 'gayi', 'gyi', 'gai', 'gaye', 'gye',
  'aaya', 'aya', 'aayi', 'ayi', 'aaye', 'aye', 'aao', 'ao', 'aana', 'aaja', 'aja',
  'aajao', 'ajao', 'aunga', 'aaunga', 'aayega', 'ayega', 'aayegi',
  'jao', 'jana', 'jaana', 'jaega', 'jayega', 'jaunga', 'jaungi', 'jara', 'zara',
  'bata', 'bta', 'batao', 'btao', 'batana', 'btana', 'bataya', 'btaya',
  'bhej', 'bhejo', 'bhejna', 'bheja', 'bheji', 'bheje', 'bhijwa', 'bhijwana',
  'dekh', 'dekho', 'dekhna', 'dekha', 'dekhi', 'dekhe', 'dikhao', 'dikh',
  'bol', 'bolo', 'bolna', 'bola', 'boli', 'bole', 'kaho', 'kehna',
  'sun', 'suno', 'sunna', 'suna', 'suni',
  'ruk', 'ruko', 'rukna', 'ruka', 'ruki', 'chalo', 'chalna', 'chala', 'chali', 'chale',
  'nikal', 'niklo', 'nikalna', 'nikla', 'nikli', 'nikle',
  'pahunch', 'pahuncho', 'pahuncha', 'pahunche', 'pohoch', 'pohocho', 'pohcha', 'pohche', 'phnch', 'ponch',
  'milo', 'milna', 'mila', 'mili', 'mile', 'milte', 'milenge', 'milunga',
  'rakh', 'rakho', 'rakhna', 'rakha', 'rakhi', 'rakhe',
  'chhod', 'chhodo', 'chod', 'chodo', 'chhodna', 'chhoda',
  'pakad', 'pakdo', 'pakadna', 'pakda',
  'lelo', 'leke', 'lekar', 'lena', 'liya', 'liye', 'liyi', 'lunga', 'loonga',
  'dedo', 'deke', 'dekar', 'dena', 'diya', 'diye', 'dunga', 'doonga', 'dega', 'degi', 'denge',
  'lao', 'lana', 'laana', 'laya', 'layi', 'laye', 'launga',
  'samajh', 'samjho', 'samjha', 'samjhe', 'smjh', 'smjha', 'smjhe',
  'pata', 'pta', 'maloom', 'malum', 'lagta', 'lagti', 'lagte', 'laga', 'lagi', 'lage',
  'chahta', 'chahti', 'chahte', 'bhaag', 'bhag', 'bhago', 'chupa', 'chhupa', 'chhupana',
  'khadi', 'khada', 'khade', 'baitha', 'baithe', 'baithi', 'soya', 'soye',

  // Conjunctions, adverbs, time & space
  'lekin', 'magar', 'kyunki', 'kyuki', 'isliye', 'islie', 'toh', 'bhi', 'sirf',
  'abhi', 'abi', 'pehle', 'pahle', 'phle', 'baad', 'turant', 'jaldi', 'jldi', 'fatafat',
  'subah', 'suba', 'dopahar', 'shaam', 'sham', 'raat', 'aaj', 'kal', 'parso', 'roz',
  'yahan', 'yaha', 'wahan', 'waha', 'vahan', 'vaha', 'idhar', 'udhar',
  'upar', 'neeche', 'niche', 'andar', 'bahar', 'paas', 'saath', 'sath',
  'samne', 'saamne', 'peeche', 'piche', 'peechhe', 'bagal', 'taraf', 'baare',
  'bahut', 'bohot', 'bhot', 'bahot', 'zyada', 'jyada', 'thoda', 'thodi', 'thode', 'kaafi', 'kafi',
  'shayad', 'waise', 'sach', 'jhoot', 'jhooth', 'yaani', 'yani', 'matlab', 'arre', 'arey',
  'agar', 'jab', 'tab', 'jaisa', 'jaise', 'waisa', 'waise',
  'wala', 'wali', 'wale', 'walo',

  // Nouns & forensic domain terms in Roman Hindi
  'bhai', 'bhaiya', 'bhaiyya', 'yaar', 'yar', 'dost', 'sahab', 'saab', 'bhaisahab', 'didi', 'behen',
  'paisa', 'paise', 'rupay', 'rupaye', 'rupaiye', 'rupiye', 'udhar', 'karz', 'hisaab', 'hisab',
  'gaadi', 'gadi', 'ghar', 'makaan', 'makan', 'kamra', 'dukaan', 'dukan',
  'sadak', 'gali', 'mohalla', 'gaon', 'shahar', 'jagah', 'ilaka', 'ilaqa', 'chowk',
  'baat', 'baatein', 'batein', 'kaam', 'waqt', 'wakt', 'samay', 'mahina', 'saal', 'ghanta', 'ghante',
  'banda', 'bande', 'aadmi', 'admi', 'ladka', 'ladki', 'logon', 'logo',
  'khabar', 'khatra', 'madad', 'koshish', 'intezar', 'intezaar', 'intezam', 'intezaam',
  'tayar', 'taiyar', 'taiyaar', 'maal', 'saman', 'saaman', 'cheez', 'chiz',
  'thaila', 'jhola', 'dabba', 'kagaz', 'kaagaz', 'dastavez', 'chabi', 'chaabi', 'tala', 'taala',
  'chaku', 'bandook', 'banduk', 'katta', 'goli', 'thane', 'thana', 'daroga', 'khatam', 'khatm',
  'umeed', 'ummeed', 'zaroorat', 'jarurat', 'musibat', 'pareshan', 'pareshani',

  // Numbers in Roman Hindi
  'ek', 'teen', 'paanch', 'panch', 'chhe', 'saat', 'aath', 'nau', 'dus',
  'bees', 'pachas', 'sau', 'hazar', 'hazaar', 'lakh', 'crore',

  // Weak/short particles (lowercase only, filtered for uppercase acronyms)
  'ka', 'ki', 'ke', 'ko', 'se', 'ne', 'pe', 'tak', 'wo', 'ye', 'hu', 'ab', 'ji',
]);

// High-confidence lower-cased Roman Hindi short words that require >=1 extra context token if alone
const ROMAN_HINDI_WEAK_IF_SOLO = new Set([
  'ka', 'ki', 'ke', 'ko', 'se', 'ne', 'pe', 'tak', 'wo', 'ye', 'ab', 'kar', 'kr',
  'aur', 'ya', 'ek', 'kal', 'aaj', 'din', 'kam', 'kaam', 'baat', 'raat',
]);

// High-confidence English words (carefully kept disjoint from ROMAN_HINDI_STRONG_WORDS)
const ENGLISH_STRONG_WORDS = new Set([
  // Core function words & pronouns
  'i', 'you', 'your', 'yours', 'we', 'our', 'ours', 'they', 'their', 'theirs', 'them',
  'she', 'her', 'hers', 'him', 'his', 'its', 'this', 'that', 'these', 'those',
  'and', 'but', 'because', 'although', 'however', 'therefore', 'while', 'unless', 'until',
  'from', 'with', 'without', 'about', 'against', 'between', 'through', 'during',
  'before', 'after', 'above', 'below', 'under', 'over', 'near', 'outside', 'inside',
  'behind', 'around', 'into', 'onto', 'upon', 'across', 'toward', 'towards',
  'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
  'have', 'has', 'had', 'having', 'was', 'were', 'been', 'being', 'am',
  'will', 'would', 'could', 'should', 'shall', 'may', 'might', 'must', 'can', 'cannot',
  'did', 'does', 'doing', 'done', 'not', 'only', 'also', 'just', 'very', 'really',
  'already', 'still', 'yet', 'always', 'never', 'often', 'sometimes', 'usually',
  'someone', 'anyone', 'everyone', 'nobody', 'something', 'anything', 'everything', 'nothing',
  'there', 'here', 'then', 'now', 'soon', 'later', 'immediately', 'currently', 'quickly',

  // Common verbs & forensic/chat domain vocabulary
  'meet', 'meeting', 'reach', 'reached', 'reaching', 'arrive', 'arrived', 'arriving',
  'depart', 'departed', 'heading', 'coming', 'going', 'leaving', 'left', 'waiting', 'wait',
  'bring', 'brought', 'take', 'taken', 'taking', 'give', 'gave', 'given', 'keep', 'kept',
  'send', 'sent', 'sending', 'receive', 'received', 'deliver', 'delivered', 'delivery',
  'collect', 'collected', 'drop', 'dropped', 'pick', 'picked', 'placed', 'parked', 'spotted',
  'check', 'checked', 'checking', 'verify', 'verified', 'confirm', 'confirmed',
  'delete', 'deleted', 'wipe', 'wiped', 'erase', 'erased', 'destroy', 'destroyed',
  'hide', 'hidden', 'call', 'called', 'calling', 'talk', 'talking', 'speak', 'spoke',
  'tell', 'told', 'ask', 'asked', 'said', 'say', 'saw', 'seen', 'look', 'looking',
  'find', 'found', 'know', 'knew', 'think', 'thought', 'believe', 'understand', 'remember',
  'need', 'needed', 'want', 'wanted', 'make', 'made', 'making', 'get', 'getting', 'got',
  'work', 'working', 'help', 'please', 'thank', 'thanks', 'sorry', 'hello', 'hey',
  'morning', 'evening', 'night', 'tonight', 'today', 'tomorrow', 'yesterday', 'midnight',
  'station', 'railway', 'airport', 'terminal', 'highway', 'sector', 'building', 'warehouse',
  'office', 'home', 'hotel', 'hospital', 'market', 'park', 'road', 'street', 'gate', 'plaza',
  'vehicle', 'car', 'white', 'black', 'blue', 'red', 'silver', 'grey', 'gray', 'green',
  'swift', 'scorpio', 'innova', 'fortuner', 'truck', 'bike', 'driver', 'number', 'plate',
  'backpack', 'bag', 'parcel', 'package', 'consignment', 'box', 'drive', 'pendrive', 'laptop',
  'phone', 'mobile', 'camera', 'footage', 'cctv', 'record', 'records', 'message', 'messages',
  'chat', 'history', 'backup', 'report', 'document', 'documents', 'papers', 'property',
  'agreement', 'contract', 'deed', 'ledger', 'account', 'bank', 'statement', 'invoice',
  'receipt', 'file', 'folder', 'money', 'cash', 'payment', 'transfer', 'amount', 'rupees',
  'urgent', 'important', 'ready', 'fine', 'good', 'great', 'bad', 'safe', 'clean', 'clear',
  'secret', 'problem', 'issue', 'matter', 'plan', 'time', 'date', 'spot', 'point', 'area',
  'location', 'address', 'city', 'town', 'police', 'officer', 'inspector', 'advocate',
  'kitchen', 'birthday', 'cake', 'knife', 'pistol', 'gun', 'firearm', 'weapon', 'bullet',
  'shoot', 'shot', 'kill', 'killing', 'dead', 'tired', 'movie', 'film', 'game', 'email',
  'brother', 'friend', 'team', 'schedule', 'scheduled', 'available', 'possible', 'actually',
  'seriously', 'definitely', 'probably', 'maybe', 'sure', 'right', 'wrong', 'true', 'false',
  'same', 'other', 'another', 'both', 'each', 'every', 'many', 'much', 'more', 'most',
  'first', 'last', 'next', 'early', 'late', 'fast', 'slow', 'old', 'new', 'big', 'small',
  'share', 'shared', 'cancel', 'cancelled', 'canceled', 'photo', 'photos', 'video', 'audio',
  'status', 'alert', 'route', 'group', 'busy', 'free', 'open', 'close', 'closed',
  'start', 'started', 'stop', 'stopped', 'change', 'changed', 'update', 'updated',
  'forward', 'forwarded', 'block', 'blocked', 'online', 'offline', 'details', 'screenshot',
  'ticket', 'train', 'flight', 'rent', 'bill', 'password', 'doctor', 'school', 'college',
  'branch', 'weekend', 'address', 'miss', 'missed', 'join', 'joined', 'leave',
]);

// Words ambiguous between English and Roman Hindi (require contextual bigram disambiguation)
const AMBIGUOUS_SHARED_WORDS = new Set([
  'me', 'to', 'he', 'is', 'the', 'par', 'per', 'main', 'do', 'in', 'no', 'na',
  'or', 'hi', 'are', 'log', 'bus', 'bas', 'us', 'at', 'on', 'so', 'as', 'an', 'of',
  'by', 'up', 'my', 'for', 'man', 'bat', 'rat', 'mat', 'ram', 'sun', 'mar', 'pal',
  'all', 'too', 'sir', 'madam', 'boss', 'bro', 'ya', 'yo', 'a',
]);

// Neutral universal chat particles / interjections that shouldn't bias language alone
const NEUTRAL_ACK_WORDS = new Set([
  'ok', 'okay', 'k', 'kk', 'hmm', 'hm', 'hmmm', 'oh', 'ah', 'uh', 'umm',
  'yes', 'yeah', 'yep', 'nope', 'lol', 'haha', 'hahaha', 'omg', 'btw', 'pls', 'plz',
]);

const HINDI_PAST_PARTICIPLES_BEFORE_THE = new Set([
  'aaye', 'aye', 'gaye', 'gye', 'rahe', 'rhe', 'bole', 'mile', 'rakhe', 'bheje',
  'kiye', 'diye', 'liye', 'hue', 'huye', 'nikle', 'pahunche', 'pohche', 'khade',
  'baithe', 'soye', 'likhe', 'padhe', 'aate', 'jaate', 'rehte', 'karte', 'sunte',
  'dekhe', 'chale', 'chhode', 'pakde', 'samjhe', 'lage', 'banaye', 'laye',
]);

const HINDI_NOUNS_BEFORE_ME_OR_PAR = new Set([
  'ghar', 'raat', 'subah', 'shaam', 'din', 'gaadi', 'gadi', 'dukaan', 'dukan',
  'kamre', 'kamra', 'sadak', 'shahar', 'gaon', 'baad', 'pehle', 'pahle', 'dil',
  'samajh', 'haath', 'hath', 'bagal', 'jagah', 'station', 'office', 'gate', 'road',
  'car', 'bag', 'phone', 'sector', 'building', 'warehouse', 'hotel', 'market', 'park',
]);

const MEDIA_PLACEHOLDER_PATTERNS = [
  /<\s*media\s+omitted\s*>/gi,
  /\b(?:image|video|audio|document|sticker|gif|contact\s+card)\s+omitted\b/gi,
  /\b(?:file\s+attached|this\s+message\s+was\s+deleted|you\s+deleted\s+this\s+message)\b/gi,
];

function collapseRepeatedChars(word: string): string {
  // e.g., "kyaaaa" -> "kyaa" / "kya", "bhaiiii" -> "bhai"
  return word.replace(/(.)\1{2,}/g, '$1');
}

function collapseDoubleToSingle(word: string): string {
  // e.g., "haaan" -> "haan" -> "han", "kyaa" -> "kya"
  return word.replace(/(.)\1+/g, '$1');
}

function isRomanHindiByDictionary(lower: string, original: string): boolean {
  const isAllUpper = original.length >= 2 && original === original.toUpperCase() && /[A-Z]/.test(original);
  // Ignore uppercase 2-3 letter codes like "KA", "SE", "NE", "AP", "DL", "MH"
  if (isAllUpper && original.length <= 3) {
    return false;
  }

  if (ROMAN_HINDI_STRONG_WORDS.has(lower)) return true;

  const collapsed = collapseRepeatedChars(lower);
  if (collapsed !== lower && ROMAN_HINDI_STRONG_WORDS.has(collapsed)) return true;

  const singleCollapsed = collapseDoubleToSingle(lower);
  if (singleCollapsed !== lower && ROMAN_HINDI_STRONG_WORDS.has(singleCollapsed)) return true;

  return false;
}

function hasRomanHindiVerbSuffix(lower: string): boolean {
  if (lower.length < 5) return false;
  if (ENGLISH_STRONG_WORDS.has(lower)) return false;
  return /(?:unga|ungi|aunga|aungi|enge|waala|waali|waale)$/.test(lower);
}

function hasEnglishMorphology(lower: string): boolean {
  if (lower.length < 5) return false;
  if (ROMAN_HINDI_STRONG_WORDS.has(lower)) return false;
  if (/'(?:s|t|re|ve|ll|m|d)$/i.test(lower)) return true;
  if (/(?:tion|sion|ment|ness|able|ible|ship|hood)$/.test(lower)) return true;
  if (lower.endsWith('ing') && !/(?:sing|ring|king|wing|ping)$/.test(lower)) return true;
  if (lower.endsWith('ly') && !/(?:ally|holy|only|ugly|early)$/.test(lower) && lower.length >= 6) return true;
  return false;
}

function isEnglishByDictionary(lower: string): boolean {
  if (ENGLISH_STRONG_WORDS.has(lower)) return true;
  if (hasEnglishMorphology(lower)) return true;
  const collapsed = collapseRepeatedChars(lower);
  if (collapsed !== lower && ENGLISH_STRONG_WORDS.has(collapsed)) return true;
  return false;
}

/**
 * Cleans a working copy of text for linguistic token inspection.
 * NEVER alters the caller's original text.
 */
function prepareWorkingText(rawText: string): string {
  let working = rawText.normalize('NFC');

  // Strip directional marks
  working = working.replace(/[\u200E\u200F\u202A-\u202E\uFEFF\u00AD]/g, '');

  // Strip media placeholder phrases
  for (const pat of MEDIA_PLACEHOLDER_PATTERNS) {
    working = working.replace(pat, ' ');
  }

  // Strip URLs, emails, UPI handles, @mentions, IPv4, Indian vehicle plates, phone numbers
  working = working
    .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, ' ')
    .replace(/\b[a-zA-Z0-9.\-_]{2,}@(?:okhdfcbank|okaxis|okicici|oksbi|paytm|upi|ybl|apl)\b/gi, ' ')
    .replace(/@[a-zA-Z0-9_]{2,}/g, ' ')
    .replace(/\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g, ' ')
    .replace(/\b[A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4}\b/g, ' ')
    .replace(/(?:\+?\d[\d\s\-.:/()]{4,}\d)/g, ' ');

  return working.trim();
}

/**
 * Detect language at the individual message level.
 * Preserves original text untouched; all analysis happens on internal working tokens.
 */
export function detectMessageLanguage(
  text: string,
  options: LanguageDetectionOptions = {}
): MessageLanguageMetadata {
  const working = prepareWorkingText(text || '');

  // Extract Devanagari character & token counts
  const devanagariChars = working.match(/[\u0900-\u097F]/g) || [];
  const latinChars = working.match(/[A-Za-z]/g) || [];
  const totalAlphaChars = devanagariChars.length + latinChars.length;

  const devanagariCharRatio = totalAlphaChars > 0 ? devanagariChars.length / totalAlphaChars : 0;
  const latinCharRatio = totalAlphaChars > 0 ? latinChars.length / totalAlphaChars : 0;

  // Tokenize into Devanagari words and Latin words (preserving order for contextual bigrams)
  const tokenMatches = Array.from(
    working.matchAll(/([\u0900-\u097F]+)|([A-Za-z]+(?:'[A-Za-z]+)?)/g)
  );

  const tokens = tokenMatches.map((m) => ({
    raw: m[0],
    lower: m[0].toLowerCase(),
    isDevanagari: Boolean(m[1]),
    isLatin: Boolean(m[2]),
  }));

  const devanagariTokens = tokens.filter((t) => t.isDevanagari);
  const latinTokens = tokens.filter((t) => t.isLatin);

  const baseSignals = {
    totalTokens: tokens.length,
    devanagariTokenCount: devanagariTokens.length,
    latinTokenCount: latinTokens.length,
    englishMarkerCount: 0,
    romanHindiMarkerCount: 0,
    devanagariCharRatio: Number(devanagariCharRatio.toFixed(3)),
    latinCharRatio: Number(latinCharRatio.toFixed(3)),
  };

  // 0. Empty / media-only / symbol-only / numbers-only guard
  if (tokens.length === 0) {
    return {
      language: 'unknown',
      label: LANGUAGE_LABELS.unknown,
      script: 'unknown',
      confidence: 'low',
      confidenceScore: 0.1,
      isMixed: false,
      isUncertain: true,
      reasons: [
        options.hasMediaAttachment
          ? 'Media placeholder only; insufficient linguistic content to determine language.'
          : 'No alphabetic or Devanagari linguistic tokens detected.',
      ],
      signals: baseSignals,
    };
  }

  // 1. Messages containing Devanagari script
  if (devanagariTokens.length > 0) {
    let englishMarkersInDeva = 0;
    const matchedEnglishWords: string[] = [];

    for (const lt of latinTokens) {
      // Ignore pure uppercase codes/acronyms (e.g., NH, CBI, OTP, PIN, FIR) unless explicitly English word
      const isShortAllCaps = lt.raw.length <= 4 && lt.raw === lt.raw.toUpperCase();
      if (isShortAllCaps && !['OK', 'NO'].includes(lt.raw)) {
        continue;
      }
      if (isEnglishByDictionary(lt.lower) || (lt.lower.length >= 3 && !isRomanHindiByDictionary(lt.lower, lt.raw))) {
        if (isEnglishByDictionary(lt.lower)) {
          englishMarkersInDeva++;
          matchedEnglishWords.push(lt.raw);
        }
      }
    }

    const signals = {
      ...baseSignals,
      englishMarkerCount: englishMarkersInDeva,
      romanHindiMarkerCount: devanagariTokens.length,
    };

    if (englishMarkersInDeva >= 1) {
      const score = Math.min(0.98, 0.72 + Math.min(0.26, (devanagariTokens.length + englishMarkersInDeva) * 0.04));
      return {
        language: 'hinglish',
        label: LANGUAGE_LABELS.hinglish,
        script: 'mixed',
        confidence: devanagariTokens.length + englishMarkersInDeva >= 3 ? 'high' : 'medium',
        confidenceScore: Number(score.toFixed(2)),
        isMixed: true,
        isUncertain: false,
        reasons: [
          `Detected ${devanagariTokens.length} Devanagari Hindi token(s) mixed with English token(s): ${matchedEnglishWords.slice(0, 4).join(', ')}.`,
        ],
        signals,
      };
    }

    // Pure Devanagari Hindi (or Devanagari with neutral/code tokens)
    const confidence: LanguageConfidence = devanagariTokens.length >= 2 ? 'high' : 'medium';
    const score = devanagariTokens.length >= 2 ? 0.96 : 0.78;
    return {
      language: 'hindi_devanagari',
      label: LANGUAGE_LABELS.hindi_devanagari,
      script: latinTokens.length > 0 ? 'mixed' : 'devanagari',
      confidence,
      confidenceScore: score,
      isMixed: false,
      isUncertain: false,
      reasons: [
        `Identified ${devanagariTokens.length} Devanagari script token(s) (${Math.round(devanagariCharRatio * 100)}% Devanagari characters).`,
      ],
      signals,
    };
  }

  // 2. Latin-script-only evaluation (English vs Roman Hindi vs Hinglish vs Uncertain)
  let hindiScore = 0;
  let englishScore = 0;
  let romanHindiMarkerCount = 0;
  let englishMarkerCount = 0;
  const matchedHindi: string[] = [];
  const matchedEnglish: string[] = [];
  const tokenTags: ('hi' | 'en' | 'ambig' | 'neutral' | 'other')[] = [];

  for (let i = 0; i < latinTokens.length; i++) {
    const t = latinTokens[i];
    const prev = i > 0 ? latinTokens[i - 1] : null;
    const next = i < latinTokens.length - 1 ? latinTokens[i + 1] : null;

    if (NEUTRAL_ACK_WORDS.has(t.lower)) {
      tokenTags.push('neutral');
      continue;
    }

    // Contextual bigram disambiguation for ambiguous/homograph words
    if (AMBIGUOUS_SHARED_WORDS.has(t.lower)) {
      let resolved: 'hi' | 'en' | null = null;

      if (t.lower === 'the' && prev && (HINDI_PAST_PARTICIPLES_BEFORE_THE.has(prev.lower) || isRomanHindiByDictionary(prev.lower, prev.raw))) {
        // e.g. "wo log aaye the" -> Hindi "थे"
        resolved = 'hi';
      } else if (t.lower === 'the' && next && !HINDI_PAST_PARTICIPLES_BEFORE_THE.has(prev?.lower || '')) {
        resolved = 'en';
      } else if (t.lower === 'me' && prev && HINDI_NOUNS_BEFORE_ME_OR_PAR.has(prev.lower)) {
        // e.g. "ghar me", "raat me", "baad me", "station me"
        resolved = 'hi';
      } else if (t.lower === 'me' && prev && isEnglishByDictionary(prev.lower)) {
        // e.g. "call me", "meet me", "tell me"
        resolved = 'en';
      } else if (t.lower === 'par' && prev && (HINDI_NOUNS_BEFORE_ME_OR_PAR.has(prev.lower) || isRomanHindiByDictionary(prev.lower, prev.raw))) {
        resolved = 'hi';
      } else if (t.lower === 'do' && prev && ['bhej', 'kar', 'kr', 'de', 'bata', 'bta', 'rakh', 'chhod', 'chod', 'bol', 'nikal', 'paise', 'jaane'].includes(prev.lower)) {
        resolved = 'hi';
      } else if (t.lower === 'do' && next && ['you', 'we', 'they', 'not', 'it', 'this', 'that'].includes(next.lower)) {
        resolved = 'en';
      } else if (t.lower === 'main' && next && (isRomanHindiByDictionary(next.lower, next.raw) || ['aa', 'ja', 'abhi', 'kal', 'aaj'].includes(next.lower))) {
        resolved = 'hi';
      } else if (t.lower === 'main' && next && ['road', 'gate', 'market', 'office', 'door', 'building', 'entrance', 'reason', 'point'].includes(next.lower)) {
        resolved = 'en';
      } else if (t.lower === 'to' && prev && ['ab', 'ye', 'yeh', 'wo', 'woh', 'kal', 'aaj', 'abhi', 'bolo', 'dekho', 'karna', 'aana'].includes(prev.lower)) {
        resolved = 'hi';
      } else if (t.lower === 'to' && next && isEnglishByDictionary(next.lower)) {
        resolved = 'en';
      } else if (t.lower === 'he' && prev && (isRomanHindiByDictionary(prev.lower, prev.raw) || HINDI_NOUNS_BEFORE_ME_OR_PAR.has(prev.lower))) {
        resolved = 'hi';
      } else if (t.lower === 'he' && next && ['is', 'was', 'will', 'has', 'had', 'said', 'told', 'came', 'went'].includes(next.lower)) {
        resolved = 'en';
      } else if (t.lower === 'is' && next && ['waqt', 'wakt', 'jagah', 'taraf', 'liye', 'baat', 'kaam', 'ghar', 'gaadi', 'mahine', 'saal', 'din'].includes(next.lower)) {
        resolved = 'hi';
      } else if (t.lower === 'is' && (next && isEnglishByDictionary(next.lower) || prev && isEnglishByDictionary(prev.lower))) {
        resolved = 'en';
      } else if (t.lower === 'log' && prev && ['wo', 'woh', 'ye', 'yeh', 'hum', 'ham', 'sab', 'tum', 'aap', 'kuch'].includes(prev.lower)) {
        resolved = 'hi';
      } else if (t.lower === 'bas' && next && ['kar', 'karo', 'kro', 'abhi', 'itna', 'yahi'].includes(next.lower)) {
        resolved = 'hi';
      } else if (t.lower === 'na' && prev && ['hai', 'hain', 'karo', 'kro', 'bolo', 'batao', 'aana', 'jana', 'hoga'].includes(prev.lower)) {
        resolved = 'hi';
      } else if (t.lower === 'hi' && prev && ['abhi', 'yahi', 'wahi', 'sabhi', 'ghar', 'aaj', 'kal', 'pehle'].includes(prev.lower)) {
        resolved = 'hi';
      } else if ((t.lower === 'in' || t.lower === 'at' || t.lower === 'on' || t.lower === 'of' || t.lower === 'for' || t.lower === 'my' || t.lower === 'are') && (
        (next && isEnglishByDictionary(next.lower)) || (prev && isEnglishByDictionary(prev.lower))
      )) {
        resolved = 'en';
      }

      if (resolved === 'hi') {
        hindiScore += 0.9;
        romanHindiMarkerCount++;
        matchedHindi.push(t.raw);
        tokenTags.push('hi');
      } else if (resolved === 'en') {
        englishScore += 0.9;
        englishMarkerCount++;
        matchedEnglish.push(t.raw);
        tokenTags.push('en');
      } else {
        tokenTags.push('ambig');
      }
      continue;
    }

    if (isRomanHindiByDictionary(t.lower, t.raw)) {
      const weight = ROMAN_HINDI_WEAK_IF_SOLO.has(t.lower) ? 0.85 : 1.1;
      hindiScore += weight;
      romanHindiMarkerCount++;
      matchedHindi.push(t.raw);
      tokenTags.push('hi');
    } else if (hasRomanHindiVerbSuffix(t.lower)) {
      hindiScore += 1.0;
      romanHindiMarkerCount++;
      matchedHindi.push(t.raw);
      tokenTags.push('hi');
    } else if (isEnglishByDictionary(t.lower)) {
      englishScore += 1.0;
      englishMarkerCount++;
      matchedEnglish.push(t.raw);
      tokenTags.push('en');
    } else {
      tokenTags.push('other');
    }
  }

  // Second pass: resolve remaining ambiguous short words if message has strong surrounding context
  const hasClearHindi = hindiScore >= 1.0;
  const hasClearEnglish = englishScore >= 1.0;

  if (hasClearHindi && !hasClearEnglish) {
    for (let i = 0; i < latinTokens.length; i++) {
      if (tokenTags[i] === 'ambig' && ['me', 'par', 'per', 'main', 'to', 'he', 'is', 'na', 'hi', 'do', 'log', 'bas', 'bus'].includes(latinTokens[i].lower)) {
        hindiScore += 0.5;
        romanHindiMarkerCount++;
        matchedHindi.push(latinTokens[i].raw);
      }
    }
  } else if (hasClearEnglish && !hasClearHindi) {
    for (let i = 0; i < latinTokens.length; i++) {
      if (tokenTags[i] === 'ambig' && ['me', 'to', 'he', 'is', 'the', 'in', 'at', 'on', 'of', 'for', 'my', 'are', 'do', 'no', 'or'].includes(latinTokens[i].lower)) {
        englishScore += 0.5;
        englishMarkerCount++;
        matchedEnglish.push(latinTokens[i].raw);
      }
    }
  }

  const signals = {
    ...baseSignals,
    englishMarkerCount,
    romanHindiMarkerCount,
  };

  // Non-neutral token count used for coverage check
  const substantiveTokens = tokenTags.filter((tag) => tag !== 'neutral').length;

  // Decision logic for Latin-script messages
  // Case A: Hinglish (substantial markers from BOTH Roman Hindi and English)
  if (hindiScore >= 1.0 && englishScore >= 1.0) {
    const combinedRatio = (romanHindiMarkerCount + englishMarkerCount) / Math.max(1, substantiveTokens);
    const confidence: LanguageConfidence =
      hindiScore >= 1.8 && englishScore >= 1.5 && combinedRatio >= 0.45
        ? 'high'
        : 'medium';
    const score = Math.min(0.96, 0.62 + Math.min(0.34, combinedRatio * 0.34));

    return {
      language: 'hinglish',
      label: LANGUAGE_LABELS.hinglish,
      script: 'latin',
      confidence,
      confidenceScore: Number(score.toFixed(2)),
      isMixed: true,
      isUncertain: false,
      reasons: [
        `Mixed Hindi-English markers in Latin script — Hindi: [${matchedHindi.slice(0, 4).join(', ')}]; English: [${matchedEnglish.slice(0, 4).join(', ')}].`,
      ],
      signals,
    };
  }

  // Case B: Roman Hindi (only Roman Hindi markers meet threshold)
  if (hindiScore >= 1.0 && englishScore < 1.0) {
    const ratio = romanHindiMarkerCount / Math.max(1, substantiveTokens);
    const confidence: LanguageConfidence =
      hindiScore >= 2.0 && ratio >= 0.4 ? 'high' : 'medium';
    const score =
      confidence === 'high'
        ? Math.min(0.96, 0.72 + Math.min(0.24, ratio * 0.24))
        : Math.min(0.79, 0.58 + Math.min(0.2, ratio * 0.2));

    return {
      language: 'roman_hindi',
      label: LANGUAGE_LABELS.roman_hindi,
      script: 'latin',
      confidence,
      confidenceScore: Number(score.toFixed(2)),
      isMixed: false,
      isUncertain: false,
      reasons: [
        `Roman Hindi lexical markers identified: [${matchedHindi.slice(0, 5).join(', ')}]${englishMarkerCount > 0 ? ' (negligible English overlap)' : ''}.`,
      ],
      signals,
    };
  }

  // Case C: English (only English markers meet threshold)
  if (englishScore >= 1.0 && hindiScore < 1.0) {
    const ratio = englishMarkerCount / Math.max(1, substantiveTokens);
    const confidence: LanguageConfidence =
      englishScore >= 2.0 && ratio >= 0.4 ? 'high' : 'medium';
    const score =
      confidence === 'high'
        ? Math.min(0.97, 0.72 + Math.min(0.25, ratio * 0.25))
        : Math.min(0.79, 0.58 + Math.min(0.2, ratio * 0.2));

    return {
      language: 'english',
      label: LANGUAGE_LABELS.english,
      script: 'latin',
      confidence,
      confidenceScore: Number(score.toFixed(2)),
      isMixed: false,
      isUncertain: false,
      reasons: [
        `English lexical/morphological markers identified: [${matchedEnglish.slice(0, 5).join(', ')}].`,
      ],
      signals,
    };
  }

  // Case D: Uncertain / Unknown (too short, ambiguous, names/places only, chat acks, or out-of-vocabulary)
  return {
    language: 'unknown',
    label: LANGUAGE_LABELS.unknown,
    script: latinTokens.length > 0 ? 'latin' : 'unknown',
    confidence: 'low',
    confidenceScore: 0.25,
    isMixed: false,
    isUncertain: true,
    reasons: [
      substantiveTokens === 0
        ? 'Message contains only short neutral chat acknowledgments (e.g., "ok", "hmm") with no decisive language markers.'
        : `Insufficient decisive markers across ${substantiveTokens} token(s) (possible proper nouns, codes, or ambiguous short text).`,
    ],
    signals,
  };
}
