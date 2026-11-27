/**
 * ForenText Forensic PDF Report Generator
 * Generates an official, publication-quality multi-page PDF report
 * with embedded Unicode fonts (NotoSans + NotoSansDevanagari) for crisp
 * English, Devanagari Hindi, Roman Hindi, and Hinglish rendering,
 * dynamic box/card sizing, full multiline wrapping, and multi-page continuation.
 */

import { jsPDF } from 'jspdf';
import { ForensicCase } from '../types/forensics';

export interface ReportSectionConfig {
  includeCaseOverview?: boolean;
  includeEntities?: boolean;
  includeFindings?: boolean;
  includeCorrelations?: boolean;
  includeEvents?: boolean;
  includeDisclaimer?: boolean;
}

export interface PdfFontBundle {
  notoSansRegular: string;
  notoSansBold: string;
  notoDevaRegular: string;
}

let cachedFontBundle: PdfFontBundle | null = null;
let fontLoadPromise: Promise<PdfFontBundle | null> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

/**
 * Fetch and cache Unicode TTF fonts in the browser for jsPDF embedding.
 */
export async function loadPdfFonts(): Promise<PdfFontBundle | null> {
  if (cachedFontBundle) return cachedFontBundle;
  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    if (typeof fetch === 'undefined') return null;
    try {
      const [regRes, boldRes, devaRes] = await Promise.all([
        fetch('/fonts/NotoSans-Regular.ttf'),
        fetch('/fonts/NotoSans-Bold.ttf'),
        fetch('/fonts/NotoSansDevanagari-Regular.ttf'),
      ]);

      if (!regRes.ok || !boldRes.ok || !devaRes.ok) {
        return null;
      }

      const [regBuf, boldBuf, devaBuf] = await Promise.all([
        regRes.arrayBuffer(),
        boldRes.arrayBuffer(),
        devaRes.arrayBuffer(),
      ]);

      cachedFontBundle = {
        notoSansRegular: arrayBufferToBase64(regBuf),
        notoSansBold: arrayBufferToBase64(boldBuf),
        notoDevaRegular: arrayBufferToBase64(devaBuf),
      };
      return cachedFontBundle;
    } catch {
      return null;
    } finally {
      fontLoadPromise = null;
    }
  })();

  return fontLoadPromise;
}

