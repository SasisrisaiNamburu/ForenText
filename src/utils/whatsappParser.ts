/**
 * ForenText WhatsApp & Messaging Text Export Parser
 * Supports iOS, Android, 12h/24h timestamps, multiline messages,
 * media placeholders, system events, and line-level forensic integrity.
 */

import {
  MessageRecord,
  EvidenceMetadata,
  ForensicCase,
  DetectedLanguage,
  EvidenceFormat,
} from '../types/forensics';
import { extractEntitiesFromMessage, buildNormalisationGroups } from './nlpExtractor';
import { classifyMessageRelevance } from './relevanceClassifier';
import { buildMessageCorrelations, buildEventClusters } from './correlationEngine';
import { runHybridPipeline } from './hybridPipeline';
import { computeSHA256 } from './hashHelper';
import { detectMessageLanguage } from './languageDetector';

export interface RawParsedMessageRecord {
  id: number;
  rawLineIndex: number;
  timestamp: string;
  timestampRaw: string;
  dateStr: string;
  hour: number;
  sender: string;
  text: string;
  isSystemMessage: boolean;
}

// Regular expressions for common WhatsApp export header formats:
// 1. iOS: [12/05/2024, 11:30:15 PM] John Doe: Hello
// 2. iOS short year: [12/05/24, 23:30:15] John Doe: Hello
// 3. Android: 12/05/24, 11:30 - John Doe: Hello
// 4. Android with seconds/AM: 12/05/2024, 11:30:45 am - John Doe: Hello
// 5. US format: 5/12/24, 11:30 AM - John Doe: Hello
// 6. ISO format: 2024-05-12, 11:30 - John Doe: Hello

interface ParsedHeader {
  rawTimestamp: string;
  sender: string;
  content: string;
  isSystem: boolean;
  dateStr: string;
  hour: number;
  formattedTimestamp: string;
}

// Enhanced Regex for WhatsApp timestamp headers:
// Supports:
// 1. Bracketed iOS: [12/05/2024, 11:30:15 PM] or [12.05.24, 23:30:15] or [12-05-2024, 11:30 AM]
// 2. Dash Android: 12/05/2024, 11:30 - or 12/05/24, 11:30:15 am - or 12.05.2024, 11:30 - or 2024-05-12, 11:30 -
// 3. Colon/Space Android: 12/05/2024, 11:30: Sender: ...
// 4. International AM/PM variants: am, pm, AM, PM, a. m., p. m., a.m., p.m.

// Match bracketed timestamp at start of line: [date, time]
const BRACKETED_HEADER_REGEX =
  /^\[(\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}[,\s]+(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp]\.?\s*[Mm]\.?)?))\]\s+(.*)$/;

// Match unbracketed timestamp followed by dash or separator: date, time - ...
const DASH_HEADER_REGEX =
  /^(\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}[,\s]+(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp]\.?\s*[Mm]\.?)?))\s*[-–—]\s+(.*)$/;

// Match unbracketed timestamp followed directly by colon or tab: date, time: ...
const COLON_HEADER_REGEX =
  /^(\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,4}[,\s]+(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp]\.?\s*[Mm]\.?)?)):\s+(.*)$/;

// Media placeholder patterns
const MEDIA_PATTERNS = [
  '<media omitted>',
  'image omitted',
  'video omitted',
  'audio omitted',
  'document omitted',
  'sticker omitted',
  'gif omitted',
  'contact card omitted',
  'location:',
  'live location',
  'file attached',
];

// System message indicators
const SYSTEM_PATTERNS = [
  'messages and calls are end-to-end encrypted',
  'created group',
  'added',
  'left',
  'removed',
  'changed the subject',
  'changed the group',
  'security code changed',
  "you're now an admin",
  'disappearing messages',
  'joined using this group',
  'changed their phone number',
  'waiting for this message',
];

/**
 * Standardize date, hour, and formatted timestamp from raw timestamp strings or epoch numbers.
 */
