/**
 * ForenText v2.0 - Messaging Forensics Analysis Data Types
 * Comprehensive data models for Hybrid (Rule + NLP + AI) analysis,
 * entity extraction, message correlation, event clustering, and graph models.
 */

export type EntityCategory =
  | 'Person'
  | 'Location'
  | 'Vehicle'
  | 'VehiclePlate'
  | 'Object'
  | 'Weapon'
  | 'Violence'
  | 'Document'
  | 'DateTime'
  | 'ContactIdentifier';

export type FindingSeverity =
  | 'critical'
  | 'elevated'
  | 'needs_review'
  | 'contextual'
  | 'informational';

export type FindingLabel =
  | 'Keyword Match'
  | 'Contextual Indicator'
  | 'Entity Reference'
  | 'Requires Manual Review'
  | 'Unusual / Contextual Concern – Needs Review'
  | 'Logistics & Movement'
  | 'Object & Handover'
  | 'Potential Coordination';

export type ReviewStatus = 'unreviewed' | 'relevant' | 'not_relevant' | 'needs_review';

export type CorrelationStatus = 'suggested' | 'confirmed' | 'rejected';

export type CorrelationType =
  | 'shared_entity'
  | 'semantic_topic'
  | 'temporal_proximity'
  | 'cross_participant_reference';

// --- HYBRID METHODOLOGY TYPES ---
export type AnalysisSource = 'rule' | 'nlp' | 'ai';

export type MethodConsensus =
  | 'rule_only'
  | 'nlp_only'
  | 'ai_only'
  | 'hybrid_consensus'
  | 'method_disagreement';

export interface ExtractedEntity {
  id: string;
  messageId: number;
  text: string;
  category: EntityCategory;
  confidence: 'high' | 'medium' | 'pattern_only';
  method: string;
  details?: string;
  normalizedGroup?: string; // Group key for entity normalisation (e.g. vehicle:swift_white)
  aliasCandidates?: string[]; // Alternative expressions that may refer to same entity
  sources?: AnalysisSource[]; // Which approaches identified this entity (rule, nlp, ai)
  consensus?: MethodConsensus; // Agreement / disagreement status across approaches
  aiInterpretation?: string; // AI contextual interpretation of why entity is meaningful
  disagreementNote?: string; // Note if methods differed in classification
  investigatorVerified?: boolean;
  verificationStatus?: 'unverified' | 'confirmed' | 'rejected';
  investigatorNotes?: string;
}

export interface EntityNormalisationGroup {
  groupId: string;
  category: EntityCategory;
  canonicalName: string;
  variants: { text: string; messageId: number; entityId: string }[];
  isConfirmedByInvestigator: boolean;
  notes?: string;
}

export interface FlaggedFinding {
  id: string;
  messageId: number;
  category:
    | 'Weapon'
    | 'Violence'
    | 'Threat'
    | 'SuspiciousContext'
    | 'UnusualConcern'
    | 'MeetingLocation'
    | 'DocumentExchange'
    | 'VehicleReference'
    | 'ObjectPlacement'
    | 'LogisticsArrival'
    | 'MultiFactor';
  severity: FindingSeverity;
  label: FindingLabel;
  reason: string;
  matchedTokens: string[];
  isFalsePositiveLikely: boolean;
  contextRationale: string;
  analysisMethod?: string;
  confidenceScore?: number; // 0.0 - 1.0
  sources?: AnalysisSource[]; // e.g. ['rule', 'nlp', 'ai']
  consensus?: MethodConsensus;
  aiExplanation?: string; // Specific AI contextual analysis
  aiContextualInterpretation?: string; // AI contextual appraisal
  ruleRationale?: string; // Specific rule/keyword rationale
  nlpRationale?: string; // Specific NLP token/lexical rationale
  disagreementNote?: string; // Highlighted discrepancies between Rule/NLP/AI
  discrepancyNote?: string; // Discrepancy explanation alias
  reviewStatus?: ReviewStatus;
  investigatorNotes?: string;
}

// --- MULTILINGUAL LANGUAGE DETECTION TYPES ---
export type DetectedLanguage =
  | 'english'
  | 'hindi_devanagari'
  | 'roman_hindi'
  | 'hinglish'
  | 'unknown';

