/**
 * ForenText Multilingual Discreet & Indirect Suspicious Activity Detector
 * Detects subtle, indirect, non-explicit investigative concerns across:
 *   - English
 *   - Hindi (Devanagari script)
 *   - Roman Hindi
 *   - Hinglish (mixed Hindi-English)
 *
 * Assigns neutral 'Unusual / Contextual Concern – Needs Review' findings (severity: 'needs_review')
 * while suppressing routine/benign ambiguous chatter (standard deliveries, casual passersby, social media).
 */

import { FlaggedFinding } from '../types/forensics';

export interface DiscreetConcernMatch {
  subType:
    | 'unknown_contact'
    | 'following_watching'
    | 'unfamiliar_individual'
    | 'unusual_behaviour'
    | 'unexplained_object'
    | 'unfamiliar_vehicle'
    | 'secrecy_coercion';
  reason: string;
  matchedTokens: string[];
  contextRationale: string;
  confidenceScore: number;
}

const BENIGN_DELIVERY_SERVICE_REGEX =
  /\b(?:delivery|courier|parcel\s+(?:aaya|arrived|delivered|ka)|order\s+(?:aaya|arrived|delivery|ka)|amazon|flipkart|swiggy|zomato|dunzo|blinkit|zepto|bigbasket|myntra|meesho|bluedart|delhivery|dtdc|postman|plumber|electrician|technician|customer\s*care|helpline|otp|cab\s+driver|ola|uber|rapido|delivery\s*(?:boy|wala|agent|partner|executive))\b|डिलीवरी|कूरियर|ऑर्डर/i;

const CONCERNING_MODIFIER_REGEX =
  /\b(?:follow|following|followed|peeche|picha|piche|watching|staring|ghoor|nazar|waiting\s+outside|bahar\s+khada|ajeeb|weird|strange|sketchy|creepy|suspicious|uncomfortable|scared|dar|threat|dhamki|harass|don'?t\s+tell|mat\s+batana|didn'?t\s+order|never\s+ordered|nahi\s+mangwaya|bina\s+order|unknown\s+sender|pata\s+nahi\s+kisne|laawaris|lawaris|unattended|walked\s+away)\b|अजीब|पीछा|घूर|बाहर\s*खड़ा|धमकी|लावारिस|पता\s*नहीं\s*किसने/i;

const SOCIAL_MEDIA_ENTERTAINMENT_FOLLOW_REGEX =
  /\b(?:follow\s+(?:me|us|him|her|back|on)\s+(?:instagram|insta|twitter|x|fb|facebook|snapchat|youtube|linkedin|social)|following\s+(?:the|this)?\s*(?:match|game|series|show|news|tutorial|channel|page)|watching\s+(?:a|the|this)?\s*(?:movie|film|match|cricket|football|game|video|reel|series|show|youtube|tv|news))\b/i;

const BENIGN_ODDITY_CONTEXT_REGEX =
  /\b(?:weird\s+(?:dream|movie|film|song|weather|taste|flavour|flavor|bug|error|code|meme|joke)|taste\s+(?:weird|strange)|ajeeb\s+(?:mazak|sapna|movie|khana|taste))\b/i;