export function registerPdfFonts(
  doc: jsPDF,
  bundle?: PdfFontBundle | null
): boolean {
  const activeBundle = bundle ?? cachedFontBundle;
  if (!activeBundle) return false;

  try {
    doc.addFileToVFS('NotoSans-Regular.ttf', activeBundle.notoSansRegular);
    doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');

    doc.addFileToVFS('NotoSans-Bold.ttf', activeBundle.notoSansBold);
    doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');

    doc.addFileToVFS('NotoSansDevanagari-Regular.ttf', activeBundle.notoDevaRegular);
    doc.addFont('NotoSansDevanagari-Regular.ttf', 'NotoDeva', 'normal');
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// MULTILINGUAL SCRIPT-RUN MEASUREMENT, WRAPPING & RENDERING HELPERS
// ============================================================================

interface TextRun {
  text: string;
  isDeva: boolean;
}

const DEVA_CHAR_REGEX = /[\u0900-\u097F\u1CD0-\u1CFF\uA8E0-\uA8FF\u200C\u200D]/;
const DEVA_COMBINING_REGEX = /[\u0900-\u0903\u093A-\u094F\u0951-\u0957\u0962-\u0963\u200C\u200D]/;

function splitScriptRuns(text: string): TextRun[] {
  if (!text) return [];
  const runs: TextRun[] = [];
  let current = '';
  let currentIsDeva = DEVA_CHAR_REGEX.test(text[0]);

  for (const ch of text) {
    const isDeva = DEVA_CHAR_REGEX.test(ch);
    if (isDeva === currentIsDeva) {
      current += ch;
    } else {
      if (current) runs.push({ text: current, isDeva: currentIsDeva });
      current = ch;
      currentIsDeva = isDeva;
    }
  }
  if (current) runs.push({ text: current, isDeva: currentIsDeva });
  return runs;
}

function selectRunFont(
  doc: jsPDF,
  isDeva: boolean,
  fontSize: number,
  bold: boolean,
  hasUnicodeFonts: boolean
) {
  doc.setCharSpace(0);
  if (hasUnicodeFonts) {
    if (isDeva) {
      doc.setFont('NotoDeva', 'normal');
    } else {
      doc.setFont('NotoSans', bold ? 'bold' : 'normal');
    }
  } else {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
  }
  doc.setFontSize(fontSize);
}

function measureMultilingualWidth(
  doc: jsPDF,
  text: string,
  fontSize: number,
  bold: boolean,
  hasUnicodeFonts: boolean
): number {
  if (!text) return 0;
  const runs = splitScriptRuns(text);
  let total = 0;
  for (const run of runs) {
    selectRunFont(doc, run.isDeva, fontSize, bold, hasUnicodeFonts);
    total += doc.getTextWidth(run.text);
  }
  return total;
}

function splitGraphemeClusters(word: string): string[] {
  const clusters: string[] = [];
  for (const ch of word) {
    if (clusters.length > 0 && DEVA_COMBINING_REGEX.test(ch)) {
      clusters[clusters.length - 1] += ch;
    } else {
      clusters.push(ch);
    }
  }
  return clusters;
}

function breakLongToken(
  doc: jsPDF,
  token: string,
  maxWidth: number,
  fontSize: number,
  bold: boolean,
  hasUnicodeFonts: boolean
): string[] {
  const clusters = splitGraphemeClusters(token);
  const parts: string[] = [];
  let current = '';

  for (const cluster of clusters) {
    const candidate = current + cluster;
    if (
      current.length > 0 &&
      measureMultilingualWidth(doc, candidate, fontSize, bold, hasUnicodeFonts) > maxWidth
    ) {
      parts.push(current);
      current = cluster;
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  return parts;
}

export function wrapMultilingualText(
  doc: jsPDF,
  rawText: string,
  maxWidth: number,
  fontSize: number,
  bold: boolean,
  hasUnicodeFonts: boolean
): string[] {
  const normalized = (rawText ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (!normalized) return [];

  const paragraphs = normalized.split('\n');
  const wrappedLines: string[] = [];

  for (const para of paragraphs) {
    if (para.trim().length === 0) {
      wrappedLines.push('');
      continue;
    }

    const tokens = para.split(/(\s+)/).filter((t) => t.length > 0);
    let currentLine = '';

    for (const token of tokens) {
      // Collapse tabs cleanly to spaces so pdf metrics remain accurate
      const cleanToken = token.replace(/\t/g, '  ');
      const isWhitespace = /^\s+$/.test(cleanToken);

      if (currentLine.length === 0 && isWhitespace) {
        continue;
      }

      const candidate = currentLine + cleanToken;
      const candidateWidth = measureMultilingualWidth(
        doc,
        candidate.trimEnd(),
        fontSize,
        bold,
        hasUnicodeFonts
      );

      if (candidateWidth <= maxWidth) {
        currentLine = candidate;
      } else if (isWhitespace) {
        if (currentLine.trimEnd().length > 0) {
          wrappedLines.push(currentLine.trimEnd());
        }
        currentLine = '';
      } else if (
        measureMultilingualWidth(doc, cleanToken, fontSize, bold, hasUnicodeFonts) > maxWidth
      ) {
        if (currentLine.trimEnd().length > 0) {
          wrappedLines.push(currentLine.trimEnd());
          currentLine = '';
        }
        const broken = breakLongToken(
          doc,
          cleanToken,
          maxWidth,
          fontSize,
          bold,
          hasUnicodeFonts
        );
        for (let b = 0; b < broken.length - 1; b++) {
          wrappedLines.push(broken[b]);
        }
        currentLine = broken[broken.length - 1] || '';
      } else {
        if (currentLine.trimEnd().length > 0) {
          wrappedLines.push(currentLine.trimEnd());
        }
        currentLine = cleanToken;
      }
    }

    if (currentLine.trimEnd().length > 0) {
      wrappedLines.push(currentLine.trimEnd());
    }
  }

  return wrappedLines;
}

function drawMultilingualLine(
  doc: jsPDF,
  line: string,
  x: number,
  y: number,
  fontSize: number,
  bold: boolean,
  color: readonly [number, number, number],
  hasUnicodeFonts: boolean
) {
  if (!line) return;
  const runs = splitScriptRuns(line);
  let cursorX = x;
  doc.setTextColor(color[0], color[1], color[2]);

  for (const run of runs) {
    selectRunFont(doc, run.isDeva, fontSize, bold, hasUnicodeFonts);
    doc.text(run.text, cursorX, y);
    cursorX += doc.getTextWidth(run.text);
  }
}

// ============================================================================
// MAIN FORENSIC PDF GENERATOR
// ============================================================================

export function generateForensicPDF(
  forensicCase: ForensicCase,
  config: ReportSectionConfig = {},
  fontBundle?: PdfFontBundle | null
): jsPDF {
  const {
    includeCaseOverview = true,
    includeEntities = true,
    includeFindings = true,
    includeCorrelations = true,
    includeEvents = true,
    includeDisclaimer = true,
  } = config;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const hasUnicodeFonts = registerPdfFonts(doc, fontBundle);
  const baseFont = hasUnicodeFonts ? 'NotoSans' : 'helvetica';
  doc.setCharSpace(0);

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const maxContentBottomY = pageHeight - margin - 15;
  let y = margin;

  // Colors
  const purpleDark = [26, 16, 48] as const; // #1a1030
  const gold = [212, 175, 55] as const; // #d4af37
  const goldDeep = [155, 118, 18] as const;
  const textDark = [33, 27, 46] as const;
  const textMuted = [100, 95, 115] as const;
  const borderLight = [225, 220, 235] as const;
  const bgLight = [248, 246, 252] as const;
  const translationAccent = [76, 29, 149] as const;
  const warnColor = [154, 52, 18] as const;

  const renderPageHeader = () => {
    doc.setCharSpace(0);
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text('FORENTEXT DIGITAL FORENSICS PLATFORM | INVESTIGATION REPORT', margin, 10);
    doc.text(
      `CASE REF: FT-${forensicCase.metadata.sha256.substring(0, 8).toUpperCase()}`,
      pageWidth - margin,
      10,
      { align: 'right' }
    );
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, 12, pageWidth - margin, 12);
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > maxContentBottomY) {
      doc.addPage();
      y = margin;
      renderPageHeader();
    }
  };

  const renderPageFooter = (pageNum: number, totalPages: number) => {
    doc.setCharSpace(0);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.setFont(baseFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(
      'CONFIDENTIAL // PREPARED FOR INVESTIGATIVE TRIAGE // NOT FINAL LEGAL VERDICT',
      margin,
      pageHeight - 8
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 8, {
      align: 'right',
    });
  };

  // --- Page 1: Header and Title ---
  renderPageHeader();
  y = 20;

  // Title Block
  doc.setFillColor(purpleDark[0], purpleDark[1], purpleDark[2]);
  doc.rect(margin, y, contentWidth, 24, 'F');

  doc.setFont(baseFont, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('FORENTEXT FORENSIC ANALYSIS REPORT', margin + 6, y + 10);

  doc.setFont(baseFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(gold[0], gold[1], gold[2]);
  doc.text(
    'Integrated Messaging Forensics, Multilingual Translation, Entity Extraction & Correlation',
    margin + 6,
    y + 17
  );

  y += 30;

  // 1. Digital Evidence Integrity & Custody Record
  if (includeCaseOverview) {
    doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.roundedRect(margin, y, contentWidth, 43, 2, 2, 'FD');

    doc.setFont(baseFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(purpleDark[0], purpleDark[1], purpleDark[2]);
    doc.text('1. DIGITAL EVIDENCE INTEGRITY & CUSTODY RECORD', margin + 5, y + 7);

    const leftColX = margin + 5;
    const rightColX = margin + contentWidth / 2;
    const colWidth = contentWidth / 2 - 8;

    const sourceFilenameText =
      wrapMultilingualText(
        doc,
        `Source Filename: ${forensicCase.metadata.filename}`,
        colWidth,
        8.2,
        false,
        hasUnicodeFonts
      )[0] || `Source Filename: ${forensicCase.metadata.filename}`;
    drawMultilingualLine(doc, sourceFilenameText, leftColX, y + 14, 8.2, false, textDark, hasUnicodeFonts);

    doc.setFont(baseFont, 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(
      `File Size: ${(forensicCase.metadata.fileSizeBytes / 1024).toFixed(2)} KB (${forensicCase.metadata.fileSizeBytes} bytes)`,
      leftColX,
      y + 20
    );
    doc.text(
      `Examined At: ${new Date(forensicCase.metadata.parsedAt).toLocaleString()}`,
      leftColX,
      y + 26
    );
    doc.text(
      `Analysis Mode: ${forensicCase.metadata.isDemo ? 'Demonstration Dataset (Fictional)' : `Live Evidence (${(forensicCase.metadata.sourceFormat || 'txt').toUpperCase()})`}`,
      leftColX,
      y + 32
    );

    doc.text(
      `Total Records: ${forensicCase.metadata.totalMessages} messages (${forensicCase.metadata.totalLines} lines)`,
      rightColX,
      y + 14
    );
    doc.text(
      `Identified Senders: ${forensicCase.metadata.senders.length} participant(s)`,
      rightColX,
      y + 20
    );
    doc.text(
      `Date Horizon: ${forensicCase.metadata.dateRange.start} to ${forensicCase.metadata.dateRange.end}`,
      rightColX,
      y + 26
    );
    doc.text(`Hash Algorithm: SHA-256 (W3C Web Cryptography Standard)`, rightColX, y + 32);

    doc.setFont(baseFont, 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 30, 160);
    doc.text(`SHA-256 HASH: ${forensicCase.metadata.sha256}`, leftColX, y + 38.5);

    y += 49;

    // Processing Summary Metric Cards
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(purpleDark[0], purpleDark[1], purpleDark[2]);
    doc.text('2. INVESTIGATION METRICS OVERVIEW', margin, y);
    y += 4;

    const cardWidth = (contentWidth - 12) / 5;
    const metrics = [
      { label: 'Messages', value: forensicCase.metadata.totalMessages.toString() },
      { label: 'Findings', value: forensicCase.findings.length.toString() },
      { label: 'Entities', value: forensicCase.entities.length.toString() },
      { label: 'Correlations', value: (forensicCase.correlations?.length || 0).toString() },
      { label: 'Events', value: (forensicCase.events?.length || 0).toString() },
    ];

    metrics.forEach((m, idx) => {
      const cx = margin + idx * (cardWidth + 3);
      doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
      doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
      doc.roundedRect(cx, y, cardWidth, 16, 1.5, 1.5, 'FD');

      doc.setFont(baseFont, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
      doc.text(m.label, cx + 3, y + 5);

      doc.setFont(baseFont, 'bold');
      doc.setFontSize(11);
      doc.setTextColor(purpleDark[0], purpleDark[1], purpleDark[2]);
      doc.text(m.value, cx + 3, y + 12);
    });

    y += 19;

    // Priority Tier Breakdown + Hybrid Tri-Method Architecture Summary
    const highCount = forensicCase.findings.filter((f) => f.severity === 'critical').length;
    const medCount = forensicCase.findings.filter((f) => f.severity === 'elevated').length;
    const orangeReviewCount = forensicCase.findings.filter((f) => f.severity === 'needs_review').length;
    const normalInfoCount = forensicCase.findings.filter(
      (f) => f.severity === 'contextual' || f.severity === 'informational'
    ).length;

    const ruleCount = forensicCase.findings.filter((f) => f.sources?.includes('rule')).length;
    const nlpCount = forensicCase.findings.filter((f) => f.sources?.includes('nlp')).length;
    const aiCount = forensicCase.findings.filter((f) => f.sources?.includes('ai')).length;
    const consensusCount = forensicCase.findings.filter(
      (f) => f.consensus === 'hybrid_consensus' || (f.sources && f.sources.length > 1)
    ).length;
    const disagreementCount = forensicCase.findings.filter(
      (f) => f.consensus === 'method_disagreement'
    ).length;

    doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
    doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
    doc.roundedRect(margin, y, contentWidth, 16, 1, 1, 'FD');

    doc.setFont(baseFont, 'bold');
    doc.setFontSize(7);
    doc.setTextColor(purpleDark[0], purpleDark[1], purpleDark[2]);
    doc.text('PRIORITY TIERS & TRI-METHOD HYBRID ANALYSIS (RULE + NLP + AI):', margin + 3, y + 4.5);

    doc.setFont(baseFont, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text(
      `High (Critical): ${highCount}  |  Medium (Elevated): ${medCount}  |  Orange - Needs Review: ${orangeReviewCount}  |  Contextual/Info: ${normalInfoCount}`,
      margin + 3,
      y + 9.0
    );
    doc.text(
      `Rule Matches: ${ruleCount}  |  NLP Matches: ${nlpCount}  |  AI Contextual: ${aiCount}  |  Corroboration: ${consensusCount}  |  Discrepancy Reviews: ${disagreementCount}`,
      margin + 3,
      y + 13.5
    );

    y += 20;
  }

  // 3. Identified Entities by Category
  if (includeEntities) {
    checkPageBreak(50);
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(purpleDark[0], purpleDark[1], purpleDark[2]);
    doc.text('3. IDENTIFIED ENTITIES BY CATEGORY', margin, y);
    y += 5;

    const categories = [
      'Person',
      'Location',
      'Vehicle',
      'VehiclePlate',
      'Object',
      'Weapon',
      'Violence',
      'Document',
      'ContactIdentifier',
      'DateTime',
    ] as const;

    categories.forEach((cat) => {
      const items = forensicCase.entities.filter((e) => e.category === cat);
      if (items.length === 0) return;

      checkPageBreak(16);
      doc.setFont(baseFont, 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(70, 30, 120);
      doc.text(`• ${cat.toUpperCase()} (${items.length} detected)`, margin + 2, y);
      y += 4.2;

      const uniqueValues = Array.from(new Set(items.map((i) => i.text)));
      const textChunk = uniqueValues.join(', ');
      const splitLines = wrapMultilingualText(
        doc,
        textChunk,
        contentWidth - 6,
        8,
        false,
        hasUnicodeFonts
      );

      splitLines.forEach((line) => {
        checkPageBreak(5);
        drawMultilingualLine(doc, line, margin + 4, y, 8, false, textDark, hasUnicodeFonts);
        y += 4;
      });
      y += 2.5;
    });

    y += 4;
  }

  // 4. Potentially Relevant Messages & Contextual Findings (Dynamic Wrapped + Paginated Cards)
  if (includeFindings && forensicCase.findings.length > 0) {
    checkPageBreak(30);
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(purpleDark[0], purpleDark[1], purpleDark[2]);
    doc.text('4. POTENTIALLY RELEVANT MESSAGES & INVESTIGATIVE FINDINGS', margin, y);
    y += 4;

    doc.setFont(baseFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(
      'Every flagged entry preserves the original message verbatim alongside timestamp, sender, line index, and AI-assisted translation when applicable.',
      margin,
      y + 1.5
    );
    y += 7;

    interface StyledRenderLine {
      text: string;
      fontSize: number;
      bold: boolean;
      color: readonly [number, number, number];
      lineStep: number;
      gapBefore?: number;
      isMessageBody?: boolean;
    }

    forensicCase.findings.forEach((finding, idx) => {
      const msg = forensicCase.messages.find((m) => m.id === finding.messageId);
      if (!msg) return;

      const textLeftX = margin + 6.5;
      const textMaxWidth = contentWidth - 11.5;

      const headerStr = `#${idx + 1} | Line ${msg.rawLineIndex} | ${msg.timestamp} | Sender: ${msg.sender}`;
      const sourcesText = (finding.sources || ['nlp']).map((s) => s.toUpperCase()).join('+');
      const consensusText =
        finding.consensus === 'hybrid_consensus'
          ? ' [CONSENSUS]'
          : finding.consensus === 'method_disagreement'
          ? ' [DISCREPANCY]'
          : '';
      const badgeStr = `[${finding.label.toUpperCase()}] ${finding.category} · Sources: [${sourcesText}]${consensusText} · Language: ${msg.languageInfo.label}`;
      const reasonStr = `Reason: ${finding.reason}`;

      const renderLines: StyledRenderLine[] = [];

      const pushWrappedBlock = (
        content: string,
        fontSize: number,
        bold: boolean,
        color: readonly [number, number, number],
        lineStep: number,
        gapBefore = 0,
        isMessageBody = false
      ) => {
        const lines = wrapMultilingualText(
          doc,
          content,
          textMaxWidth,
          fontSize,
          bold,
          hasUnicodeFonts
        );
        lines.forEach((line, lIdx) => {
          renderLines.push({
            text: line,
            fontSize,
            bold,
            color,
            lineStep,
            gapBefore: lIdx === 0 ? gapBefore : 0,
            isMessageBody,
          });
        });
      };

      const badgeColor: readonly [number, number, number] =
        finding.severity === 'critical'
          ? [185, 28, 28]
          : finding.severity === 'needs_review'
          ? [194, 65, 12]
          : goldDeep;

      pushWrappedBlock(headerStr, 8, true, purpleDark, 4.0, 0);
      pushWrappedBlock(badgeStr, 7.5, true, badgeColor, 3.8, 0.8);
      pushWrappedBlock(reasonStr, 7.5, false, textDark, 3.8, 0.8);

      // Original Message (verbatim, full multiline, zero truncation)
      pushWrappedBlock('Original Message:', 7.5, true, purpleDark, 3.6, 1.8);
      pushWrappedBlock(msg.text || '(Empty message)', 8, false, textDark, 4.2, 0.4, true);

      // English Translation (only for Hindi Devanagari / Roman Hindi / Hinglish)
      if (msg.translationInfo && msg.translationInfo.status !== 'not_needed') {
        if (
          msg.translationInfo.status === 'translated' &&
          msg.translationInfo.translatedText
        ) {
          pushWrappedBlock(
            'English Translation (AI-Generated):',
            7.5,
            true,
            translationAccent,
            3.6,
            1.8
          );
          pushWrappedBlock(
            msg.translationInfo.translatedText,
            8,
            false,
            translationAccent,
            4.2,
            0.4,
            true
          );
        } else {
          pushWrappedBlock(
            'English Translation (AI-Generated):',
            7.5,
            true,
            warnColor,
            3.6,
            1.8
          );
          pushWrappedBlock(
            `Translation unavailable: ${
              msg.translationInfo.unavailableReason ||
              'AI translation service unavailable. Original evidence preserved.'
            }`,
            7.5,
            false,
            warnColor,
            3.8,
            0.4
          );
        }
      }

      if (finding.isFalsePositiveLikely || finding.contextRationale) {
        pushWrappedBlock(
          `* Contextual Note: ${finding.contextRationale}`,
          7,
          false,
          warnColor,
          3.6,
          1.4
        );
      }

      const bgFill: readonly [number, number, number] =
        finding.severity === 'critical'
          ? [254, 244, 244]
          : finding.severity === 'elevated'
          ? [255, 251, 235]
          : finding.severity === 'needs_review'
          ? [255, 247, 237]
          : [250, 248, 254];
      const barFill: readonly [number, number, number] =
        finding.severity === 'critical'
          ? [220, 38, 38]
          : finding.severity === 'elevated'
          ? [217, 119, 6]
          : finding.severity === 'needs_review'
          ? [234, 88, 12]
          : [147, 51, 234];

      const topPad = 5.0;
      const bottomPad = 2.0;

      // Compute full height first so compact cards stay whole on a single page whenever possible
      let fullCardHeight = topPad + bottomPad;
      for (let r = 0; r < renderLines.length; r++) {
        fullCardHeight += (r > 0 && renderLines[r].gapBefore ? renderLines[r].gapBefore! : 0) + renderLines[r].lineStep;
      }

      const fullPageUsableHeight = maxContentBottomY - margin;
      if (fullCardHeight <= fullPageUsableHeight) {
        checkPageBreak(fullCardHeight + 3);
      }

      // Paginated card slice renderer handles both normal cards and >1-page long messages seamlessly
      let cursorIdx = 0;
      let isContinuation = false;

      while (cursorIdx < renderLines.length) {
        const minSliceHeight = 18;
        if (y + minSliceHeight > maxContentBottomY) {
          doc.addPage();
          y = margin;
          renderPageHeader();
        }

        const availableHeight = maxContentBottomY - y;
        const headerOffset = isContinuation ? 4.2 : 0;
        let usedInnerHeight = topPad + headerOffset;
        let endIdx = cursorIdx;

        while (endIdx < renderLines.length) {
          const item = renderLines[endIdx];
          const itemHeight = (endIdx === cursorIdx ? 0 : item.gapBefore || 0) + item.lineStep;
          if (usedInnerHeight + itemHeight + bottomPad > availableHeight) {
            break;
          }
          usedInnerHeight += itemHeight;
          endIdx++;
        }

        // Safety: always advance at least 1 line so loop never stalls
        if (endIdx === cursorIdx) {
          const item = renderLines[cursorIdx];
          usedInnerHeight += item.lineStep;
          endIdx = cursorIdx + 1;
        }

        const sliceHeight = usedInnerHeight + bottomPad;

        doc.setFillColor(bgFill[0], bgFill[1], bgFill[2]);
        doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentWidth, sliceHeight, 1.5, 1.5, 'FD');

        doc.setFillColor(barFill[0], barFill[1], barFill[2]);
        doc.rect(margin, y, 2.5, sliceHeight, 'F');

        let lineY = y + topPad;
        if (isContinuation) {
          drawMultilingualLine(
            doc,
            `#${idx + 1} (Continued) | Line ${msg.rawLineIndex} | Sender: ${msg.sender}`,
            textLeftX,
            lineY,
            7.2,
            true,
            textMuted,
            hasUnicodeFonts
          );
          lineY += headerOffset;
        }

        for (let k = cursorIdx; k < endIdx; k++) {
          const item = renderLines[k];
          if (k > cursorIdx && item.gapBefore) {
            lineY += item.gapBefore;
          }
          if (item.text.length > 0) {
            drawMultilingualLine(
              doc,
              item.text,
              textLeftX,
              lineY,
              item.fontSize,
              item.bold,
              item.color,
              hasUnicodeFonts
            );
          }
          lineY += item.lineStep;
        }

        y += sliceHeight + 3;
        cursorIdx = endIdx;
        isContinuation = true;
      }
    });

    y += 4;
  }

  // 5. Message Correlation Results
  if (includeCorrelations && forensicCase.correlations && forensicCase.correlations.length > 0) {
    checkPageBreak(35);
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(purpleDark[0], purpleDark[1], purpleDark[2]);
    doc.text('5. MESSAGE CORRELATIONS & CROSS-PARTICIPANT RELATIONSHIPS', margin, y);
    y += 4;

    doc.setFont(baseFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(
      'Inferred relationships connecting messages across senders via shared entities and semantic context.',
      margin,
      y + 1.5
    );
    y += 6.5;

    forensicCase.correlations.slice(0, 8).forEach((corr, idx) => {
      const srcMsg = forensicCase.messages.find((m) => m.id === corr.sourceMessageId);
      const tgtMsg = forensicCase.messages.find((m) => m.id === corr.targetMessageId);
      if (!srcMsg || !tgtMsg) return;

      const textWidth = contentWidth - 8;
      const titleText = `Corr #${idx + 1} | [${corr.correlationType.toUpperCase()}] Msg #${srcMsg.id} (${srcMsg.sender}) <-> Msg #${tgtMsg.id} (${tgtMsg.sender})`;
      const expText = `Explanation: ${corr.explanation}`;
      const pairText = `Msg #${srcMsg.id}: "${srcMsg.text}"  |  Msg #${tgtMsg.id}: "${tgtMsg.text}"`;

      const titleLines = wrapMultilingualText(doc, titleText, textWidth, 8, true, hasUnicodeFonts);
      const expLines = wrapMultilingualText(doc, expText, textWidth, 7.5, false, hasUnicodeFonts);
      const pairLines = wrapMultilingualText(doc, pairText, textWidth, 7.2, false, hasUnicodeFonts);

      const boxHeight =
        5.5 +
        titleLines.length * 3.9 +
        1.0 +
        expLines.length * 3.7 +
        1.0 +
        pairLines.length * 3.6 +
        2.0;

      if (y + boxHeight <= maxContentBottomY) {
        checkPageBreak(boxHeight + 3);
        doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
        doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
        doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');

        let cy = y + 5.5;
        titleLines.forEach((line) => {
          drawMultilingualLine(doc, line, margin + 4, cy, 8, true, purpleDark, hasUnicodeFonts);
          cy += 3.9;
        });
        cy += 1.0;
        expLines.forEach((line) => {
          drawMultilingualLine(doc, line, margin + 4, cy, 7.5, false, textDark, hasUnicodeFonts);
          cy += 3.7;
        });
        cy += 1.0;
        pairLines.forEach((line) => {
          drawMultilingualLine(
            doc,
            line,
            margin + 4,
            cy,
            7.2,
            false,
            textMuted,
            hasUnicodeFonts
          );
          cy += 3.6;
        });

        y += boxHeight + 3;
      } else {
        titleLines.forEach((line) => {
          checkPageBreak(5);
          drawMultilingualLine(doc, line, margin + 4, y, 8, true, purpleDark, hasUnicodeFonts);
          y += 3.9;
        });
        expLines.forEach((line) => {
          checkPageBreak(5);
          drawMultilingualLine(doc, line, margin + 4, y, 7.5, false, textDark, hasUnicodeFonts);
          y += 3.7;
        });
        pairLines.forEach((line) => {
          checkPageBreak(5);
          drawMultilingualLine(doc, line, margin + 4, y, 7.2, false, textMuted, hasUnicodeFonts);
          y += 3.6;
        });
        y += 3;
      }
    });

    y += 4;
  }

  // 6. Possible Event Clusters & Chronological Sequences
  if (includeEvents && forensicCase.events && forensicCase.events.length > 0) {
    checkPageBreak(40);
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(10);
    doc.setTextColor(purpleDark[0], purpleDark[1], purpleDark[2]);
    doc.text('6. POSSIBLE EVENT CLUSTERS & CHRONOLOGICAL STAGES', margin, y);
    y += 4;
    doc.setFont(baseFont, 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textMuted[0], textMuted[1], textMuted[2]);
    doc.text(
      'Preliminary correlation hypotheses derived strictly from shared entities and linked messages within this file; requires manual corroboration.',
      margin,
      y + 1
    );
    y += 6;

    const maxSinglePageBoxHeight = maxContentBottomY - margin - 6;

    const drawWrappedLinesPaginated = (
      lines: string[],
      x: number,
      fontSize: number,
      bold: boolean,
      color: readonly [number, number, number],
      lineStep: number,
      accentRgb: readonly [number, number, number]
    ) => {
      lines.forEach((line) => {
        checkPageBreak(lineStep + 2);
        doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
        doc.setLineWidth(0.7);
        doc.line(margin + 0.5, y - 2.6, margin + 0.5, y + 1.0);
        drawMultilingualLine(doc, line, x, y, fontSize, bold, color, hasUnicodeFonts);
        y += lineStep;
      });
    };

    forensicCase.events.forEach((ev, idx) => {
      const innerPadX = 4;
      const textMaxWidth = contentWidth - innerPadX * 2;
      const titleStep = 4.0;
      const bodyStep = 3.7;
      const metaStep = 3.5;
      const sectionGap = 1.4;

      const titleLines = wrapMultilingualText(
        doc,
        `Possible Event #${idx + 1}: ${ev.title}`,
        textMaxWidth,
        8.5,
        true,
        hasUnicodeFonts
      );
      const summaryLines = wrapMultilingualText(
        doc,
        ev.summary || '',
        textMaxWidth,
        7.5,
        false,
        hasUnicodeFonts
      );
      const aiSynthLines = ev.aiEventSynthesis
        ? wrapMultilingualText(
            doc,
            `AI Synthesis: ${ev.aiEventSynthesis}`,
            textMaxWidth,
            7.2,
            false,
            hasUnicodeFonts
          )
        : [];

      const entityDetailsParts: string[] = [];
      if (ev.locations && ev.locations.length > 0) {
        entityDetailsParts.push(`Locations: ${ev.locations.join(', ')}`);
      }
      if (ev.vehicles && ev.vehicles.length > 0) {
        entityDetailsParts.push(`Vehicles: ${ev.vehicles.join(', ')}`);
      }
      if (ev.objects && ev.objects.length > 0) {
        entityDetailsParts.push(`Objects: ${ev.objects.join(', ')}`);
      }
      if (ev.documents && ev.documents.length > 0) {
        entityDetailsParts.push(`Documents: ${ev.documents.join(', ')}`);
      }

      const detailLines =
        entityDetailsParts.length > 0
          ? wrapMultilingualText(
              doc,
              entityDetailsParts.join(' | '),
              textMaxWidth,
              7,
              false,
              hasUnicodeFonts
            )
          : [];

      const metaText = `Time Horizon: ${ev.timeRange.start} to ${ev.timeRange.end} | Senders: ${ev.participants.join(', ')} | Status: ${ev.status.toUpperCase()}`;
      const metaLines = wrapMultilingualText(
        doc,
        metaText,
        textMaxWidth,
        7,
        false,
        hasUnicodeFonts
      );

      const topBaselineOffset = 5.5;
      const bottomPad = 1.5;
      let clusterCardHeight = topBaselineOffset + titleLines.length * titleStep + bottomPad;
      if (summaryLines.length > 0) {
        clusterCardHeight += sectionGap + summaryLines.length * bodyStep;
      }
      if (aiSynthLines.length > 0) {
        clusterCardHeight += sectionGap + aiSynthLines.length * bodyStep;
      }
      if (detailLines.length > 0) {
        clusterCardHeight += sectionGap + detailLines.length * metaStep;
      }
      if (metaLines.length > 0) {
        clusterCardHeight += sectionGap + metaLines.length * metaStep;
      }

      const eventTitleColor = [120, 90, 20] as const;
      const aiSynthColor = [70, 55, 110] as const;

      if (clusterCardHeight <= maxSinglePageBoxHeight) {
        checkPageBreak(clusterCardHeight + 3);

        doc.setFillColor(252, 250, 242);
        doc.setDrawColor(212, 175, 55);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, contentWidth, clusterCardHeight, 1.5, 1.5, 'FD');

        let cursorY = y + topBaselineOffset;

        titleLines.forEach((line) => {
          drawMultilingualLine(
            doc,
            line,
            margin + innerPadX,
            cursorY,
            8.5,
            true,
            eventTitleColor,
            hasUnicodeFonts
          );
          cursorY += titleStep;
        });

        if (summaryLines.length > 0) {
          cursorY += sectionGap;
          summaryLines.forEach((line) => {
            drawMultilingualLine(
              doc,
              line,
              margin + innerPadX,
              cursorY,
              7.5,
              false,
              textDark,
              hasUnicodeFonts
            );
            cursorY += bodyStep;
          });
        }

        if (aiSynthLines.length > 0) {
          cursorY += sectionGap;
          aiSynthLines.forEach((line) => {
            drawMultilingualLine(
              doc,
              line,
              margin + innerPadX,
              cursorY,
              7.2,
              false,
              aiSynthColor,
              hasUnicodeFonts
            );
            cursorY += bodyStep;
          });
        }

        if (detailLines.length > 0) {
          cursorY += sectionGap;
          detailLines.forEach((line) => {
            drawMultilingualLine(
              doc,
              line,
              margin + innerPadX,
              cursorY,
              7,
              false,
              textDark,
              hasUnicodeFonts
            );
            cursorY += metaStep;
          });
        }

        if (metaLines.length > 0) {
          cursorY += sectionGap;
          metaLines.forEach((line) => {
            drawMultilingualLine(
              doc,
              line,
              margin + innerPadX,
              cursorY,
              7,
              false,
              textMuted,
              hasUnicodeFonts
            );
            cursorY += metaStep;
          });
        }

        y += clusterCardHeight + 3;
      } else {
        checkPageBreak(14);
        y += 2;
        drawWrappedLinesPaginated(
          titleLines,
          margin + innerPadX,
          8.5,
          true,
          eventTitleColor,
          titleStep,
          [212, 175, 55]
        );

        if (summaryLines.length > 0) {
          y += sectionGap;
          drawWrappedLinesPaginated(
            summaryLines,
            margin + innerPadX,
            7.5,
            false,
            textDark,
            bodyStep,
            [212, 175, 55]
          );
        }

        if (aiSynthLines.length > 0) {
          y += sectionGap;
          drawWrappedLinesPaginated(
            aiSynthLines,
            margin + innerPadX,
            7.2,
            false,
            aiSynthColor,
            bodyStep,
            [212, 175, 55]
          );
        }

        if (detailLines.length > 0) {
          y += sectionGap;
          drawWrappedLinesPaginated(
            detailLines,
            margin + innerPadX,
            7,
            false,
            textDark,
            metaStep,
            [212, 175, 55]
          );
        }

        if (metaLines.length > 0) {
          y += sectionGap;
          drawWrappedLinesPaginated(
            metaLines,
            margin + innerPadX,
            7,
            false,
            textMuted,
            metaStep,
            [212, 175, 55]
          );
        }

        y += 3;
      }

      // Chronological Stages for this Event Cluster
      if (ev.stages && ev.stages.length > 0) {
        checkPageBreak(14);
        doc.setFont(baseFont, 'bold');
        doc.setFontSize(8);
        doc.setTextColor(purpleDark[0], purpleDark[1], purpleDark[2]);
        doc.text(`Chronological Stages (${ev.stages.length}) — Possible Event #${idx + 1}`, margin + 2, y);
        y += 3.5;

        const stageBoxX = margin + 3;
        const stageBoxWidth = contentWidth - 3;
        const stageTextWidth = stageBoxWidth - 8;

        ev.stages.forEach((stage) => {
          const stageHeader = `Stage ${stage.stageNumber}: ${stage.title} | Msg #${stage.messageId} | ${stage.timestamp} | Sender: ${stage.sender}`;
          const stageHeaderLines = wrapMultilingualText(
            doc,
            stageHeader,
            stageTextWidth,
            7.5,
            true,
            hasUnicodeFonts
          );
          const stageDescLines = wrapMultilingualText(
            doc,
            stage.description || '',
            stageTextWidth,
            7.5,
            false,
            hasUnicodeFonts
          );

          const stageTopOffset = 4.8;
          const stageGap = 1.0;
          const stageBottomPad = 1.2;
          const stageBoxHeight =
            stageTopOffset +
            stageHeaderLines.length * bodyStep +
            (stageDescLines.length > 0 ? stageGap + stageDescLines.length * bodyStep : 0) +
            stageBottomPad;

          if (stageBoxHeight <= maxSinglePageBoxHeight) {
            checkPageBreak(stageBoxHeight + 2.5);

            doc.setFillColor(bgLight[0], bgLight[1], bgLight[2]);
            doc.setDrawColor(borderLight[0], borderLight[1], borderLight[2]);
            doc.setLineWidth(0.3);
            doc.roundedRect(stageBoxX, y, stageBoxWidth, stageBoxHeight, 1.2, 1.2, 'FD');

            let stageY = y + stageTopOffset;
            stageHeaderLines.forEach((line) => {
              drawMultilingualLine(
                doc,
                line,
                stageBoxX + 4,
                stageY,
                7.5,
                true,
                purpleDark,
                hasUnicodeFonts
              );
              stageY += bodyStep;
            });

            if (stageDescLines.length > 0) {
              stageY += stageGap;
              stageDescLines.forEach((line) => {
                drawMultilingualLine(
                  doc,
                  line,
                  stageBoxX + 4,
                  stageY,
                  7.5,
                  false,
                  textDark,
                  hasUnicodeFonts
                );
                stageY += bodyStep;
              });
            }

            y += stageBoxHeight + 2;
          } else {
            checkPageBreak(12);
            drawWrappedLinesPaginated(
              stageHeaderLines,
              stageBoxX + 4,
              7.5,
              true,
              purpleDark,
              bodyStep,
              [147, 51, 234]
            );

            if (stageDescLines.length > 0) {
              y += stageGap;
              drawWrappedLinesPaginated(
                stageDescLines,
                stageBoxX + 4,
                7.5,
                false,
                textDark,
                bodyStep,
                [147, 51, 234]
              );
            }
            y += 2;
          }
        });

        y += 3;
      }
    });

    y += 4;
  }

  // 7. Statutory Disclaimer & Verification Mandate
  if (includeDisclaimer) {
    doc.setFont(baseFont, 'normal');
    doc.setFontSize(7.5);
    const textMaxWidth = contentWidth - 8;
    const lineHeight = 3.6;
    const bulletSpacing = 1.6;

    const disclaimer = [
      '• Automated findings generated by ForenText are preliminary investigative indicators, not conclusive legal evidence.',
      '• Pattern matches (e.g. vehicle registration plates, person names, phone numbers) require independent corroboration against official records (RTO/DMV, Telecom Service Providers, or judicial warrants).',
      '• Keyword occurrences alone do not demonstrate criminal intent or culpability. Benign linguistic context (e.g. colloquialisms, culinary references, entertainment) must be examined manually by a qualified digital forensics investigator.',
      '• AI-generated English translations of Hindi or mixed-language messages are investigative aids only; original evidence messages remain preserved verbatim and authoritative.',
      '• This document certifies the integrity of the uploaded evidence file against SHA-256 hash at the time of processing.',
    ];

    const wrappedBulletGroups: string[][] = disclaimer.map((item) =>
      wrapMultilingualText(doc, item, textMaxWidth, 7.5, false, hasUnicodeFonts)
    );

    const totalLinesCount = wrappedBulletGroups.reduce((acc, lines) => acc + lines.length, 0);
    const totalContentHeight =
      totalLinesCount * lineHeight + (disclaimer.length - 1) * bulletSpacing;
    const boxTopPadding = 11;
    const boxBottomPadding = 4;
    const boxHeight = boxTopPadding + totalContentHeight + boxBottomPadding;

    checkPageBreak(boxHeight + 6);
    y += 4;

    doc.setFillColor(245, 243, 250);
    doc.setDrawColor(180, 170, 205);
    doc.roundedRect(margin, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');

    doc.setFont(baseFont, 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(purpleDark[0], purpleDark[1], purpleDark[2]);
    doc.text('7. FORENSIC LIMITATIONS & MANDATORY VERIFICATION DISCLAIMER', margin + 4, y + 6);

    let currentTextY = y + 11;
    wrappedBulletGroups.forEach((lines) => {
      lines.forEach((line) => {
        drawMultilingualLine(doc, line, margin + 4, currentTextY, 7.5, false, textMuted, hasUnicodeFonts);
        currentTextY += lineHeight;
      });
      currentTextY += bulletSpacing;
    });

    y += boxHeight + 4;

    // Examiner Attestation Sign-off
    checkPageBreak(25);
    doc.setFont(baseFont, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);

    const sigLabel = 'Examiner Signature / Digital Seal:';
    const dateLabel = 'Date of Review:';
    const sigLabelWidth = doc.getTextWidth(sigLabel);
    const dateLabelWidth = doc.getTextWidth(dateLabel);

    const sigLabelX = margin + 4;
    const sigLineStartX = sigLabelX + sigLabelWidth + 3;
    const sigLineEndX = sigLineStartX + 46;

    const dateLabelX = sigLineEndX + 14;
    const dateLineStartX = dateLabelX + dateLabelWidth + 3;
    const dateLineEndX = pageWidth - margin - 4;

    doc.text(sigLabel, sigLabelX, y + 10);
    doc.setDrawColor(180, 170, 205);
    doc.setLineWidth(0.3);
    doc.line(sigLineStartX, y + 10, sigLineEndX, y + 10);

    doc.text(dateLabel, dateLabelX, y + 10);
    doc.line(dateLineStartX, y + 10, dateLineEndX, y + 10);
  }

  // Number all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    renderPageFooter(p, totalPages);
  }

  return doc;
}
