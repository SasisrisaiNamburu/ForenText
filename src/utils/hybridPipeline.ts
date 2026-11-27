/**
 * ForenText v2.0 Hybrid Analysis Pipeline
 * Integrates:
 * 1. Rule-Based Analysis (Regex patterns, keyword lexicons, identifier formats)
 * 2. NLP-Based Analysis (Tokenisation, entity classification, normalisation, syntactic heuristics)
 * 3. AI-Assisted Analysis (Contextual understanding, indirect references, semantic correlations)
 *
 * Merges duplicate findings while preserving all provenance sources,
 * tracks agreements and disagreements, and computes hybrid statistics.
 */

import {
  MessageRecord,
  ExtractedEntity,
  FlaggedFinding,
  MessageCorrelation,
  EventCluster,
  AnalysisSource,
  MethodConsensus,
  HybridStatistics,
  DetectedLanguage,
} from '../types/forensics';
import { AITranslationInput } from '../server/geminiAiServer';
import { executeAIAnalysis, executeAITranslations } from './aiAnalyzer';
import { buildEventClusters } from './correlationEngine';

export interface HybridPipelineResult {
  messages: MessageRecord[];
  entities: ExtractedEntity[];
  findings: FlaggedFinding[];
  correlations: MessageCorrelation[];
  events: EventCluster[];
  hybridStats: HybridStatistics;
}

const LANGUAGES_REQUIRING_TRANSLATION = new Set<DetectedLanguage>([
  'hindi_devanagari',
  'roman_hindi',
  'hinglish',
]);