export function detectDiscreetConcerns(text: string): DiscreetConcernMatch[] {
  const clean = (text || '').trim();
  if (!clean) return [];

  const hasBenignDelivery = BENIGN_DELIVERY_SERVICE_REGEX.test(clean);
  const hasConcerningModifier = CONCERNING_MODIFIER_REGEX.test(clean);
  const matches: DiscreetConcernMatch[] = [];

  // 1. Unknown / Unfamiliar Phone Numbers & Repeated Contact Attempts
  const unknownContactPatterns: RegExp[] = [
    /\b(?:unknown|unfamiliar|unrecogni[sz]ed|anonymous|private|strange)\s+(?:number|no\.?|caller|contact)\b/i,
    /\b(?:someone\s+i\s+(?:don'?t|do\s+not|didn'?t)\s+know|stranger)\s+(?:called|texted|messaged|pinged|contacted|keeps?\s+(?:calling|texting|messaging))\b/i,
    /\b(?:repeated|multiple|continuous|keep\s+getting)\s+(?:calls?|messages?|texts?|missed\s+calls?)\s+from\s+(?:an?\s+)?(?:unknown|unidentified|strange|same\s+unknown)\b/i,
    /\b(?:koi|kisi|ek)?\s*(?:unknown|anjaan|anjana|ajnabi)\s*(?:number|no\.?)\s*(?:se|par)?\s*(?:baar\s*[-]?\s*baar\s*)?(?:msg|message|call|missed\s+call|text|phone|ring)\b/i,
    /\b(?:baar\s*[-]?\s*baar)\s*(?:unknown|anjaan|ajnabi)?\s*(?:number\s+se\s+)?(?:call|msg|message|phone)\s*(?:aa\s+rah|aaya|kar\s+rah)/i,
    /\bpata\s+nahi\s+kaun\s+(?:call|msg|message)\s+kar\s+raha\b/i,
    /(?:किसी\s*)?(?:अनजान|अज्ञात|अजनबी)\s*नंबर\s*से\s*(?:बार\s*[-]?\s*बार\s*)?(?:कॉल|फोन|फ़ोन|मैसेज|मेसेज|संदेश)/i,
    /बार\s*[-]?\s*बार\s*(?:अनजान|अज्ञात)?\s*(?:नंबर\s*से\s*)?(?:कॉल|मैसेज|फोन)\s*(?:आ\s*रही|आ\s*रहा)/i,
  ];

  const matchedUnknownContact = unknownContactPatterns.find((rx) => rx.test(clean));
  if (matchedUnknownContact) {
    // Suppress ordinary delivery/service notifications unless concerning cues are also present
    if (!(hasBenignDelivery && !hasConcerningModifier)) {
      const m = clean.match(matchedUnknownContact);
      matches.push({
        subType: 'unknown_contact',
        reason:
          'Contact or repeated outreach from an unidentified/unknown number reported; requires contextual review.',
        matchedTokens: m ? [m[0].trim()] : ['unknown contact'],
        contextRationale:
          'Message reports outreach from an unfamiliar or unidentified phone number outside verified routine delivery context. Ambiguous observation requiring examiner review.',
        confidenceScore: 0.72,
      });
    }
  }

  // 2. Following, Watching, Staring, or Persistent Surveillance-like Presence
  const followingWatchingPatterns: RegExp[] = [
    /\b(?:someone|person|man|woman|guy|he|she|they|stranger)\s+(?:was|is|were|kept)?\s*(?:watching|staring\s+at|following|trailing|stalking|eyeing|observing|lurking)\s*(?:us|me|him|her|around|our|my)?\b/i,
    /\b(?:following|followed|tails?|trailing)\s+(?:me|us)\b/i,
    /\bkept\s+(?:looking|staring|watching)\s+at\s+(?:me|us|the\s+house|our)\b/i,
    /\b(?:woh|vo|koi|ek\s+aadmi)?\s*(?:baar\s*[-]?\s*baar\s*)?(?:follow|peeche|picha|piche)\s*(?:kar\s+raha|kar\s+rahi|kar\s+rhi|aa\s+raha|aa\s+rahi|laga\s+hua)\b/i,
    /\b(?:dekh|ghoor|taak|nazar\s+rakh)\s+raha\s+(?:tha|hai|thi)\b/i,
    /(?:बार\s*[-]?\s*बार\s*)?(?:पीछा\s*कर\s*रहा|पीछे\s*आ\s*रहा|घूर\s*रहा|नज़र\s*रख\s*रहा|नजर\s*रख\s*रहा|देख\s*रहा\s*था)/i,
  ];

  const matchedFollowWatch = followingWatchingPatterns.find((rx) => rx.test(clean));
  if (matchedFollowWatch && !SOCIAL_MEDIA_ENTERTAINMENT_FOLLOW_REGEX.test(clean)) {
    const m = clean.match(matchedFollowWatch);
    matches.push({
      subType: 'following_watching',
      reason:
        'Subject reported someone watching, staring, or following nearby; indirect contextual concern.',
      matchedTokens: m ? [m[0].trim()] : ['watching/following cue'],
      contextRationale:
        'Observed behavior suggests potential surveillance, following, or unwanted attention. Flagged neutrally for investigator review.',
      confidenceScore: 0.78,
    });
  }

  // 3. Unrecognised / Unfamiliar Individuals Waiting or Lingering
  const unfamiliarPersonPatterns: RegExp[] = [
    /\b(?:man|woman|person|guy|someone|individual|fellow)\s+(?:whom\s+)?(?:i|we)\s+(?:don'?t|do\s+not|didn'?t|did\s+not|never)\s+recogni[sz]e\b/i,
    /\b(?:stranger|unfamiliar\s+(?:man|woman|person|guy)|unrecogni[sz]ed\s+(?:man|woman|person|guy)|unknown\s+(?:man|woman|person|guy))\s+(?:was|is|were)?\s*(?:waiting|standing|sitting|lingering|loitering|outside|near|came|knocked|asking)\b/i,
    /\b(?:someone|some\s+guy|some\s+man)\s+(?:was|is)\s+(?:waiting|standing|lingering|loitering)\s+outside\b/i,
    /\b(?:waha|wahan|bahar|gate\s+pe|ghar\s+ke\s+bahar|building\s+ke\s+bahar)\s+(?:koi|kisi)\s+(?:anjaan|ajnabi|unknown)?\s*(?:aadmi|ladka|banda|shakhs|vyakti)\s*(?:khada|baitha|wait|intezaar|ghoom|aaya)?\b/i,
    /\b(?:koi|ek)\s+(?:anjaan|ajnabi|unknown)\s+(?:aadmi|ladka|banda|shakhs|vyakti)\b/i,
    /\b(?:koi\s+aadmi)\s+(?:khada|baitha|wait\s+kar|dekh|pooch)\b/i,
    /\bpata\s+nahi\s+kaun\s+(?:tha|aaya\s+tha|bahar\s+khada)\b/i,
    /(?:कोई\s*)?(?:अनजान|अज्ञात|अजनबी)\s*(?:आदमी|व्यक्ति|लड़का|शख्स|इंसान)/i,
    /(?:वहाँ|वहां|बाहर|गेट\s*पर|घर\s*के\s*बाहर)\s*कोई\s*(?:आदमी|व्यक्ति|लड़का)?\s*(?:खड़ा|बैठा|इंतज़ार|आया)/i,
  ];

  const matchedUnfamiliarPerson = unfamiliarPersonPatterns.find((rx) => rx.test(clean));
  if (matchedUnfamiliarPerson && !(hasBenignDelivery && !hasConcerningModifier)) {
    const m = clean.match(matchedUnfamiliarPerson);
    matches.push({
      subType: 'unfamiliar_individual',
      reason:
        'Presence of an unrecognised or unfamiliar individual waiting or lingering was reported; needs review.',
      matchedTokens: m ? [m[0].trim()] : ['unfamiliar individual'],
      contextRationale:
        'Participant described an unfamiliar or unrecognised individual present or waiting nearby. Requires human assessment of surrounding context.',
      confidenceScore: 0.74,
    });
  }

  // 4. Unusual Behavior / Sender Unease / Intuition Something Is Off
  const unusualBehaviourPatterns: RegExp[] = [
    /\bsomething\s+(?:felt|feels|seems|seemed|looks|looked)\s+(?:off|weird|strange|odd|fishy|wrong|sketchy|suspicious|unusual)\b/i,
    /\b(?:acting|behaving)\s+(?:very\s+)?(?:weird|strange|strangely|odd|oddly|suspicious|suspiciously|nervous|nervously|shady|sketchy|creepily)\b/i,
    /\b(?:unusual|strange|weird|suspicious|odd)\s+behavio[u]?r\b/i,
    /\b(?:doesn'?t|does\s+not|didn'?t|did\s+not)\s+(?:look|seem|feel)\s+right\b/i,
    /\b(?:making\s+me\s+(?:feel\s+)?uncomfortable|bad\s+feeling\s+about\s+this|felt\s+uneasy)\b/i,
    /\b(?:mujhe\s+)?(?:kuch\s+)?ajeeb\s+(?:laga|lag\s+raha|lag\s+rahi|lagta|harkat|behave|behavio[u]?r)\b/i,
    /\b(?:kuch\s+to\s+gadbad|daal\s+mein\s+kuch\s+kala|theek\s+nahi\s+lag\s+raha|sahi\s+nahi\s+laga|shak\s+ho\s+raha)\b/i,
    /(?:मुझे\s*)?(?:कुछ\s*)?अजीब\s*(?:लगा|लग\s*रहा|लग\s*रही|व्यवहार|हरकत)/i,
    /(?:सही|ठीक)\s*नहीं\s*लग\s*रहा|शक\s*हो\s*रहा|दाल\s*में\s*कुछ\s*काला/i,
  ];

  const matchedUnusual = unusualBehaviourPatterns.find((rx) => rx.test(clean));
  if (matchedUnusual && !BENIGN_ODDITY_CONTEXT_REGEX.test(clean)) {
    const m = clean.match(matchedUnusual);
    matches.push({
      subType: 'unusual_behaviour',
      reason:
        'Message expresses sender unease or reports unusual/unexplained behavior; contextual concern needs review.',
      matchedTokens: m ? [m[0].trim()] : ['unusual behaviour cue'],
      contextRationale:
        'Participant reported intuition that a situation or person seemed unusual or concerning. Highlighted neutrally for manual review.',
      confidenceScore: 0.71,
    });
  }

  // 5. Unattended or Unexplained Objects / Packages
  const unexplainedObjectPatterns: RegExp[] = [
    /\b(?:someone|stranger|he|she|they|nobody)\s+(?:left|dropped|kept|placed|put)\s+(?:a|an|some|the)?\s*(?:bag|backpack|package|parcel|box|packet|suitcase|briefcase)\b(?:\s+(?:there|here|outside|near|and\s+walked\s+away|and\s+left))?/i,
    /\b(?:left|kept|placed)\s+(?:a|an|the)?\s*(?:bag|backpack|package|parcel|box|packet)\s+(?:there|outside|near\s+(?:the\s+)?(?:gate|door|building))\b/i,
    /\b(?:don'?t|do\s+not|didn'?t|did\s+not|nobody)\s+know\s+who\s+(?:sent|left|dropped|kept)\s+(?:that|this|the|a)?\s*(?:bag|backpack|package|parcel|box|packet)\b/i,
    /\bunattended\s+(?:bag|backpack|package|parcel|box|suitcase|luggage)\b/i,
    /\b(?:koi|kisi\s+ne)?\s*(?:bag|thaila|parcel|packet|dabba|box)\s+(?:waha|wahan|bahar|idhar)?\s*(?:chhod\s*(?:gaya|diya)|rakh\s*(?:gaya|diya|kar\s+chala))\b/i,
    /\bpata\s+nahi\s+kisne\s+(?:ye|yeh|woh|vo|that)?\s*(?:bag|parcel|packet|box|thaila)\s+(?:bheja|rakha|chhoda)\b/i,
    /\b(?:laawaris|lawaris)\s+(?:bag|thaila|parcel|packet|box|samaan)\b/i,
    /(?:बैग|पैकेट|पार्सल|बॉक्स|थैला)\s*(?:छोड़\s*गया|रख\s*गया|रखकर\s*चला\s*गया|पड़ा\s*था)/i,
    /(?:लावारिस\s*(?:बैग|पार्सल|पैकेट|सामान)|पता\s*नहीं\s*किसने\s*(?:भेजा|रखा|छोड़ा))/i,
  ];

  const matchedObject = unexplainedObjectPatterns.find((rx) => rx.test(clean));
  if (matchedObject && !(hasBenignDelivery && !hasConcerningModifier)) {
    const m = clean.match(matchedObject);
    matches.push({
      subType: 'unexplained_object',
      reason:
        'Unattended or unexplained bag/package observation reported; warrants contextual review.',
      matchedTokens: m ? [m[0].trim()] : ['unexplained object'],
      contextRationale:
        'Message describes an unexplained, unattended, or unattributed bag or parcel. Flagged for investigator verification.',
      confidenceScore: 0.77,
    });
  }

  // 6. Unfamiliar Vehicles / Unusual Vehicle Activity
  const unfamiliarVehiclePatterns: RegExp[] = [
    /\bsomething\s+(?:about\s+)?(?:that|the|this)?\s*(?:car|vehicle|bike|van|suv|truck|auto)\s+(?:doesn'?t|does\s+not|didn'?t)\s+(?:look|seem|feel)\s+right\b/i,
    /\b(?:unfamiliar|unknown|strange|suspicious|same)\s+(?:car|vehicle|bike|van|suv|truck)\s+(?:outside|circling|waiting|parked|again|following|watching|near)\b/i,
    /\b(?:car|vehicle|van|suv)\s+(?:keeps?\s+circling|circling\s+(?:around|outside)|without\s+(?:a\s+)?(?:number\s+)?plate|with\s+no\s+(?:number\s+)?plate|tinted\s+glass)\b/i,
    /\b(?:gaadi|car|bike|van)\s+(?:kuch\s+)?(?:ajeeb|suspicious|theek\s+nahi|sahi\s+nahi)\s+lag\b/i,
    /\b(?:koi|ek)?\s*(?:anjaan|ajnabi|unknown|wahi)\s*(?:gaadi|car|bike|van)\s+(?:bahar|khadi|ghoom|chakkar|wait)\b/i,
    /\bbina\s+number\s+plate\s+(?:ki\s+)?(?:gaadi|car|bike|van)\b/i,
    /(?:अनजान|अजनबी|संदिग्ध)\s*(?:गाड़ी|कार|बाइक|वैन)|(?:गाड़ी|कार).{0,24}(?:अजीब|सही\s*नहीं|चक्कर|बिना\s*नंबर\s*प्लेट)/i,
  ];

  const matchedVehicle = unfamiliarVehiclePatterns.find((rx) => rx.test(clean));
  if (matchedVehicle) {
    const m = clean.match(matchedVehicle);
    matches.push({
      subType: 'unfamiliar_vehicle',
      reason:
        'Unfamiliar or unusual vehicle activity observed; flagged for contextual review.',
      matchedTokens: m ? [m[0].trim()] : ['unusual vehicle cue'],
      contextRationale:
        'Observation describes unfamiliar or concerning vehicle behavior (e.g., circling, missing plates, or odd presence). Requires manual assessment.',
      confidenceScore: 0.76,
    });
  }

  // 7. Requests for Secrecy / Concealment / Indirect Intimidation or Unexpected Contact
  const secrecyCoercionPatterns: RegExp[] = [
    /\b(?:asked|told|warned)\s+me\s+(?:not\s+to|never\s+to)\s+tell\s+(?:anyone|anybody|others|police)\b/i,
    /\b(?:don'?t|do\s+not)\s+tell\s+(?:anyone|anybody)\s+(?:about\s+this|that|who)\b/i,
    /\bkeep\s+(?:this|it)\s+(?:a\s+secret|quiet|between\s+us|to\s+yourself)\b/i,
    /\b(?:nobody|no\s+one)\s+should\s+know\b/i,
    /\b(?:weirdly\s+threatening|implied\s+(?:a\s+)?threat|indirectly\s+threatened|felt\s+(?:intimidated|pressured|coerced))\b/i,
    /\b(?:unplanned|unexpected|strange|secret)\s+(?:meeting|visit|drop-?off|delivery)\b/i,
    /\bkisi\s+ko\s+(?:bhi\s+)?(?:mat|na|nahi)\s+(?:batana|bolna|kehna)\b/i,
    /\bkisi\s+se\s+(?:bhi\s+)?(?:mat|na|kuch\s+mat)\s+(?:batana|kehna|bolna)\b/i,
    /\bchup\s+rehne\s+ko\s+(?:bola|kaha|bol\s+raha)\b/i,
    /\b(?:dhamki\s+jaisa|dara\s+raha\s+(?:tha|hai)|bina\s+bataye\s+milne)\b/i,
    /किसी\s*(?:को|से)\s*(?:भी\s*)?(?:मत|न)\s*(?:बताना|कहना|बोलना)|चुप\s*रहने\s*को\s*(?:कहा|बोला)|धमकी\s*जैसा|डरा\s*रहा/i,
  ];

  const matchedSecrecy = secrecyCoercionPatterns.find((rx) => rx.test(clean));
  if (matchedSecrecy) {
    const m = clean.match(matchedSecrecy);
    matches.push({
      subType: 'secrecy_coercion',
      reason:
        'Request for secrecy, concealment, or indirect intimidation noted; requires contextual review.',
      matchedTokens: m ? [m[0].trim()] : ['secrecy/coercion cue'],
      contextRationale:
        'Message indicates an explicit instruction to conceal information from others or indirect intimidation/unexpected coercion.',
      confidenceScore: 0.79,
    });
  }

  return matches;
}

/**
 * Convert detected discreet concerns into standardized FlaggedFinding items
 * using the Orange – Needs Review priority tier.
 */
export function buildDiscreetConcernFindings(
  text: string,
  messageId: number,
  startingIndex: number
): FlaggedFinding[] {
  const matches = detectDiscreetConcerns(text);
  if (matches.length === 0) return [];

  // Consolidate multiple discreet cues on the same message cleanly into focused findings
  // while keeping distinct matched tokens and rationale.
  const combinedTokens = Array.from(new Set(matches.flatMap((m) => m.matchedTokens)));
  const primary = matches[0];
  const combinedReason =
    matches.length === 1
      ? primary.reason
      : `Multiple contextual concern indicators observed (${matches.map((m) => m.subType.replace('_', ' ')).join(', ')}); requires manual review.`;
  const combinedRationale =
    matches.length === 1
      ? primary.contextRationale
      : matches.map((m) => m.contextRationale).join(' ');

  return [
    {
      id: `flag-discreet-${messageId}-${startingIndex}`,
      messageId,
      category: 'UnusualConcern',
      severity: 'needs_review',
      label: 'Unusual / Contextual Concern – Needs Review',
      reason: combinedReason,
      matchedTokens: combinedTokens,
      isFalsePositiveLikely: false,
      contextRationale: combinedRationale,
      analysisMethod: 'Multilingual Discreet Context & Behavioral Heuristic',
      confidenceScore: Math.max(...matches.map((m) => m.confidenceScore)),
    },
  ];
}
