/**
 * ForenText Multi-Format Evidence Ingestion Parsers
 * Supports .txt (WhatsApp / plain chat exports), .csv, .json, and .html chat exports.
 * Preserves original file content for SHA-256 integrity hashing and delegates all
 * parsed records into ForenText's unified language detection, translation, NLP,
 * correlation, event clustering, and PDF reporting pipeline.
 */

import { EvidenceFormat, ForensicCase } from '../types/forensics';
import {
  RawParsedMessageRecord,
  normalizeForensicTimestamp,
  parseWhatsAppLines,
  parseWhatsAppExport,
  buildForensicCaseFromParsedRecords,
} from './whatsappParser';

export const SUPPORTED_EVIDENCE_EXTENSIONS = ['.txt', '.csv', '.json', '.html', '.htm'] as const;

export function detectEvidenceFormat(filename: string, mimeType = ''): EvidenceFormat {
  const lower = filename.trim().toLowerCase();
  if (lower.endsWith('.txt')) return 'txt';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';

  const mime = mimeType.toLowerCase();
  if (mime === 'text/plain') return 'txt';
  if (mime === 'text/csv' || mime === 'application/csv') return 'csv';
  if (mime === 'application/json' || mime === 'text/json') return 'json';
  if (mime === 'text/html') return 'html';

  throw new Error(
    `Unsupported file format: "${filename}". ForenText supports .txt, .csv, .json, and .html messaging export files.`
  );
}

// ============================================================================
// 1. CSV PARSER (RFC-4180 compliant with delimiter detection & multiline cells)
// ============================================================================

function detectCsvDelimiter(sample: string): string {
  const firstLineEnd = sample.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? sample : sample.slice(0, firstLineEnd);
  let inQuotes = false;
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };

  for (let i = 0; i < firstLine.length; i++) {
    const ch = firstLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch in counts) {
      counts[ch]++;
    }
  }

  let best = ',';
  let max = counts[','];
  for (const delim of [';', '\t']) {
    if (counts[delim] > max) {
      max = counts[delim];
      best = delim;
    }
  }
  return best;
}

interface CsvParsedRow {
  startLine: number;
  fields: string[];
}

function parseCsvMatrix(raw: string, delimiter: string): CsvParsedRow[] {
  const clean = raw.replace(/^\uFEFF/, '');
  const rows: CsvParsedRow[] = [];

  let currentFields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let currentLine = 1;
  let rowStartLine = 1;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"') {
        if (next === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') currentLine++;
        else if (ch === '\r') {
          currentLine++;
          if (next === '\n') {
            currentField += '\n';
            i++;
            continue;
          }
        }
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        currentFields.push(currentField);
        currentField = '';
      } else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && next === '\n') i++;
        currentFields.push(currentField);
        if (currentFields.some((f) => f.trim().length > 0)) {
          rows.push({ startLine: rowStartLine, fields: currentFields });
        }
        currentFields = [];
        currentField = '';
        currentLine++;
        rowStartLine = currentLine;
      } else {
        currentField += ch;
      }
    }
  }

  if (currentField.length > 0 || currentFields.length > 0) {
    currentFields.push(currentField);
    if (currentFields.some((f) => f.trim().length > 0)) {
      rows.push({ startLine: rowStartLine, fields: currentFields });
    }
  }

  return rows;
}

