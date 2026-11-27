/**
 * ForenText v2.0 Relevance and Contextual Classifier
 * Determines investigative relevance using multi-factor heuristics,
 * contextual intent detection, and transparent false-positive disambiguation.
 * 100% offline, privacy-preserving, explainable.
 */

import { FlaggedFinding, ExtractedEntity } from '../types/forensics';
import { buildDiscreetConcernFindings } from './discreetConcernDetector';

interface ClassificationResult {
  findings: FlaggedFinding[];
}

export function classifyMessageRelevance(
  text: string,
  messageId: number,
  entities: ExtractedEntity[]
): ClassificationResult {
  const findings: FlaggedFinding[] = [];
  const lower = text.toLowerCase();

  const weaponEntities = entities.filter((e) => e.category === 'Weapon');
  const violenceEntities = entities.filter((e) => e.category === 'Violence');
  const vehiclePlateEntities = entities.filter((e) => e.category === 'VehiclePlate');
  const vehicleEntities = entities.filter((e) => e.category === 'Vehicle' || e.category === 'VehiclePlate');
  const docEntities = entities.filter((e) => e.category === 'Document');
  const locEntities = entities.filter((e) => e.category === 'Location');
  const objectEntities = entities.filter((e) => e.category === 'Object');
  const timeEntities = entities.filter((e) => e.category === 'DateTime');

  // Context Disambiguators
  const isCulinary = /\b(?:kitchen|cut|vegetable|cake|fruit|chef|cooking|chop|salad|recipe|dinner|lunch|breakfast)\b/i.test(text);
  const isMedia = /\b(?:game|movie|film|pubg|call of duty|gta|cinema|scene|show|acting|trailer|actor|director)\b/i.test(text);
  const isFigurativeIdiom = /\b(?:dead tired|killing it|dying of laughter|killing me|shoot an email|broken heart)\b/i.test(text);

  // Contextual Action Patterns
  const isMeetingDirective = /\b(?:meet|rendezvous|come to|arrive|drop off|see you)\b/i.test(lower);
  const isTransitOrArrival = /\b(?:reach|reaching|arrived|departed|heading|en route|on the way|reached)\b/i.test(lower);
  const isParkedOrStationary = /\b(?:parked|waiting outside|left outside|kept near|placed near|spotted)\b/i.test(lower);
  const isHandoverDirective = /\b(?:bring|hand over|transfer|carry|deliver|collect|pass on)\b/i.test(lower);
  const isPlacementOrAbandonment = /\b(?:left outside|someone left|kept outside|abandoned|lying near)\b/i.test(lower);
  const isDestructionOrSecrecy = /\b(?:delete|wipe|destroy|burn|hide|clear chat|erase|no cops|covert)\b/i.test(lower);
  const isFinancialOrExtortion = /\b(?:cash|money|token|payment|lakh|crore|settlement|ransom|cheque|rupees|amount|fee)\b/i.test(lower);

  // 1. Weapon References
  if (weaponEntities.length > 0) {
    const tokens = weaponEntities.map((e) => e.text);
    if (isCulinary) {
      findings.push({
        id: `flag-${messageId}-${findings.length + 1}`,
        messageId,
        category: 'Weapon',
        severity: 'informational',
        label: 'Requires Manual Review',
        reason: 'Weapon term detected, but surrounding text contains domestic/culinary markers (e.g. food/kitchen).',
        matchedTokens: tokens,
        isFalsePositiveLikely: true,
        contextRationale:
          'Likely benign context (culinary/household use). Marked for manual investigator verification to confirm absence of illicit intent.',
        analysisMethod: 'Rule-Based Lexical Disambiguation',
        confidenceScore: 0.45,
      });
    } else if (isMedia) {
      findings.push({
        id: `flag-${messageId}-${findings.length + 1}`,
        messageId,
        category: 'Weapon',
        severity: 'informational',
        label: 'Contextual Indicator',
        reason: 'Weapon terminology detected in proximity to gaming or film/entertainment references.',
        matchedTokens: tokens,
        isFalsePositiveLikely: true,
        contextRationale:
          'Probable entertainment/gaming reference. Documented transparently to avoid false attribution.',
        analysisMethod: 'Contextual Media Heuristic',
        confidenceScore: 0.4,
      });
    } else {
      const isFirearm = /\b(?:9mm|pistol|revolver|katta|firearm|barrel|silencer|ammunition|bullets)\b/i.test(text);
      findings.push({
        id: `flag-${messageId}-${findings.length + 1}`,
        messageId,
        category: 'Weapon',
        severity: isFirearm ? 'critical' : 'elevated',
        label: isFirearm ? 'Keyword Match' : 'Contextual Indicator',
        reason: `Explicit weapon reference (${tokens.join(', ')}).`,
        matchedTokens: tokens,
        isFalsePositiveLikely: false,
        contextRationale: isFirearm
          ? 'Ballistic/firearm terminology identified without mitigating colloquial markers. High investigative relevance.'
          : 'Edged or blunt weapon terminology identified. Flagged for review.',
        analysisMethod: 'Deterministic Weapon Lexicon Match',
        confidenceScore: 0.95,
      });
    }
  }

  // 2. Violence & Threat Language
  if (violenceEntities.length > 0) {
    const tokens = violenceEntities.map((e) => e.text);
    if (isFigurativeIdiom) {
      findings.push({
        id: `flag-${messageId}-${findings.length + 1}`,
        messageId,
        category: 'Violence',
        severity: 'informational',
        label: 'Requires Manual Review',
        reason: 'Violent terminology detected within common colloquial or hyperbolic phrase.',
        matchedTokens: tokens,
        isFalsePositiveLikely: true,
        contextRationale:
          'Phrase matches known English/Hinglish idiom (e.g., "killing it", "dead tired"). Low likelihood of actual physical threat.',
        analysisMethod: 'Idiomatic Filter Rule',
        confidenceScore: 0.35,
      });
    } else if (isMedia) {
      findings.push({
        id: `flag-${messageId}-${findings.length + 1}`,
        messageId,
        category: 'Violence',
        severity: 'informational',
        label: 'Contextual Indicator',
        reason: 'Violence terms identified in media or gaming discussion context.',
        matchedTokens: tokens,
        isFalsePositiveLikely: true,
        contextRationale: 'Context points to entertainment/media discussion rather than real-world coercion.',
        analysisMethod: 'Contextual Media Heuristic',
        confidenceScore: 0.4,
      });
    } else {
      findings.push({
        id: `flag-${messageId}-${findings.length + 1}`,
        messageId,
        category: 'Threat',
        severity: 'critical',
        label: 'Keyword Match',
        reason: `Explicit threat or violence expression detected (${tokens.join(', ')}).`,
        matchedTokens: tokens,
        isFalsePositiveLikely: false,
        contextRationale:
          'Contains coercive or violent action verbs without figurative mitigators. High investigative priority.',
        analysisMethod: 'Threat Expression Detection',
        confidenceScore: 0.9,
      });
    }
  }

  // 3. Multi-Factor: Meeting + Weapon or Meeting + Destruction
  if (isMeetingDirective && (weaponEntities.length > 0 || isDestructionOrSecrecy)) {
    findings.push({
      id: `flag-${messageId}-${findings.length + 1}`,
      messageId,
      category: 'MultiFactor',
      severity: 'critical',
      label: 'Contextual Indicator',
      reason: 'Physical rendezvous directive combined with weapon or evidence-destruction indicators.',
      matchedTokens: ['meeting directive', ...weaponEntities.map((e) => e.text)],
      isFalsePositiveLikely: false,
      contextRationale:
        'Coordinated rendezvous language combined with sensitive indicators warrants prioritized timeline correlation.',
      analysisMethod: 'Multi-Factor Contextual Correlation',
      confidenceScore: 0.92,
    });
  }

  // 4. Evidence Tampering / Destruction
  if (isDestructionOrSecrecy && (docEntities.length > 0 || /\b(?:phone|chat|messages|ledger|hard drive|cctv|history)\b/i.test(text))) {
    findings.push({
      id: `flag-${messageId}-${findings.length + 1}`,
      messageId,
      category: 'SuspiciousContext',
      severity: 'elevated',
      label: 'Contextual Indicator',
      reason: 'Discussion of wiping, destroying, or concealing documents/records or communications.',
      matchedTokens: ['destruction/secrecy term'],
      isFalsePositiveLikely: false,
      contextRationale:
        'Explicit reference to data/document destruction or clandestine communication.',
      analysisMethod: 'Anti-Forensics & Concealment Detection',
      confidenceScore: 0.88,
    });
  }

  // 5. Contextual: Logistics & Arrival (e.g. "I will reach <City> by 10:30")
  if (isTransitOrArrival && locEntities.length > 0 && timeEntities.length > 0) {
    const locNames = locEntities.map((e) => e.text).join(', ');
    const timeNames = timeEntities.map((e) => e.text).join(', ');
    findings.push({
      id: `flag-${messageId}-${findings.length + 1}`,
      messageId,
      category: 'LogisticsArrival',
      severity: 'contextual',
      label: 'Logistics & Movement',
      reason: `Transit coordination detected: destination (${locNames}) with estimated arrival time (${timeNames}).`,
      matchedTokens: [...locEntities.map((e) => e.text), ...timeEntities.map((e) => e.text)],
      isFalsePositiveLikely: false,
      contextRationale:
        'Temporal and geographical movement coordination. Relevant for building subject journey and timeline synchronisation.',
      analysisMethod: 'Contextual Spatio-Temporal Extraction',
      confidenceScore: 0.82,
    });
  }

  // 6. Contextual: Vehicle Spotting & Parking near Landmark
  if (vehicleEntities.length > 0 && (isParkedOrStationary || locEntities.length > 0)) {
    const vehNames = vehicleEntities.map((e) => e.text).join(', ');
    const locNames = locEntities.map((e) => e.text).join(', ') || 'proximity area';
    findings.push({
      id: `flag-${messageId}-${findings.length + 1}`,
      messageId,
      category: 'VehicleReference',
      severity: 'contextual',
      label: 'Entity Reference',
      reason: `Vehicular presence/status logged (${vehNames}) in relation to spatial landmark (${locNames}).`,
      matchedTokens: [...vehicleEntities.map((e) => e.text), ...locEntities.map((e) => e.text)],
      isFalsePositiveLikely: false,
      contextRationale:
        'Vehicle identification and stationary status observed. Valuable for physical scene correlation and surveillance logs.',
      analysisMethod: 'Vehicle-Location Spatial Correlation',
      confidenceScore: 0.85,
    });
  }

  // 7. Contextual: Physical Object Placement or Suspicious Baggage
  if (objectEntities.length > 0 && (isPlacementOrAbandonment || isParkedOrStationary)) {
    const objNames = objectEntities.map((e) => e.text).join(', ');
    findings.push({
      id: `flag-${messageId}-${findings.length + 1}`,
      messageId,
      category: 'ObjectPlacement',
      severity: 'elevated',
      label: 'Object & Handover',
      reason: `Physical object or container (${objNames}) referenced in stationary or placement context.`,
      matchedTokens: objectEntities.map((e) => e.text),
      isFalsePositiveLikely: false,
      contextRationale:
        'Unattended or positioned physical object/container reference. Requires verification against physical evidence recovery.',
      analysisMethod: 'Physical Asset Contextual Heuristic',
      confidenceScore: 0.86,
    });
  }

  // 8. Contextual: Transport Hub Rendezvous Directive
  if (isMeetingDirective && locEntities.some((l) => /station|airport|terminal|plaza|building|warehouse|safe house/i.test(l.text))) {
    const hubLocs = locEntities.filter((l) => /station|airport|terminal|plaza|building|warehouse|safe house/i.test(l.text));
    findings.push({
      id: `flag-${messageId}-${findings.length + 1}`,
      messageId,
      category: 'MeetingLocation',
      severity: 'elevated',
      label: 'Potential Coordination',
      reason: `Rendezvous directive at transit hub or physical landmark (${hubLocs.map((l) => l.text).join(', ')}).`,
      matchedTokens: hubLocs.map((l) => l.text),
      isFalsePositiveLikely: false,
      contextRationale:
        'Explicit rendezvous directive designating specific transit or facility hub. Critical for participant meeting attribution.',
      analysisMethod: 'Rendezvous Directive Pattern Match',
      confidenceScore: 0.89,
    });
  }

  // 9. Contextual: Sensitive Document Handover
  if (docEntities.length > 0 && (isHandoverDirective || isFinancialOrExtortion || isMeetingDirective)) {
    const tokens = docEntities.map((e) => e.text);
    findings.push({
      id: `flag-${messageId}-${findings.length + 1}`,
      messageId,
      category: 'DocumentExchange',
      severity: 'elevated',
      label: 'Object & Handover',
      reason: `Sensitive document/contract reference (${tokens.join(', ')}) accompanied by exchange, handover, or financial terms.`,
      matchedTokens: tokens,
      isFalsePositiveLikely: false,
      contextRationale:
        'Custody transfer or physical transport of legal/official instruments identified.',
      analysisMethod: 'Document Custody Transfer Rule',
      confidenceScore: 0.87,
    });
  }

  // 10. Vehicle Registration Plates Alone
  if (vehiclePlateEntities.length > 0 && !findings.some((f) => f.category === 'VehicleReference')) {
    const tokens = vehiclePlateEntities.map((e) => e.text);
    findings.push({
      id: `flag-${messageId}-${findings.length + 1}`,
      messageId,
      category: 'VehicleReference',
      severity: 'contextual',
      label: 'Entity Reference',
      reason: `Vehicle registration plate pattern detected (${tokens.join(', ')}).`,
      matchedTokens: tokens,
      isFalsePositiveLikely: false,
      contextRationale:
        'Specific vehicular identifier extracted. Cross-referencing with transit logs or RTO records recommended.',
      analysisMethod: 'RegEx Identifier Match',
      confidenceScore: 0.8,
    });
  }

  // 11. Multilingual Discreet & Indirect Suspicious Activity (Orange – Needs Review)
  // Run whenever message is not already mitigated as a benign culinary/media/idiom false positive
  // and does not already carry an explicit higher-severity critical threat/weapon finding.
  const hasHighSeverityExplicit = findings.some(
    (f) => f.severity === 'critical' && !f.isFalsePositiveLikely
  );
  const hasMitigatedFalsePositive = findings.some((f) => f.isFalsePositiveLikely);
  if (!hasHighSeverityExplicit && !hasMitigatedFalsePositive) {
    const discreetFindings = buildDiscreetConcernFindings(text, messageId, findings.length + 1);
    for (const df of discreetFindings) {
      findings.push(df);
    }
  }

  return { findings };
}
