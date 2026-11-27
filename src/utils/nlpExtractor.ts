/**
 * ForenText v2.0 NLP and Advanced Entity Extraction Engine
 * Modular, deterministic, explainable rule-based extraction
 * 100% offline, privacy-preserving, zero external API calls.
 */

import {
  ExtractedEntity,
  EntityCategory,
  EntityNormalisationGroup,
} from '../types/forensics';

// --- Lexicons & Patterns ---

// Vehicle Registration: Indian State code (2) + District (1-2) + Optional series (1-3) + Unique number (4)
export const VEHICLE_PLATE_REGEX =
  /\b([A-Z]{2}[-\s]?[0-9]{1,2}[-\s]?[A-Z]{1,3}[-\s]?[0-9]{4})\b/g;

// Vehicle descriptive models and types (Cars, SUVs, Bikes, Heavy, Commercial)
export const VEHICLE_MODELS = [
  'swift',
  'scorpio',
  'fortuner',
  'innova',
  'bolero',
  'creta',
  'seltos',
  'thar',
  'safari',
  'harrier',
  'verna',
  'city',
  'i20',
  'i10',
  'wagonr',
  'baleno',
  'altroz',
  'ertiga',
  'duster',
  'dzire',
  'eco',
  'omni',
  'pulsar',
  'bullet',
  'royal enfield',
  'activa',
  'jupiter',
  'splendor',
  'duke',
];

export const VEHICLE_TYPES = [
  'car',
  'suv',
  'sedan',
  'hatchback',
  'bike',
  'motorcycle',
  'scooter',
  'truck',
  'van',
  'auto',
  'autorickshaw',
  'lorry',
  'tanker',
  'jeep',
  'pickup',
  'vehicle',
];

export const COLOR_MODIFIERS = [
  'white',
  'black',
  'silver',
  'grey',
  'gray',
  'red',
  'blue',
  'dark blue',
  'navy blue',
  'yellow',
  'green',
  'golden',
  'maroon',
  'brown',
];

// Objects & Materials (Bags, Packages, Electronics, Weapons, Containers)
export const OBJECT_PATTERNS = [
  // Bags & luggage
  'black backpack',
  'blue backpack',
  'red backpack',
  'backpack',
  'duffel bag',
  'duffle bag',
  'travel bag',
  'cash bag',
  'briefcase',
  'suitcase',
  'trolley bag',
  'poly bag',
  'gunny bag',
  'parcel',
  'packet',
  'package',
  'carton',
  'wooden box',
  'sealed box',
  'container',
  // Electronics & media
  'hard drive',
  'hard disk',
  'pendrive',
  'pen drive',
  'flash drive',
  'usb drive',
  'laptop',
  'sim card',
  'mobile phone',
  'burner phone',
  'cctv footage',
  'memory card',
  'smartwatch',
  'drone',
  // Physical items
  'gold biscuit',
  'cash bundle',
  'token money',
  'iron rod',
  'crowbar',
  'cutter',
  'rope',
  'wire',
];

// Document and financial/legal instrument keywords
export const DOCUMENT_PATTERNS = [
  'property papers',
  'property agreement',
  'blue file',
  'sale deed',
  'title deed',
  'power of attorney',
  'poa draft',
  'land registry',
  'blueprint',
  'aadhaar',
  'aadhar',
  'passport',
  'pan card',
  'voter id',
  'driving license',
  'rc book',
  'agreement',
  'affidavit',
  'tax invoice',
  'invoice',
  'cheque',
  'contract',
  'deed',
  'ledger',
  'bank statement',
  'bill of lading',
  'confidential doc',
  'balance sheet',
  'receipt',
  'memorandum',
  'mou draft',
  'noc certificate',
];

// Weapon terminology
export const WEAPON_PATTERNS = [
  'pistol',
  'revolver',
  '9mm',
  'firearm',
  'weapon',
  'desi katta',
  'country-made',
  'country made pistol',
  'rifle',
  'ammunition',
  'bullets',
  'magazine',
  'barrel',
  'silencer',
  'cartridge',
  'knife',
  'chef knife',
  'kitchen knife',
  'blade',
  'dagger',
  'explosive',
  'detonator',
  'grenade',
];

// Violence & Threat language
export const VIOLENCE_PATTERNS = [
  'kill',
  'eliminate',
  'beat up',
  'break bones',
  'teach a lesson',
  'finish him',
  'wipe out',
  'murder',
  'blood',
  'torture',
  'ransom',
  'hostage',
  'attack',
  'burn down',
  'shoot',
  'stab',
  'threat',
  'consequences',
  'grave danger',
  'take revenge',
  'destroy evidence',
];