function normalizeHeaderName(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function findColumnIndex(headers: string[], exactAliases: string[], fallbackKeywords: string[] = []): number {
  for (const alias of exactAliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  for (const kw of fallbackKeywords) {
    const idx = headers.findIndex((h) => h.includes(kw));
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseCsvRecords(rawContent: string): {
  rawRecords: RawParsedMessageRecord[];
  warnings: string[];
} {
  const clean = rawContent.replace(/^\uFEFF/, '');
  if (!clean.trim()) {
    throw new Error('CSV file is empty. Please upload a CSV file containing message records.');
  }

  const delimiter = detectCsvDelimiter(clean);
  const matrix = parseCsvMatrix(clean, delimiter);

  if (matrix.length < 2) {
    throw new Error(
      'CSV file must include a header row and at least one message row (e.g., timestamp, sender, message).'
    );
  }

  const rawHeaders = matrix[0].fields;
  const headers = rawHeaders.map(normalizeHeaderName);

  const textCol = findColumnIndex(
    headers,
    ['message', 'text', 'body', 'content', 'msg', 'message_text', 'chat_text', 'transcript'],
    ['message', 'text', 'body', 'content']
  );

  if (textCol === -1) {
    throw new Error(
      `CSV header is missing a recognized message text column (found: ${rawHeaders
        .map((h) => `"${h.trim()}"`)
        .join(', ')}). Expected a column such as "message", "text", "body", or "content".`
    );
  }

  const senderCol = findColumnIndex(
    headers,
    ['sender', 'author', 'from', 'user', 'username', 'participant', 'name', 'sender_name', 'from_name'],
    ['sender', 'author', 'from', 'user']
  );

  const timestampCol = findColumnIndex(
    headers,
    ['timestamp', 'datetime', 'date_time', 'created_at', 'sent_at', 'timestamp_ms', 'ts', 'time_stamp'],
    ['timestamp', 'datetime']
  );

  const dateCol = findColumnIndex(headers, ['date', 'sent_date', 'day'], ['date']);
  const timeCol = findColumnIndex(headers, ['time', 'sent_time'], ['time']);
  const typeCol = findColumnIndex(
    headers,
    ['type', 'is_system', 'system', 'event_type', 'message_type'],
    ['system', 'type']
  );

  const warnings: string[] = [];
  if (senderCol === -1) {
    warnings.push('CSV Header: No sender/author column detected; defaulting sender to "Unknown Participant".');
  }
  if (timestampCol === -1 && dateCol === -1 && timeCol === -1) {
    warnings.push('CSV Header: No timestamp/date column detected; timeline ordering will rely on row order.');
  }

  const rawRecords: RawParsedMessageRecord[] = [];

  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r];
    if (row.fields.length !== rawHeaders.length) {
      warnings.push(
        `CSV Row ${r + 1} (Line ${row.startLine}): Column count (${row.fields.length}) differs from header (${rawHeaders.length}).`
      );
    }

    const msgText = (row.fields[textCol] ?? '').trim();
    if (!msgText) {
      warnings.push(`CSV Row ${r + 1} (Line ${row.startLine}): Empty message text skipped.`);
      continue;
    }

    let rawTs = '';
    if (timestampCol !== -1) {
      rawTs = (row.fields[timestampCol] ?? '').trim();
    } else if (dateCol !== -1 && timeCol !== -1 && dateCol !== timeCol) {
      const d = (row.fields[dateCol] ?? '').trim();
      const t = (row.fields[timeCol] ?? '').trim();
      rawTs = [d, t].filter(Boolean).join(' ');
    } else if (dateCol !== -1) {
      rawTs = (row.fields[dateCol] ?? '').trim();
    } else if (timeCol !== -1) {
      rawTs = (row.fields[timeCol] ?? '').trim();
    }

    const normTs = normalizeForensicTimestamp(rawTs);
    if (!normTs.parsedValid && rawTs) {
      warnings.push(
        `CSV Row ${r + 1} (Line ${row.startLine}): Unrecognized timestamp "${rawTs}", preserved verbatim.`
      );
    }

    const rawSender = senderCol !== -1 ? (row.fields[senderCol] ?? '').trim() : '';
    const typeVal = typeCol !== -1 ? (row.fields[typeCol] ?? '').trim().toLowerCase() : '';
    const isSystemMessage =
      typeVal === 'system' ||
      typeVal === 'service' ||
      typeVal === 'true' ||
      rawSender.toLowerCase() === 'system' ||
      rawSender.toLowerCase() === 'system event';

    rawRecords.push({
      id: rawRecords.length + 1,
      rawLineIndex: row.startLine,
      timestamp: normTs.formattedTimestamp,
      timestampRaw: normTs.timestampRaw || `Row ${r + 1}`,
      dateStr: normTs.dateStr,
      hour: normTs.hour,
      sender: isSystemMessage ? 'System Event' : rawSender || 'Unknown Participant',
      text: msgText,
      isSystemMessage,
    });
  }

  if (rawRecords.length === 0) {
    throw new Error(
      'No valid message rows with non-empty text could be parsed from the CSV file.'
    );
  }

  return { rawRecords, warnings };
}

// ============================================================================
// 2. JSON PARSER (Supports top-level arrays, wrapped exports, Telegram, Meta)
// ============================================================================

function flattenJsonTextValue(val: unknown): string {
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    return val
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) {
          return String((part as { text?: unknown }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return '';
}

function pickFirstValue(obj: Record<string, unknown>, keys: string[]): unknown {
  const lowerLookup = new Map<string, unknown>();
  for (const [k, v] of Object.entries(obj)) {
    lowerLookup.set(k.toLowerCase(), v);
  }
  for (const key of keys) {
    if (key in obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
    const lowered = lowerLookup.get(key.toLowerCase());
    if (lowered !== undefined && lowered !== null) return lowered;
  }
  return undefined;
}

function extractJsonMessageArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return null;

  const obj = parsed as Record<string, unknown>;
  const directKeys = [
    'messages',
    'chats',
    'records',
    'conversation',
    'conversations',
    'data',
    'items',
    'entries',
    'chat_history',
  ];

  for (const key of directKeys) {
    const candidate = obj[key];
    if (Array.isArray(candidate)) {
      // Handle nested chat thread objects like { chats: [{ messages: [...] }] }
      if (
        candidate.length > 0 &&
        candidate[0] &&
        typeof candidate[0] === 'object' &&
        Array.isArray((candidate[0] as Record<string, unknown>).messages)
      ) {
        return candidate.flatMap((c) => {
          const msgs = (c as Record<string, unknown>).messages;
          return Array.isArray(msgs) ? msgs : [];
        });
      }
      return candidate;
    }
    // Telegram backup format: { chats: { list: [ { messages: [...] } ] } }
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const nestedList = (candidate as Record<string, unknown>).list;
      if (Array.isArray(nestedList)) {
        return nestedList.flatMap((c) => {
          if (c && typeof c === 'object' && Array.isArray((c as Record<string, unknown>).messages)) {
            return (c as Record<string, unknown>).messages as unknown[];
          }
          return [];
        });
      }
    }
  }

  return null;
}

export function parseJsonRecords(rawContent: string): {
  rawRecords: RawParsedMessageRecord[];
  warnings: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent.replace(/^\uFEFF/, ''));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Syntax error';
    throw new Error(`Invalid JSON file: ${msg}`);
  }

  const rawItems = extractJsonMessageArray(parsed);
  if (!rawItems) {
    throw new Error(
      'Unrecognized JSON structure. Expected an array of message objects or an object containing a "messages", "chats", "records", "conversation", or "data" array.'
    );
  }

  if (rawItems.length === 0) {
    throw new Error('The uploaded JSON file contains an empty message array.');
  }

  const warnings: string[] = [];
  const rawRecords: RawParsedMessageRecord[] = [];
  const rawLines = rawContent.split(/\r?\n/);

  const findApproximateLine = (snippet: string, fallbackIndex: number): number => {
    const probe = snippet.slice(0, 32).trim();
    if (!probe) return fallbackIndex;
    const idx = rawLines.findIndex((l) => l.includes(probe));
    return idx !== -1 ? idx + 1 : fallbackIndex;
  };

  for (let i = 0; i < rawItems.length; i++) {
    const entry = rawItems[i];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      warnings.push(`JSON Entry #${i + 1}: Skipped non-object item.`);
      continue;
    }

    const obj = entry as Record<string, unknown>;
    const rawTextVal = pickFirstValue(obj, [
      'text',
      'message',
      'body',
      'content',
      'msg',
      'message_text',
      'caption',
    ]);
    let text = flattenJsonTextValue(rawTextVal).trim();

    // Handle attachment-only Messenger/Telegram entries gracefully
    if (!text) {
      if (Array.isArray(obj.photos) && obj.photos.length > 0) text = '<image omitted>';
      else if (Array.isArray(obj.videos) && obj.videos.length > 0) text = '<video omitted>';
      else if (Array.isArray(obj.audio_files) && obj.audio_files.length > 0) text = '<audio omitted>';
      else if (typeof obj.media_type === 'string') text = `<${obj.media_type} omitted>`;
    }

    if (!text) {
      warnings.push(`JSON Entry #${i + 1}: Missing message text/content; entry skipped.`);
      continue;
    }

    const rawSenderVal = pickFirstValue(obj, [
      'sender',
      'sender_name',
      'from',
      'author',
      'user',
      'username',
      'participant',
      'name',
      'actor',
    ]);
    const senderStr =
      typeof rawSenderVal === 'string'
        ? rawSenderVal.trim()
        : rawSenderVal && typeof rawSenderVal === 'object' && 'name' in rawSenderVal
        ? String((rawSenderVal as { name?: unknown }).name ?? '').trim()
        : '';

    const rawTsVal = pickFirstValue(obj, [
      'timestamp',
      'timestamp_ms',
      'date',
      'datetime',
      'created_at',
      'sent_at',
      'time',
      'date_unixtime',
    ]);

    const tsInput =
      typeof rawTsVal === 'number' || typeof rawTsVal === 'string' ? rawTsVal : '';
    const normTs = normalizeForensicTimestamp(tsInput);
    if (!normTs.parsedValid) {
      warnings.push(
        `JSON Entry #${i + 1}: ${
          tsInput ? `Unrecognized timestamp "${tsInput}" preserved verbatim.` : 'Missing timestamp field.'
        }`
      );
    }

    const rawLineNum = pickFirstValue(obj, ['rawLineIndex', 'line', 'line_number']);
    const lineNum =
      typeof rawLineNum === 'number' && rawLineNum > 0
        ? rawLineNum
        : findApproximateLine(text, i + 1);

    const typeVal = String(pickFirstValue(obj, ['type', 'message_type']) ?? '').toLowerCase();
    const isSystemFlag =
      obj.isSystem === true ||
      obj.is_system === true ||
      obj.system === true ||
      typeVal === 'service' ||
      typeVal === 'system' ||
      senderStr.toLowerCase() === 'system' ||
      senderStr.toLowerCase() === 'system event';

    rawRecords.push({
      id: rawRecords.length + 1,
      rawLineIndex: lineNum,
      timestamp: normTs.formattedTimestamp,
      timestampRaw: normTs.timestampRaw || `JSON Entry #${i + 1}`,
      dateStr: normTs.dateStr,
      hour: normTs.hour,
      sender: isSystemFlag ? 'System Event' : senderStr || 'Unknown Participant',
      text,
      isSystemMessage: isSystemFlag,
    });
  }

  if (rawRecords.length === 0) {
    throw new Error(
      'No valid message entries with text content could be extracted from the JSON file.'
    );
  }

  return { rawRecords, warnings };
}