export function normalizeForensicTimestamp(rawInput: string | number | undefined | null): {
  dateStr: string;
  hour: number;
  formattedTimestamp: string;
  timestampRaw: string;
  parsedValid: boolean;
} {
  if (rawInput === undefined || rawInput === null || String(rawInput).trim() === '') {
    return {
      dateStr: 'Unknown',
      hour: 12,
      formattedTimestamp: 'Unknown Timestamp',
      timestampRaw: '',
      parsedValid: false,
    };
  }

  // Handle numeric Unix timestamps (seconds or milliseconds)
  if (typeof rawInput === 'number' || /^\d{10}(\.\d+)?$|^\d{13}$/.test(String(rawInput).trim())) {
    const rawStr = String(rawInput).trim();
    const num = Number(rawStr);
    if (!Number.isNaN(num) && num > 0) {
      const ms = rawStr.split('.')[0].length <= 10 ? Math.round(num * 1000) : Math.round(num);
      const d = new Date(ms);
      if (!Number.isNaN(d.getTime())) {
        const pad = (n: number) => n.toString().padStart(2, '0');
        const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
        const hh = d.getUTCHours();
        const mm = pad(d.getUTCMinutes());
        return {
          dateStr,
          hour: hh,
          formattedTimestamp: `${dateStr} ${pad(hh)}:${mm}`,
          timestampRaw: rawStr,
          parsedValid: true,
        };
      }
    }
  }

  // Clean invisible Unicode marks, non-breaking spaces, and trim
  const clean = String(rawInput)
    .replace(/[\u200E\u200F\u202A-\u202E\uFEFF\u00AD]/g, '')
    .replace(/[\u202F\u00A0]/g, ' ')
    .trim();

  // ISO 8601 date-time string: e.g. 2024-05-12T11:30:15 or 2024-05-12T11:30:15Z
  const isoMatch = clean.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (isoMatch) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = parseInt(isoMatch[1], 10);
    const month = Math.min(Math.max(parseInt(isoMatch[2], 10), 1), 12);
    const day = Math.min(Math.max(parseInt(isoMatch[3], 10), 1), 31);
    const hh = Math.min(Math.max(parseInt(isoMatch[4], 10), 0), 23);
    const mm = pad(Math.min(Math.max(parseInt(isoMatch[5], 10), 0), 59));
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    return {
      dateStr,
      hour: hh,
      formattedTimestamp: `${dateStr} ${pad(hh)}:${mm}`,
      timestampRaw: clean,
      parsedValid: true,
    };
  }

  // Match slash/dash/dot date + time components (WhatsApp iOS/Android, CSV exports)
  const match = clean.match(
    /(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?\s*[Mm]\.?)?/i
  );

  if (match) {
    const p1 = parseInt(match[1], 10);
    const p2 = parseInt(match[2], 10);
    const p3 = parseInt(match[3], 10);
    let hh = parseInt(match[4], 10);
    const mm = match[5];
    const ampmRaw = match[7];
    const ampm = ampmRaw ? ampmRaw.replace(/[\.\s]/g, '').toUpperCase() : null;

    let year = 2024;
    let month = 1;
    let day = 1;

    if (p1 > 1000) {
      // YYYY-MM-DD
      year = p1;
      month = p2;
      day = p3;
    } else if (p3 > 1000 || p3 < 100) {
      year = p3 < 100 ? 2000 + p3 : p3;
      if (p1 > 12) {
        day = p1;
        month = p2;
      } else if (p2 > 12) {
        month = p1;
        day = p2;
      } else {
        // Standard DD/MM/YYYY
        day = p1;
        month = p2;
      }
    }

    if (ampm === 'PM' && hh < 12) hh += 12;
    if (ampm === 'AM' && hh === 12) hh = 0;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const safeMonth = Math.min(Math.max(month, 1), 12);
    const safeDay = Math.min(Math.max(day, 1), 31);
    const dateStr = `${year}-${pad(safeMonth)}-${pad(safeDay)}`;
    const formattedTimestamp = `${dateStr} ${pad(hh)}:${mm}`;

    return { dateStr, hour: hh, formattedTimestamp, timestampRaw: clean, parsedValid: true };
  }

  // Date-only (YYYY-MM-DD or DD/MM/YYYY)
  const dateOnlyMatch = clean.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})$/);
  if (dateOnlyMatch) {
    const p1 = parseInt(dateOnlyMatch[1], 10);
    const p2 = parseInt(dateOnlyMatch[2], 10);
    const p3 = parseInt(dateOnlyMatch[3], 10);
    let year = 2024;
    let month = 1;
    let day = 1;
    if (p1 > 1000) {
      year = p1;
      month = p2;
      day = p3;
    } else {
      year = p3 < 100 ? 2000 + p3 : p3;
      if (p1 > 12) {
        day = p1;
        month = p2;
      } else if (p2 > 12) {
        month = p1;
        day = p2;
      } else {
        day = p1;
        month = p2;
      }
    }
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${year}-${pad(Math.min(Math.max(month, 1), 12))}-${pad(Math.min(Math.max(day, 1), 31))}`;
    return {
      dateStr,
      hour: 0,
      formattedTimestamp: `${dateStr} 00:00`,
      timestampRaw: clean,
      parsedValid: true,
    };
  }

  // Natural date fallback (e.g. "12 May 2024 22:30" or "May 12, 2024 10:30 PM")
  const parsedDate = new Date(clean);
  if (!Number.isNaN(parsedDate.getTime()) && /\d{4}/.test(clean)) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}`;
    const hh = parsedDate.getHours();
    const mm = pad(parsedDate.getMinutes());
    return {
      dateStr,
      hour: hh,
      formattedTimestamp: `${dateStr} ${pad(hh)}:${mm}`,
      timestampRaw: clean,
      parsedValid: true,
    };
  }

  return {
    dateStr: 'Unknown',
    hour: 12,
    formattedTimestamp: clean,
    timestampRaw: clean,
    parsedValid: false,
  };
}