// Geographical entities: cities, transit hubs, neighbourhoods, and landmarks
export const GEOGRAPHICAL_LOCATIONS = [
  // Cities & towns (including Andhra/Telangana, NCR, Metros)
  'eluru',
  'powerpet',
  'vijayawada',
  'guntur',
  'rajahmundry',
  'kakinada',
  'visakhapatnam',
  'vizag',
  'hyderabad',
  'secunderabad',
  'warangal',
  'bengaluru',
  'bangalore',
  'whitefield',
  'mg road',
  'delhi',
  'new delhi',
  'connaught place',
  'mumbai',
  'bandra',
  'bandra kurla complex',
  'pune',
  'kolkata',
  'chennai',
  'noida',
  'sector 62',
  'sector 18',
  'sector 15',
  'gurugram',
  'gurgaon',
  'faridabad',
  'ghaziabad',
  'jaipur',
  'chandigarh',
  'ahmedabad',
  'surat',
  'lucknow',
  'patna',
  'nagpur',
  // Specific transport hubs & landmark references
  'powerpet railway station',
  'railway station',
  'metro station',
  'bus stand',
  'bus station',
  'interstate bus terminal',
  'isbt',
  'airport',
  'terminal 3',
  'terminal 1',
  'toll plaza',
  'highway',
  'nh-44',
  'nh-48',
  'nh-16',
  'nh-65',
  'outer ring road',
  'ring road',
  'bypass road',
  'flyover',
  // Facilities & generic landmarks
  'old building',
  'abandoned building',
  'warehouse 7',
  'warehouse',
  'godown',
  'safe house',
  'guest house',
  'dockyard',
  'basement parking',
  'underground cellar',
  'pantry',
  'cafeteria',
];

// Personal names, honorifics, and contact handles
export const PERSON_PREFIX_REGEX =
  /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.|Adv\.|Advocate|Inspector|Officer|Constable|Bhai|Sir|Madam|Captain)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;

export const PERSON_ACTION_REGEX =
  /\b(?:meet|call|contact|ask|tell|pay|alert|warn|send to|saw|informed)\s+([A-Z][a-z]+)\b/g;