// ============================================================================
// 3. HTML PARSER (Supports structured chat HTML, tables, and HTML text exports)
// ============================================================================

function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
  };

  return input
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/gi, (m) => named[m.toLowerCase()] || m)
    .replace(/&#(\d+);/g, (_, num) => {
      const code = parseInt(num, 10);
      return Number.isNaN(code) ? _ : String.fromCodePoint(code);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isNaN(code) ? _ : String.fromCodePoint(code);
    });
}

function htmlFragmentToText(fragment: string): string {
  const withBreaks = fragment
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<\/\s*(td|th)\s*>/gi, '\t');
  const stripped = withBreaks.replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(stripped)
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripNonContentHtmlSections(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|noscript|nav|header|footer|svg)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '');
}

function getDomElementTextWithBreaks(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  clone.querySelectorAll('p, div, li').forEach((blk) => {
    blk.append('\n');
  });
  return (clone.textContent || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseHtmlWithBrowserDom(rawHtml: string): {
  rawRecords: RawParsedMessageRecord[];
  warnings: string[];
} | null {
  if (typeof DOMParser === 'undefined') return null;

  const parser = new DOMParser();
  const doc = parser.parseFromString(rawHtml, 'text/html');
  doc.querySelectorAll('script, style, noscript, nav, header, footer, svg').forEach((el) => {
    el.remove();
  });

  const warnings: string[] = [];
  const rawRecords: RawParsedMessageRecord[] = [];

  // Strategy A: Structured message cards/elements
  const candidateSelector =
    '.message, .msg, .chat-message, .bubble, [data-message], [data-message-id], article';
  const candidates = Array.from(doc.querySelectorAll(candidateSelector)).filter(
    (el) => !el.querySelector(candidateSelector)
  );

  if (candidates.length > 0) {
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      const senderEl = el.querySelector(
        '.sender, .from_name, .from, .author, .user, .username, .name, [data-sender]'
      );
      const timeEl = el.querySelector(
        '.date, .time, .timestamp, time, [data-time], [data-timestamp]'
      );
      const bodyEl = el.querySelector('.text, .body, .content, .msg-text, .message-text');

      const senderText =
        (senderEl?.textContent || el.getAttribute('data-sender') || '').trim();
      const tsAttr =
        timeEl?.getAttribute('datetime') ||
        timeEl?.getAttribute('title') ||
        timeEl?.getAttribute('data-time') ||
        timeEl?.textContent ||
        el.getAttribute('data-timestamp') ||
        '';
      const normTs = normalizeForensicTimestamp(tsAttr);

      let msgText = '';
      if (bodyEl) {
        msgText = getDomElementTextWithBreaks(bodyEl);
      } else {
        const clone = el.cloneNode(true) as Element;
        clone
          .querySelectorAll(
            '.sender, .from_name, .from, .author, .user, .username, .name, .date, .time, .timestamp, time'
          )
          .forEach((n) => n.remove());
        msgText = getDomElementTextWithBreaks(clone);
      }

      if (!msgText) {
        warnings.push(`HTML Message Block #${i + 1}: Empty message text skipped.`);
        continue;
      }

      const isSystem =
        el.classList.contains('service') ||
        el.classList.contains('system') ||
        senderText.toLowerCase() === 'system';

      rawRecords.push({
        id: rawRecords.length + 1,
        rawLineIndex: i + 1,
        timestamp: normTs.formattedTimestamp,
        timestampRaw: normTs.timestampRaw || `HTML Block #${i + 1}`,
        dateStr: normTs.dateStr,
        hour: normTs.hour,
        sender: isSystem ? 'System Event' : senderText || 'Unknown Participant',
        text: msgText,
        isSystemMessage: isSystem,
      });
    }

    if (rawRecords.length > 0) return { rawRecords, warnings };
  }

  // Strategy B: HTML <table> chat logs
  const tables = Array.from(doc.querySelectorAll('table'));
  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length < 2) continue;

    const headerCells = Array.from(rows[0].querySelectorAll('th, td')).map((c) =>
      normalizeHeaderName(c.textContent || '')
    );

    let tsIdx = findColumnIndex(
      headerCells,
      ['timestamp', 'date', 'time', 'datetime', 'sent_at'],
      ['time', 'date']
    );
    let senderIdx = findColumnIndex(
      headerCells,
      ['sender', 'author', 'from', 'user', 'participant', 'name'],
      ['sender', 'from', 'author']
    );
    let msgIdx = findColumnIndex(
      headerCells,
      ['message', 'text', 'body', 'content', 'msg'],
      ['message', 'text', 'body', 'content']
    );

    let startRow = 1;
    // Fallback if table has no <th> headers but has 3 columns [timestamp, sender, message]
    if (msgIdx === -1 && rows[0].querySelectorAll('th').length === 0 && headerCells.length >= 3) {
      tsIdx = 0;
      senderIdx = 1;
      msgIdx = 2;
      startRow = 0;
    }

    if (msgIdx !== -1) {
      for (let r = startRow; r < rows.length; r++) {
        const cells = Array.from(rows[r].querySelectorAll('td, th'));
        const text = cells[msgIdx] ? getDomElementTextWithBreaks(cells[msgIdx]) : '';
        if (!text) {
          warnings.push(`HTML Table Row ${r + 1}: Empty message cell skipped.`);
          continue;
        }
        const senderText = senderIdx !== -1 && cells[senderIdx] ? (cells[senderIdx].textContent || '').trim() : '';
        const tsText = tsIdx !== -1 && cells[tsIdx] ? (cells[tsIdx].textContent || '').trim() : '';
        const normTs = normalizeForensicTimestamp(tsText);

        rawRecords.push({
          id: rawRecords.length + 1,
          rawLineIndex: r + 1,
          timestamp: normTs.formattedTimestamp,
          timestampRaw: normTs.timestampRaw || `HTML Row ${r + 1}`,
          dateStr: normTs.dateStr,
          hour: normTs.hour,
          sender: senderText || 'Unknown Participant',
          text,
          isSystemMessage: senderText.toLowerCase() === 'system',
        });
      }

      if (rawRecords.length > 0) return { rawRecords, warnings };
    }
  }

  // Strategy C: Plain WhatsApp/timestamped chat lines inside HTML body
  const bodyText = getDomElementTextWithBreaks(doc.body || doc.documentElement);
  const lineParsed = parseWhatsAppLines(bodyText, warnings);
  if (lineParsed.rawRecords.length > 0) {
    return lineParsed;
  }

  return null;
}