function parseTimestampComponents(rawTimestamp: string): {
  dateStr: string;
  hour: number;
  formattedTimestamp: string;
} {
  const normalized = normalizeForensicTimestamp(rawTimestamp);
  return {
    dateStr: normalized.dateStr === 'Unknown' ? '2024-05-12' : normalized.dateStr,
    hour: normalized.hour,
    formattedTimestamp: normalized.formattedTimestamp,
  };
}

/**
 * Check if a line starts a new WhatsApp message header
 * Handles invisible directional control characters (LTR \u200E, RTL \u200F, BOM \uFEFF)
 */
function matchMessageHeader(line: string): ParsedHeader | null {
  // CRITICAL: Strip Unicode directional marks and non-breaking spaces
  const cleanLine = line
    .replace(/[\u200E\u200F\u202A-\u202E\uFEFF\u00AD]/g, '')
    .replace(/[\u202F\u00A0]/g, ' ')
    .trim();

  if (!cleanLine) return null;

  let rawTimestamp = '';
  let restOfLine = '';

  // 1. Bracketed format: [12/05/2024, 11:30:15 PM] ...
  const bracketMatch = cleanLine.match(BRACKETED_HEADER_REGEX);
  if (bracketMatch) {
    rawTimestamp = bracketMatch[1];
    restOfLine = bracketMatch[2].trim();
  } else {
    // 2. Dash format: 12/05/2024, 11:30 - ...
    const dashMatch = cleanLine.match(DASH_HEADER_REGEX);
    if (dashMatch) {
      rawTimestamp = dashMatch[1];
      restOfLine = dashMatch[2].trim();
    } else {
      // 3. Colon format: 12/05/2024, 11:30: ...
      const colonMatch = cleanLine.match(COLON_HEADER_REGEX);
      if (colonMatch) {
        rawTimestamp = colonMatch[1];
        restOfLine = colonMatch[2].trim();
      }
    }
  }

  if (!rawTimestamp) return null;

  // Now parse sender and content from restOfLine
  // Format is typically: "Sender Name: Message content"
  // If no colon or matches system patterns, it is a system notification
  const colonIndex = restOfLine.indexOf(': ');
  let sender = '';
  let content = '';
  let isSystem = false;

  if (colonIndex !== -1) {
    const potentialSender = restOfLine.substring(0, colonIndex).trim();
    const potentialContent = restOfLine.substring(colonIndex + 2).trim();

    // Check if potential sender is actually part of a system notice
    const isSystemText = SYSTEM_PATTERNS.some((p) =>
      restOfLine.toLowerCase().includes(p)
    );

    if (isSystemText && potentialSender.length > 35) {
      isSystem = true;
      sender = 'System Event';
      content = restOfLine;
    } else {
      sender = potentialSender;
      content = potentialContent;
    }
  } else {
    // No colon, e.g. "Messages and calls are end-to-end encrypted" or "John Doe left"
    isSystem = true;
    sender = 'System Event';
    content = restOfLine;
  }

  const { dateStr, hour, formattedTimestamp } = parseTimestampComponents(rawTimestamp);

  return {
    rawTimestamp,
    sender: sender || 'Unknown Participant',
    content,
    isSystem,
    dateStr,
    hour,
    formattedTimestamp,
  };
}

/**
 * Check if a line starts a new WhatsApp message header (exported for HTML/plain line parsing reuse)
 */
export function parseWhatsAppHeaderLine(line: string): ParsedHeader | null {
  return matchMessageHeader(line);
}

/**
 * Enrich normalized parsed records from any supported input format (.txt, .csv, .json, .html)
 * through language detection, rule/NLP entity & relevance extraction, correlations,
 * events, and the hybrid AI + translation pipeline.
 */