export type DetectedScript = 'latin' | 'devanagari' | 'mixed' | 'other' | 'unknown';

export type LanguageConfidence = 'high' | 'medium' | 'low';

export interface MessageLanguageMetadata {
  language: DetectedLanguage;
  label: string;
  script: DetectedScript;
  confidence: LanguageConfidence;
  confidenceScore: number; // 0.0 - 1.0
  isMixed: boolean;
  isUncertain: boolean;
  reasons: string[];
  signals: {
    totalTokens: number;
    devanagariTokenCount: number;
    latinTokenCount: number;
    englishMarkerCount: number;
    romanHindiMarkerCount: number;
    devanagariCharRatio: number;
    latinCharRatio: number;
  };
}

export type TranslationStatus = 'not_needed' | 'translated' | 'unavailable';

export interface MessageTranslationMetadata {
  status: TranslationStatus;
  translatedText?: string;
  sourceLanguage: DetectedLanguage;
  provider?: string;
  isAIGenerated: true;
  unavailableReason?: string;
}

export type EvidenceFormat = 'txt' | 'csv' | 'json' | 'html';

export interface MessageRecord {
  id: number;
  rawLineIndex: number;
  timestamp: string; // ISO / display formatted
  timestampRaw: string;
  dateStr: string; // YYYY-MM-DD
  hour: number; // 0-23
  sender: string;
  text: string;
  isSystemMessage: boolean;
  hasMediaAttachment: boolean;
  mediaDescription?: string;
  languageInfo: MessageLanguageMetadata;
  translationInfo?: MessageTranslationMetadata;
  flaggedFindings: FlaggedFinding[];
  entities: ExtractedEntity[];
  investigatorStatus: ReviewStatus;
  investigatorNotes?: string;
  aiContextSummary?: string; // AI contextual appraisal of this specific message
}

export interface MessageCorrelation {
  id: string;
  sourceMessageId: number;
  targetMessageId: number;
  correlationType: CorrelationType;
  sharedEntities: string[];
  sharedTopics: string[];
  explanation: string;
  confidence: 'high' | 'medium' | 'contextual';
  timeDeltaMinutes: number;
  status: CorrelationStatus;
  sources?: AnalysisSource[];
  aiCorrelationRationale?: string;
  investigatorNotes?: string;
}

export interface EventStage {
  stageNumber: number;
  title: string;
  messageId: number;
  description: string;
  timestamp: string;
  sender: string;
}

export interface EventCluster {
  id: string;
  title: string;
  summary: string;
  timeRange: { start: string; end: string };
  messageIds: number[];
  participants: string[];
  locations: string[];
  vehicles: string[];
  objects: string[];
  documents: string[];
  stages: EventStage[];
  status: 'suggested' | 'confirmed' | 'rejected';
  confidence: 'high' | 'medium' | 'contextual';
  sources?: AnalysisSource[];
  aiEventSynthesis?: string;
  investigatorNotes?: string;
}

export interface EvidenceMetadata {
  filename: string;
  fileSizeBytes: number;
  sha256: string;
  parsedAt: string;
  totalLines: number;
  totalMessages: number;
  systemMessages: number;
  senders: string[];
  dateRange: { start: string; end: string };
  isDemo: boolean;
  warnings: string[];
  languageSummary?: {
    counts: Record<DetectedLanguage, number>;
    totalAnalyzed: number;
  };
  sourceFormat?: EvidenceFormat;
}

export interface HybridStatistics {
  ruleCount: number;
  nlpCount: number;
  aiCount: number;
  consensusCount: number;
  disagreementCount: number;
  isAIEngineActive: boolean;
  aiProvider?: string;
}

export interface ForensicCase {
  metadata: EvidenceMetadata;
  messages: MessageRecord[];
  entities: ExtractedEntity[];
  findings: FlaggedFinding[];
  correlations: MessageCorrelation[];
  events: EventCluster[];
  normalisationGroups?: EntityNormalisationGroup[];
  hybridStats: HybridStatistics;
  rawText: string;
}