function parseHtmlWithPureTsFallback(rawHtml: string): {
  rawRecords: RawParsedMessageRecord[];
  warnings: string[];
} {
  const cleanedHtml = stripNonContentHtmlSections(rawHtml);
  const warnings: string[] = [];
  const rawRecords: RawParsedMessageRecord[] = [];

  // Strategy A: HTML <table> rows
  const tableMatches = Array.from(cleanedHtml.matchAll(/<table[\s\S]*?>([\s\S]*?)<\/table>/gi));
  for (const tableMatch of tableMatches) {
    const trMatches = Array.from(tableMatch[1].matchAll(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi));
    if (trMatches.length < 2) continue;

    const matrix = trMatches.map((tr) =>
      Array.from(tr[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)).map((cell) =>
        htmlFragmentToText(cell[2])
      )
    );
    if (matrix.length < 2) continue;

    const headerNorms = matrix[0].map(normalizeHeaderName);
    let tsIdx = findColumnIndex(headerNorms, ['timestamp', 'date', 'time', 'datetime'], ['time', 'date']);
    let senderIdx = findColumnIndex(
      headerNorms,
      ['sender', 'author', 'from', 'user', 'participant', 'name'],
      ['sender', 'from', 'author']
    );
    let msgIdx = findColumnIndex(
      headerNorms,
      ['message', 'text', 'body', 'content', 'msg'],
      ['message', 'text', 'body', 'content']
    );
    let startRow = 1;

    if (msgIdx === -1 && !/<th/i.test(trMatches[0][1]) && matrix[0].length >= 3) {
      tsIdx = 0;
      senderIdx = 1;
      msgIdx = 2;
      startRow = 0;
    }

    if (msgIdx !== -1) {
      for (let r = startRow; r < matrix.length; r++) {
        const row = matrix[r];
        const text = (row[msgIdx] ?? '').trim();
        if (!text) {
          warnings.push(`HTML Table Row ${r + 1}: Empty message cell skipped.`);
          continue;
        }
        const sender = (senderIdx !== -1 ? row[senderIdx] : '')?.trim() || 'Unknown Participant';
        const tsRaw = (tsIdx !== -1 ? row[tsIdx] : '')?.trim() || '';
        const normTs = normalizeForensicTimestamp(tsRaw);
        rawRecords.push({
          id: rawRecords.length + 1,
          rawLineIndex: r + 1,
          timestamp: normTs.formattedTimestamp,
          timestampRaw: normTs.timestampRaw || `HTML Row ${r + 1}`,
          dateStr: normTs.dateStr,
          hour: normTs.hour,
          sender,
          text,
          isSystemMessage: sender.toLowerCase() === 'system',
        });
      }
      if (rawRecords.length > 0) return { rawRecords, warnings };
    }
  }

  // Strategy B: Structured <div class="message"> / <article> blocks via balanced class matching
  const blockRegex =
    /<(div|article|li)\b[^>]*class=["'][^"']*\b(?:message|msg|chat-message|bubble)\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi;
  const blocks = Array.from(cleanedHtml.matchAll(blockRegex));
  if (blocks.length > 0) {
    for (let i = 0; i < blocks.length; i++) {
      const inner = blocks[i][2];
      const senderMatch = inner.match(
        /<[^>]*class=["'][^"']*\b(?:sender|from_name|from|author|user|name)\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i
      );
      const timeMatch = inner.match(
        /<(?:time|span|div)[^>]*(?:datetime=["']([^"']+)["']|class=["'][^"']*\b(?:date|time|timestamp)\b[^"']*["'])[^>]*>([\s\S]*?)<\/(?:time|span|div)>/i
      );
      const textMatch = inner.match(
        /<[^>]*class=["'][^"']*\b(?:text|body|content|msg-text|message-text)\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i
      );

      const sender = senderMatch ? htmlFragmentToText(senderMatch[1]) : '';
      const tsCandidate = timeMatch ? (timeMatch[1] || htmlFragmentToText(timeMatch[2])) : '';
      const normTs = normalizeForensicTimestamp(tsCandidate);

      let msgText = textMatch ? htmlFragmentToText(textMatch[1]) : '';
      if (!msgText) {
        const cleanedInner = inner
          .replace(senderMatch?.[0] || '', '')
          .replace(timeMatch?.[0] || '', '');
        msgText = htmlFragmentToText(cleanedInner);
      }

      if (!msgText) {
        warnings.push(`HTML Message Block #${i + 1}: Empty message text skipped.`);
        continue;
      }

      rawRecords.push({
        id: rawRecords.length + 1,
        rawLineIndex: i + 1,
        timestamp: normTs.formattedTimestamp,
        timestampRaw: normTs.timestampRaw || `HTML Block #${i + 1}`,
        dateStr: normTs.dateStr,
        hour: normTs.hour,
        sender: sender || 'Unknown Participant',
        text: msgText,
        isSystemMessage: sender.toLowerCase() === 'system',
      });
    }
    if (rawRecords.length > 0) return { rawRecords, warnings };
  }

  // Strategy C: Plain text lines extracted from HTML markup
  const plainText = htmlFragmentToText(cleanedHtml);
  const lineParsed = parseWhatsAppLines(plainText, warnings);
  if (lineParsed.rawRecords.length > 0) {
    return lineParsed;
  }

  throw new Error(
    'No valid messaging records could be extracted from the HTML file. Ensure the HTML contains structured chat blocks (.message/.sender/.text), a chat log <table>, or timestamped message lines.'
  );
}

export function parseHtmlRecords(rawContent: string): {
  rawRecords: RawParsedMessageRecord[];
  warnings: string[];
} {
  if (!rawContent.trim()) {
    throw new Error('HTML file is empty.');
  }

  const domResult = parseHtmlWithBrowserDom(rawContent);
  if (domResult && domResult.rawRecords.length > 0) {
    return domResult;
  }

  return parseHtmlWithPureTsFallback(rawContent);
}

// ============================================================================
// 4. UNIFIED EVIDENCE INGESTION ENTRY POINT
// ============================================================================

export async function parseEvidenceFile(
  rawContent: string,
  filename: string,
  fileSizeBytes: number,
  isDemo = false,
  mimeType = ''
): Promise<ForensicCase> {
  const format = detectEvidenceFormat(filename, mimeType);

  if (format === 'txt') {
    return parseWhatsAppExport(rawContent, filename, fileSizeBytes, isDemo);
  }

  const parsed =
    format === 'csv'
      ? parseCsvRecords(rawContent)
      : format === 'json'
      ? parseJsonRecords(rawContent)
      : parseHtmlRecords(rawContent);

  return buildForensicCaseFromParsedRecords({
    rawContent,
    filename,
    fileSizeBytes,
    isDemo,
    sourceFormat: format,
    rawRecords: parsed.rawRecords,
    warnings: parsed.warnings,
  });
}