export async function buildForensicCaseFromParsedRecords(options: {
  rawContent: string;
  filename: string;
  fileSizeBytes: number;
  isDemo?: boolean;
  sourceFormat: EvidenceFormat;
  rawRecords: RawParsedMessageRecord[];
  warnings?: string[];
}): Promise<ForensicCase> {
  const {
    rawContent,
    filename,
    fileSizeBytes,
    isDemo = false,
    sourceFormat,
    rawRecords,
    warnings = [],
  } = options;

  if (rawRecords.length === 0) {
    throw new Error(
      'No valid messaging records could be identified in the uploaded file.'
    );
  }

  const sha256 = await computeSHA256(rawContent);
  const totalLines = rawContent.split(/\r?\n/).length;
  const senderSet = new Set<string>();
  const messages: MessageRecord[] = [];

  for (const raw of rawRecords) {
    finalizeMessage(
      {
        id: raw.id,
        rawLineIndex: raw.rawLineIndex,
        timestamp: raw.timestamp,
        timestampRaw: raw.timestampRaw,
        dateStr: raw.dateStr,
        hour: raw.hour,
        sender: raw.sender,
        textLines: [raw.text],
        isSystemMessage: raw.isSystemMessage,
      },
      messages,
      senderSet
    );
  }

  // Aggregate all extracted entities and findings across messages
  const allEntities = messages.flatMap((m) => m.entities);
  const allFindings = messages.flatMap((m) => m.flaggedFindings);

  // Compute Message Correlations & Event Clusters
  const baseCorrelations = buildMessageCorrelations(messages);
  const baseEvents = buildEventClusters(messages, baseCorrelations);
  const normalisationGroups = buildNormalisationGroups(allEntities);

  // Execute Hybrid (Rule + NLP + AI + Translation) Pipeline
  const hybridResult = await runHybridPipeline(
    messages,
    allEntities,
    allFindings,
    baseCorrelations,
    baseEvents
  );
  const finalMessages = hybridResult.messages;

  // Determine chronological range
  const dates = finalMessages
    .map((m) => m.dateStr)
    .filter((d) => Boolean(d) && d !== 'Unknown')
    .sort();
  const dateRange = {
    start: dates[0] || 'Unknown',
    end: dates[dates.length - 1] || 'Unknown',
  };

  // Aggregate per-message language distribution for non-system records
  const languageCounts: Record<DetectedLanguage, number> = {
    english: 0,
    hindi_devanagari: 0,
    roman_hindi: 0,
    hinglish: 0,
    unknown: 0,
  };
  let analyzedLanguageCount = 0;
  for (const m of finalMessages) {
    if (!m.isSystemMessage) {
      languageCounts[m.languageInfo.language]++;
      analyzedLanguageCount++;
    }
  }

  const metadata: EvidenceMetadata = {
    filename,
    fileSizeBytes,
    sha256,
    parsedAt: new Date().toISOString(),
    totalLines,
    totalMessages: finalMessages.length,
    systemMessages: finalMessages.filter((m) => m.isSystemMessage).length,
    senders: Array.from(senderSet).sort(),
    dateRange,
    isDemo,
    warnings,
    languageSummary: {
      counts: languageCounts,
      totalAnalyzed: analyzedLanguageCount,
    },
    sourceFormat,
  };

  return {
    metadata,
    messages: finalMessages,
    entities: hybridResult.entities,
    findings: hybridResult.findings,
    correlations: hybridResult.correlations,
    events: hybridResult.events,
    normalisationGroups,
    hybridStats: hybridResult.hybridStats,
    rawText: rawContent,
  };
}

/**
 * Parse raw WhatsApp / plain text lines into normalized RawParsedMessageRecords
 */