export async function runHybridPipeline(
  messages: MessageRecord[],
  baseEntities: ExtractedEntity[],
  baseFindings: FlaggedFinding[],
  baseCorrelations: MessageCorrelation[],
  baseEvents: EventCluster[]
): Promise<HybridPipelineResult> {
  // 1. Prepare messages for AI analysis and targeted English translations
  const aiInput = messages.map((m) => ({
    id: m.id,
    sender: m.sender,
    text: m.text,
    timestamp: m.timestamp,
  }));

  const translationInput: AITranslationInput[] = messages
    .filter(
      (m) =>
        !m.isSystemMessage &&
        m.text.trim().length > 0 &&
        LANGUAGES_REQUIRING_TRANSLATION.has(m.languageInfo.language)
    )
    .map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      detectedLanguage: m.languageInfo.language as
        | 'hindi_devanagari'
        | 'roman_hindi'
        | 'hinglish',
    }));

  const [aiEvaluation, translationEvaluation] = await Promise.all([
    executeAIAnalysis(aiInput),
    executeAITranslations(translationInput),
  ]);
  const aiOutput = aiEvaluation.output;

  // Attach translation metadata without modifying original text, sender, or timestamp
  const enrichedMessages: MessageRecord[] = messages.map((m) => {
    const lang = m.languageInfo.language;
    if (m.isSystemMessage || !LANGUAGES_REQUIRING_TRANSLATION.has(lang) || !m.text.trim()) {
      return {
        ...m,
        translationInfo: {
          status: 'not_needed',
          sourceLanguage: lang,
          isAIGenerated: true,
        },
      };
    }

    const translatedText = translationEvaluation.translationsById[m.id];
    if (translatedText) {
      return {
        ...m,
        translationInfo: {
          status: 'translated',
          translatedText,
          sourceLanguage: lang,
          provider: translationEvaluation.provider || 'gemini-4-hydrogen',
          isAIGenerated: true,
        },
      };
    }

    return {
      ...m,
      translationInfo: {
        status: 'unavailable',
        sourceLanguage: lang,
        isAIGenerated: true,
        unavailableReason:
          translationEvaluation.unavailableReason ||
          'AI translation unavailable for this message. Original message preserved.',
      },
    };
  });

  // 2. Tag and refine entities with Hybrid Provenance
  const mergedEntities: ExtractedEntity[] = [];
  const entityMap = new Map<string, ExtractedEntity>();

  // Process Base Entities (Rule + NLP)
  for (const ent of baseEntities) {
    const isRulePattern =
      ent.category === 'VehiclePlate' ||
      ent.category === 'ContactIdentifier' ||
      ent.method.includes('RegEx') ||
      ent.method.includes('Pattern');

    const sources: AnalysisSource[] = isRulePattern ? ['rule', 'nlp'] : ['nlp'];
    const key = `${ent.category}:${ent.text.toLowerCase()}:${ent.messageId}`;

    entityMap.set(key, {
      ...ent,
      sources,
      consensus: 'hybrid_consensus',
      details: ent.details,
    });
  }

  // Merge AI Extracted Entities
  for (const aiEnt of aiOutput.entities) {
    const key = `${aiEnt.category}:${aiEnt.text.toLowerCase()}:${aiEnt.messageId}`;
    const existing = entityMap.get(key);

    if (existing) {
      if (!existing.sources) existing.sources = ['nlp'];
      if (!existing.sources.includes('ai')) {
        existing.sources.push('ai');
      }
      existing.aiInterpretation = aiEnt.interpretation;
      existing.consensus = 'hybrid_consensus';
    } else {
      // AI-Only Identified Entity
      const newId = `ent-ai-${aiEnt.messageId}-${entityMap.size + 1}`;
      entityMap.set(key, {
        id: newId,
        messageId: aiEnt.messageId,
        text: aiEnt.text,
        category: aiEnt.category,
        confidence: aiEnt.confidence,
        method: 'AI Contextual Extraction',
        details: aiEnt.interpretation,
        sources: ['ai'],
        consensus: 'ai_only',
        aiInterpretation: aiEnt.interpretation,
        verificationStatus: 'unverified',
      });
    }
  }

  const finalEntities = Array.from(entityMap.values());

  // 3. Process Findings with Hybrid Provenance and Disagreement Detection
  const mergedFindings: FlaggedFinding[] = [];
  const findingMap = new Map<string, FlaggedFinding>();

  for (const f of baseFindings) {
    const isRulePattern =
      f.label === 'Keyword Match' ||
      f.category === 'Weapon' ||
      f.category === 'Threat' ||
      f.matchedTokens.length > 0;

    const sources: AnalysisSource[] = isRulePattern ? ['rule', 'nlp'] : ['nlp'];

    // Check if AI generated insight for this message
    const matchingAIInsight = aiOutput.insights.find((ins) => ins.messageId === f.messageId);

    let consensus: MethodConsensus = 'hybrid_consensus';
    let disagreementNote: string | undefined = undefined;

    if (matchingAIInsight?.disagreementWithKeyword) {
      consensus = 'method_disagreement';
      disagreementNote = matchingAIInsight.disagreementWithKeyword;
    }

    if (matchingAIInsight && !sources.includes('ai')) {
      sources.push('ai');
    }

    const key = `${f.category}:${f.messageId}`;
    findingMap.set(key, {
      ...f,
      sources,
      consensus,
      ruleRationale: isRulePattern ? f.reason : undefined,
      nlpRationale: f.contextRationale,
      aiExplanation: matchingAIInsight?.explanation,
      disagreementNote,
    });
  }

  // Add AI-only insights (e.g. indirect references or discreet needs-review cues not captured by rules)
  for (const ins of aiOutput.insights) {
    const targetMsg = messages.find((m) => m.id === ins.messageId && !m.isSystemMessage);
    if (!targetMsg) continue;

    // Never turn pure benign informational AI notes into standalone flagged findings unless flagging a keyword disagreement
    if (ins.contextualRisk === 'informational' && !ins.disagreementWithKeyword) {
      continue;
    }

    const existingFinding = Array.from(findingMap.values()).find(
      (f) => f.messageId === ins.messageId
    );

    if (!existingFinding && ins.contextualRisk !== 'informational') {
      const isNeedsReview = ins.contextualRisk === 'needs_review';
      const key = `AI:${ins.intentCategory}:${ins.messageId}`;
      findingMap.set(key, {
        id: `flag-ai-${ins.messageId}-${findingMap.size + 1}`,
        messageId: ins.messageId,
        category: isNeedsReview ? 'UnusualConcern' : 'SuspiciousContext',
        severity: ins.contextualRisk,
        label: isNeedsReview
          ? 'Unusual / Contextual Concern – Needs Review'
          : 'Contextual Indicator',
        reason: isNeedsReview
          ? `Contextual Concern: ${ins.intentCategory}`
          : `AI Identified: ${ins.intentCategory}`,
        matchedTokens: Array.isArray(ins.indirectReferences) ? ins.indirectReferences : [],
        isFalsePositiveLikely: false,
        contextRationale: ins.explanation,
        analysisMethod: 'AI Contextual Reasoning',
        confidenceScore: isNeedsReview ? 0.74 : 0.88,
        sources: ['ai'],
        consensus: 'ai_only',
        aiExplanation: ins.explanation,
        disagreementNote: ins.disagreementWithKeyword,
      });
    }
  }

  const finalFindings = Array.from(findingMap.values());

  // 4. Enrich Correlations with AI Provenance (strictly validated against active conversation)
  const msgLookup = new Map(messages.map((m) => [m.id, m]));
  const finalCorrelations: MessageCorrelation[] = baseCorrelations.map((corr) => {
    const matchingAiCorr = aiOutput.suggestedCorrelations.find(
      (ac) =>
        (ac.sourceId === corr.sourceMessageId && ac.targetId === corr.targetMessageId) ||
        (ac.sourceId === corr.targetMessageId && ac.targetId === corr.sourceMessageId)
    );

    const sources: AnalysisSource[] = matchingAiCorr ? ['nlp', 'ai'] : ['nlp'];
    return {
      ...corr,
      sources,
      aiCorrelationRationale: matchingAiCorr?.rationale,
    };
  });

  // Only append validated AI suggested correlations referencing real, non-system, non-benign messages in THIS file
  for (const ac of aiOutput.suggestedCorrelations) {
    if (ac.sourceId === ac.targetId) continue;
    const srcMsg = msgLookup.get(ac.sourceId);
    const tgtMsg = msgLookup.get(ac.targetId);
    if (!srcMsg || !tgtMsg || srcMsg.isSystemMessage || tgtMsg.isSystemMessage) continue;

    // Never link benign-only mitigated messages into investigative correlations
    const srcBenignOnly =
      srcMsg.flaggedFindings.length > 0 &&
      srcMsg.flaggedFindings.every((f) => f.isFalsePositiveLikely);
    const tgtBenignOnly =
      tgtMsg.flaggedFindings.length > 0 &&
      tgtMsg.flaggedFindings.every((f) => f.isFalsePositiveLikely);
    if (srcBenignOnly || tgtBenignOnly) continue;

    const exists = finalCorrelations.some(
      (c) =>
        (c.sourceMessageId === ac.sourceId && c.targetMessageId === ac.targetId) ||
        (c.sourceMessageId === ac.targetId && c.targetMessageId === ac.sourceId)
    );

    if (!exists) {
      const t1 = new Date(srcMsg.timestamp).getTime();
      const t2 = new Date(tgtMsg.timestamp).getTime();
      const deltaMin =
        !isNaN(t1) && !isNaN(t2) ? Math.abs(Math.round((t2 - t1) / (1000 * 60))) : 0;

      finalCorrelations.push({
        id: `corr-ai-${ac.sourceId}-${ac.targetId}`,
        sourceMessageId: ac.sourceId,
        targetMessageId: ac.targetId,
        correlationType: 'semantic_topic',
        sharedEntities: [],
        sharedTopics: [ac.relationshipType],
        explanation: ac.rationale,
        confidence: 'medium',
        timeDeltaMinutes: deltaMin,
        status: 'suggested',
        sources: ['ai'],
        aiCorrelationRationale: ac.rationale,
      });
    }
  }

  // Sync merged hybrid findings back onto message records for consistent view lookups
  const findingsByMsgId = new Map<number, FlaggedFinding[]>();
  for (const f of finalFindings) {
    const arr = findingsByMsgId.get(f.messageId) || [];
    arr.push(f);
    findingsByMsgId.set(f.messageId, arr);
  }
  const syncedMessages: MessageRecord[] = enrichedMessages.map((m) => ({
    ...m,
    flaggedFindings: findingsByMsgId.get(m.id) || m.flaggedFindings,
  }));

  // 5. Build Evidence-Grounded Possible Events from validated finalCorrelations and enrich strictly from cluster AI insights
  const recomputedEvents = buildEventClusters(syncedMessages, finalCorrelations);
  const finalEvents: EventCluster[] = recomputedEvents.map((ev) => {
    const clusterMsgSet = new Set(ev.messageIds);
    const clusterInsights = aiOutput.insights.filter(
      (ins) => clusterMsgSet.has(ins.messageId) && ins.contextualRisk !== 'informational'
    );

    const uniqueIntents = Array.from(new Set(clusterInsights.map((i) => i.intentCategory)));
    const aiEventSynthesis =
      uniqueIntents.length > 0
        ? `Contextual synthesis across ${clusterInsights.length} correlated message(s) in this cluster: ${uniqueIntents.slice(0, 3).join('; ')}.`
        : undefined;

    return {
      ...ev,
      sources: uniqueIntents.length > 0 ? ['nlp', 'ai'] : ['nlp'],
      aiEventSynthesis,
    };
  });

  // 6. Compute Hybrid Statistics
  let ruleCount = 0;
  let nlpCount = 0;
  let aiCount = 0;
  let consensusCount = 0;
  let disagreementCount = 0;

  for (const ent of finalEntities) {
    if (ent.sources?.includes('rule')) ruleCount++;
    if (ent.sources?.includes('nlp')) nlpCount++;
    if (ent.sources?.includes('ai')) aiCount++;
  }

  for (const f of finalFindings) {
    if (f.sources?.includes('rule')) ruleCount++;
    if (f.sources?.includes('nlp')) nlpCount++;
    if (f.sources?.includes('ai')) aiCount++;
    if (f.consensus === 'hybrid_consensus') consensusCount++;
    if (f.consensus === 'method_disagreement') disagreementCount++;
  }

  return {
    messages: syncedMessages,
    entities: finalEntities,
    findings: finalFindings,
    correlations: finalCorrelations,
    events: finalEvents,
    hybridStats: {
      ruleCount,
      nlpCount,
      aiCount,
      consensusCount,
      disagreementCount,
      isAIEngineActive: true,
      aiProvider: aiEvaluation.isLiveServerAI
        ? aiEvaluation.model || 'gemini-4-hydrogen'
        : 'local-contextual-engine',
    },
  };
}