export const USERNAME_OR_ALIAS_REGEX =
  /(?:@([a-zA-Z0-9_]{3,24}))|\b(?:alias|codename|handle)\s+["']?([A-Za-z0-9_-]+)["']?/gi;

// Phone, Email, UPI, IP
export const PHONE_REGEX =
  /(?:(?:\+91|91|0)?[-\s]?)?[6-9]\d{9}\b|\b\+?[1-9]\d{1,4}[-\s]?\d{3,4}[-\s]?\d{3,4}\b/g;

export const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

export const UPI_REGEX =
  /\b[a-zA-Z0-9.\-_]{2,256}@(okhdfcbank|okaxis|okicici|oksbi|paytm|upi|ybl|apl)\b/gi;

export const IP_REGEX = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;

// Temporal Expressions
export const DATETIME_REGEX =
  /\b(?:by\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?|\d{1,2}(?::\d{2})\s*(?:am|pm|AM|PM)|\d{1,2}\s*(?:am|pm|AM|PM)|tonight|midnight|tomorrow(?:\s+morning|\s+night|\s+evening)?|yesterday|by\s+friday|by\s+monday|within\s+\d+\s*(?:mins|minutes|hours)|for\s+\d+\s*(?:hours|days)|at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm|o'clock)?|\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*|\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/gi;

/**
 * Extract entities from a single message text
 */
export function extractEntitiesFromMessage(text: string, messageId: number): ExtractedEntity[] {
  const entities: ExtractedEntity[] = [];
  const addedKeys = new Set<string>();

  const addEntity = (
    extractedText: string,
    category: EntityCategory,
    confidence: 'high' | 'medium' | 'pattern_only',
    method: string,
    details?: string,
    normalizedGroup?: string,
    aliasCandidates?: string[]
  ) => {
    const cleanText = extractedText.trim();
    if (!cleanText || cleanText.length < 2) return;
    const key = `${category}:${cleanText.toLowerCase()}`;
    if (addedKeys.has(key)) return;
    addedKeys.add(key);

    entities.push({
      id: `ent-${messageId}-${entities.length + 1}`,
      messageId,
      text: cleanText,
      category,
      confidence,
      method,
      details,
      normalizedGroup,
      aliasCandidates,
      verificationStatus: 'unverified',
    });
  };

  const lowerText = text.toLowerCase();

  // 1. Vehicle Registration Plates
  const plateMatches = text.matchAll(VEHICLE_PLATE_REGEX);
  for (const m of plateMatches) {
    const plate = m[1].replace(/\s+/g, ' ').trim();
    const validStates = [
      'AP', 'TS', 'MH', 'DL', 'KA', 'UP', 'HR', 'GJ', 'TN', 'WB', 'KL', 'RJ', 'PB', 'MP', 'CH', 'BR'
    ];
    const prefix = plate.substring(0, 2).toUpperCase();
    const isKnownState = validStates.includes(prefix);

    addEntity(
      plate,
      'VehiclePlate',
      isKnownState ? 'high' : 'medium',
      'RegEx Pattern Match',
      isKnownState
        ? `Matched Indian State Code (${prefix}) registration plate.`
        : 'Potential vehicle registration plate format.',
      `vehicle_plate:${plate.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      [plate]
    );
  }

  // 2. Vehicle Descriptions & Color Combinations (e.g. "white Swift", "black SUV", "that white car")
  // Check compound phrases: [color] + [model or type]
  for (const color of COLOR_MODIFIERS) {
    for (const model of VEHICLE_MODELS) {
      const phrase = `${color} ${model}`;
      if (lowerText.includes(phrase)) {
        addEntity(
          phrase,
          'Vehicle',
          'high',
          'Compound Vehicle Heuristic',
          `Specific vehicle model and color description (${phrase}).`,
          `vehicle:${model}_${color}`,
          [phrase, `the ${model}`, `that ${color} car`, model]
        );
      }
    }
    for (const type of VEHICLE_TYPES) {
      const phrase = `${color} ${type}`;
      if (lowerText.includes(phrase) && !entities.some((e) => e.text.toLowerCase().includes(phrase))) {
        addEntity(
          phrase,
          'Vehicle',
          'medium',
          'Compound Vehicle Heuristic',
          `Vehicle type with color attribute (${phrase}).`,
          `vehicle:${type}_${color}`,
          [phrase, `the ${type}`, `that ${color} ${type}`]
        );
      }
    }
  }

  // Standalone Vehicle Models (e.g. "the Swift", "Innova", "Scorpio")
  for (const model of VEHICLE_MODELS) {
    const regex = new RegExp(`\\b(?:the\\s+)?(${model})\\b`, 'i');
    const match = text.match(regex);
    if (match) {
      const alreadyCaptured = entities.some(
        (e) => (e.category === 'Vehicle' || e.category === 'VehiclePlate') && e.text.toLowerCase().includes(model)
      );
      if (!alreadyCaptured) {
        addEntity(
          match[0],
          'Vehicle',
          'medium',
          'Vehicle Model Lexicon',
          `Vehicle model mention (${model}).`,
          `vehicle:${model}`,
          [match[0], `the ${model}`]
        );
      }
    }
  }

  // 3. Objects & Materials (e.g. "black backpack", "property papers", "blue file", "pendrive")
  for (const obj of OBJECT_PATTERNS) {
    const regex = new RegExp(`\\b${obj}\\b`, 'i');
    const match = text.match(regex);
    if (match) {
      addEntity(
        match[0],
        'Object',
        'high',
        'Physical Object Lexicon',
        `Physical item, container, or electronic device (${match[0]}).`,
        `object:${obj.replace(/\s+/g, '_')}`
      );
    }
  }

  // 4. Weapons
  for (const pattern of WEAPON_PATTERNS) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    const match = text.match(regex);
    if (match) {
      const isCulinary = /\b(?:kitchen|cut|vegetable|cake|fruit|chef|cooking|chop|salad|dinner|lunch)\b/i.test(text);
      const isGameOrMovie = /\b(?:game|movie|film|pubg|call of duty|gta|cinema|scene|show|acting)\b/i.test(text);

      let details = 'Lexicon match on weapon terminology.';
      if (isCulinary) {
        details += ' [Contextual Indicator: Culinary/Domestic context detected]';
      } else if (isGameOrMovie) {
        details += ' [Contextual Indicator: Media/Entertainment context detected]';
      }

      addEntity(
        match[0],
        'Weapon',
        isCulinary || isGameOrMovie ? 'medium' : 'high',
        'Dictionary / Lexical Heuristic',
        details,
        `weapon:${pattern.replace(/\s+/g, '_')}`
      );
    }
  }

  // 5. Violence & Threat Language
  for (const pattern of VIOLENCE_PATTERNS) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    const match = text.match(regex);
    if (match) {
      const isIdiom = /\b(?:dead tired|killing it|dying of laughter|killing me|shoot an email|broken heart)\b/i.test(text);
      let details = 'Lexicon match on violent or threatening terminology.';
      if (isIdiom) {
        details += ' [Contextual Indicator: Figurative/Colloquial idiom detected]';
      }

      addEntity(
        match[0],
        'Violence',
        isIdiom ? 'medium' : 'high',
        'Lexical Pattern Match',
        details
      );
    }
  }

  // 6. Documents & Legal/Financial Records
  for (const pattern of DOCUMENT_PATTERNS) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    const match = text.match(regex);
    if (match) {
      addEntity(
        match[0],
        'Document',
        'high',
        'Domain Dictionary Match',
        'Official, legal, or financial document reference.',
        `document:${pattern.replace(/\s+/g, '_')}`
      );
    }
  }

  // 7. Geographical Entities (Towns, Stations, Landmarks, Sectors)
  // Check longer specific landmarks first
  const sortedLocations = [...GEOGRAPHICAL_LOCATIONS].sort((a, b) => b.length - a.length);
  for (const loc of sortedLocations) {
    const regex = new RegExp(`\\b${loc}\\b`, 'i');
    const match = text.match(regex);
    if (match) {
      // Avoid re-adding if already included in a longer phrase
      const alreadyCaptured = entities.some(
        (e) => e.category === 'Location' && e.text.toLowerCase().includes(loc)
      );
      if (!alreadyCaptured) {
        const isTransportHub = /railway|station|airport|terminal|toll|bypass|stand/i.test(loc);
        const isLandmark = /building|warehouse|safe house|godown|dockyard|parking|cellar/i.test(loc);

        addEntity(
          match[0],
          'Location',
          isTransportHub || isLandmark ? 'high' : 'medium',
          'Geographical Lexicon Match',
          isTransportHub
            ? 'Identified transit hub / station reference.'
            : isLandmark
            ? 'Identified building / physical landmark.'
            : 'City, region, or spatial reference.',
          `location:${loc.replace(/\s+/g, '_')}`
        );
      }
    }
  }

  // 7b. Dynamic Proper-Noun Landmark / Unfamiliar Locality Extraction (e.g. "near Dadar Gate", "at Guntur Chowk")
  const DYNAMIC_LANDMARK_REGEX =
    /\b(?:at|near|to|from|outside|via|behind|beside|towards)\s+(?:the\s+)?([A-Z][a-zA-Z]{2,}(?:\s+[A-Z0-9][a-zA-Z0-9]*){0,2}\s+(?:Gate|Railway Station|Metro Station|Bus Stand|Station|Harbor|Harbour|Port|Terminal|Road|Street|Nagar|Puram|Ganj|Chowk|Bazaar|Market|Square|Tower|Plaza|Sector|Airport|Complex|Park|Colony|Depot|Bypass|Flyover|Bridge))\b/g;
  const DYNAMIC_LOC_STOPLIST = new Set([
    'The', 'This', 'That', 'Meet', 'Wait', 'Leave', 'Stay', 'Park', 'Parked', 'Reached', 'Reach',
  ]);
  for (const lm of text.matchAll(DYNAMIC_LANDMARK_REGEX)) {
    const candidate = lm[1].trim();
    const firstWord = candidate.split(/\s+/)[0];
    if (DYNAMIC_LOC_STOPLIST.has(firstWord)) continue;
    const alreadyCaptured = entities.some(
      (e) =>
        e.category === 'Location' &&
        (e.text.toLowerCase() === candidate.toLowerCase() ||
          e.text.toLowerCase().includes(candidate.toLowerCase()))
    );
    if (!alreadyCaptured) {
      addEntity(
        candidate,
        'Location',
        'medium',
        'Structural Proper-Noun Landmark Heuristic',
        `Unfamiliar proper-noun locality/landmark reference (${candidate}).`,
        `location:${candidate.toLowerCase().replace(/\s+/g, '_')}`
      );
    }
  }

  // 8. Person Names & Aliases
  // Honorifics (e.g. Mr. Verma, Advocate Sharma, Inspector Rajesh Kumar)
  const honorificMatches = text.matchAll(PERSON_PREFIX_REGEX);
  for (const m of honorificMatches) {
    addEntity(
      m[0],
      'Person',
      'high',
      'Honorific / Title Heuristic',
      'Identified with formal title or professional honorific prefix.',
      `person:${m[1].toLowerCase().replace(/\s+/g, '_')}`
    );
  }

  // Action directives (e.g. "meet Rahul", "ask Amit")
  const actionMatches = text.matchAll(PERSON_ACTION_REGEX);
  for (const m of actionMatches) {
    const candidate = m[1];
    const exclude = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      'Tomorrow', 'Today', 'Tonight', 'Now', 'There', 'Him', 'Her', 'Them', 'The', 'A', 'An'
    ];
    if (!exclude.includes(candidate)) {
      addEntity(
        candidate,
        'Person',
        'medium',
        'Contextual Verb-Subject Rule',
        'Mentioned as subject of directive/action verb.',
        `person:${candidate.toLowerCase()}`
      );
    }
  }

  // Usernames / Aliases (e.g. @shadow_ops24)
  const usernameMatches = text.matchAll(USERNAME_OR_ALIAS_REGEX);
  for (const m of usernameMatches) {
    const handle = m[1] || m[2];
    if (handle) {
      addEntity(
        `@${handle}`,
        'Person',
        'high',
        'Digital Alias / Handle Pattern',
        'Digital username, chat alias, or clandestine handle.',
        `person_alias:${handle.toLowerCase()}`
      );
    }
  }

  // 9. Contact Identifiers (Phone, Email, UPI, IP)
  const phoneMatches = text.matchAll(PHONE_REGEX);
  for (const m of phoneMatches) {
    const raw = m[0].replace(/[\s-]/g, '');
    if (raw.length >= 10 && raw.length <= 13) {
      addEntity(
        m[0].trim(),
        'ContactIdentifier',
        'high',
        'Telephony Number Pattern',
        'Telecommunication contact number.'
      );
    }
  }

  const emailMatches = text.matchAll(EMAIL_REGEX);
  for (const m of emailMatches) {
    addEntity(
      m[0].trim(),
      'ContactIdentifier',
      'high',
      'RFC Email Pattern',
      'Electronic mail address identifier.'
    );
  }

  const upiMatches = text.matchAll(UPI_REGEX);
  for (const m of upiMatches) {
    addEntity(
      m[0].trim(),
      'ContactIdentifier',
      'high',
      'Virtual Payment Address (UPI)',
      'Digital payment identifier handle.'
    );
  }

  const ipMatches = text.matchAll(IP_REGEX);
  for (const m of ipMatches) {
    addEntity(
      m[0].trim(),
      'ContactIdentifier',
      'high',
      'IPv4 Network Address',
      'Network endpoint / IP address.'
    );
  }

  // 10. Temporal Expressions (Dates, Times, Relative Durations)
  const dateMatches = text.matchAll(DATETIME_REGEX);
  for (const m of dateMatches) {
    addEntity(
      m[0].trim(),
      'DateTime',
      'medium',
      'Temporal Expression Rule',
      'Explicit date/time coordination marker.'
    );
  }

  return entities;
}

/**
 * Builds entity normalisation candidate groups across all extracted entities
 * Links potential alternative mentions (e.g., "white Swift", "the Swift", "that white car")
 * without destructive merging.
 */
export function buildNormalisationGroups(
  entities: ExtractedEntity[]
): EntityNormalisationGroup[] {
  const groupMap = new Map<string, EntityNormalisationGroup>();

  for (const ent of entities) {
    if (!ent.normalizedGroup) continue;

    const existing = groupMap.get(ent.normalizedGroup);
    const variantItem = {
      text: ent.text,
      messageId: ent.messageId,
      entityId: ent.id,
    };

    if (existing) {
      // Don't duplicate identical text from same message
      if (!existing.variants.some((v) => v.entityId === ent.id)) {
        existing.variants.push(variantItem);
      }
    } else {
      groupMap.set(ent.normalizedGroup, {
        groupId: ent.normalizedGroup,
        category: ent.category,
        canonicalName: ent.text,
        variants: [variantItem],
        isConfirmedByInvestigator: false,
      });
    }
  }

  // Return groups that have at least one variant, sorting multi-mention candidates to the top
  return Array.from(groupMap.values()).sort(
    (a, b) => b.variants.length - a.variants.length
  );
}