export function parseWhatsAppLines(
  rawContent: string,
  existingWarnings: string[] = []
): { rawRecords: RawParsedMessageRecord[]; warnings: string[] } {
  const lines = rawContent.split(/\r?\n/);
  const rawRecords: RawParsedMessageRecord[] = [];
  const warnings: string[] = [...existingWarnings];

  let currentMsg: {
    id: number;
    rawLineIndex: number;
    timestamp: string;
    timestampRaw: string;
    dateStr: string;
    hour: number;
    sender: string;
    textLines: string[];
    isSystemMessage: boolean;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const header = matchMessageHeader(line);

    if (header) {
      if (currentMsg) {
        rawRecords.push({
          id: currentMsg.id,
          rawLineIndex: currentMsg.rawLineIndex,
          timestamp: currentMsg.timestamp,
          timestampRaw: currentMsg.timestampRaw,
          dateStr: currentMsg.dateStr,
          hour: currentMsg.hour,
          sender: currentMsg.sender,
          text: currentMsg.textLines.join('\n').trim(),
          isSystemMessage: currentMsg.isSystemMessage,
        });
      }

      currentMsg = {
        id: rawRecords.length + 1,
        rawLineIndex: lineNum,
        timestamp: header.formattedTimestamp,
        timestampRaw: header.rawTimestamp,
        dateStr: header.dateStr,
        hour: header.hour,
        sender: header.sender,
        textLines: [header.content],
        isSystemMessage: header.isSystem,
      };
    } else if (currentMsg) {
      currentMsg.textLines.push(line);
    } else if (line.trim().length > 0) {
      warnings.push(
        `Line ${lineNum}: Unattributed text before initial message header ("${line.substring(0, 40)}...")`
      );
    }
  }

  if (currentMsg) {
    rawRecords.push({
      id: currentMsg.id,
      rawLineIndex: currentMsg.rawLineIndex,
      timestamp: currentMsg.timestamp,
      timestampRaw: currentMsg.timestampRaw,
      dateStr: currentMsg.dateStr,
      hour: currentMsg.hour,
      sender: currentMsg.sender,
      text: currentMsg.textLines.join('\n').trim(),
      isSystemMessage: currentMsg.isSystemMessage,
    });
  }

  return { rawRecords, warnings };
}

/**
 * Parse an entire raw text file into structured MessageRecords and ForensicCase
 */
export async function parseWhatsAppExport(
  rawContent: string,
  filename: string,
  fileSizeBytes: number,
  isDemo = false
): Promise<ForensicCase> {
  const { rawRecords, warnings } = parseWhatsAppLines(rawContent);

  if (rawRecords.length === 0) {
    throw new Error(
      'No valid messaging records could be identified in the uploaded file. Please ensure the file is a standard WhatsApp or text messaging export containing timestamps.'
    );
  }

  return buildForensicCaseFromParsedRecords({
    rawContent,
    filename,
    fileSizeBytes,
    isDemo,
    sourceFormat: 'txt',
    rawRecords,
    warnings,
  });
}

function finalizeMessage(
  msg: {
    id: number;
    rawLineIndex: number;
    timestamp: string;
    timestampRaw: string;
    dateStr: string;
    hour: number;
    sender: string;
    textLines: string[];
    isSystemMessage: boolean;
  },
  messages: MessageRecord[],
  senderSet: Set<string>
) {
  const fullText = msg.textLines.join('\n').trim();
  const lower = fullText.toLowerCase();

  // Check for media attachment omission
  const hasMedia = MEDIA_PATTERNS.some((p) => lower.includes(p));
  let mediaDescription: string | undefined = undefined;
  if (hasMedia) {
    if (lower.includes('image omitted')) mediaDescription = 'Image Attachment';
    else if (lower.includes('video omitted')) mediaDescription = 'Video Attachment';
    else if (lower.includes('audio omitted')) mediaDescription = 'Voice/Audio Note';
    else if (lower.includes('document omitted')) mediaDescription = 'Document Attachment';
    else if (lower.includes('contact card omitted')) mediaDescription = 'Contact VCard';
    else if (lower.includes('location')) mediaDescription = 'GPS Location Share';
    else mediaDescription = 'Media Attachment (Omitted)';
  }

  if (!msg.isSystemMessage && msg.sender) {
    senderSet.add(msg.sender);
  }

  // Detect language at individual message level (non-destructive; fullText stays verbatim)
  const languageInfo = detectMessageLanguage(fullText, {
    isSystemMessage: msg.isSystemMessage,
    hasMediaAttachment: hasMedia,
  });

  // Extract entities & classify relevance
  const entities = msg.isSystemMessage ? [] : extractEntitiesFromMessage(fullText, msg.id);
  const { findings } = msg.isSystemMessage
    ? { findings: [] }
    : classifyMessageRelevance(fullText, msg.id, entities);

  messages.push({
    id: msg.id,
    rawLineIndex: msg.rawLineIndex,
    timestamp: msg.timestamp,
    timestampRaw: msg.timestampRaw,
    dateStr: msg.dateStr,
    hour: msg.hour,
    sender: msg.sender,
    text: fullText,
    isSystemMessage: msg.isSystemMessage,
    hasMediaAttachment: hasMedia,
    mediaDescription,
    languageInfo,
    flaggedFindings: findings,
    entities,
    investigatorStatus: 'unreviewed',
  });
}
