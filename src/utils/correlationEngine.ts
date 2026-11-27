/**
 * ForenText Evidence-Grounded Correlation & Possible Event Clustering Engine
 *
 * Strictly isolates each conversation and links messages ONLY when concrete contextual
 * evidence exists (shared specific entities, explicit anaphoric references, or
 * corroborated multi-term coordination). Never hardcodes demo locations or scenarios,
 * and never merges messages solely on single generic words or temporal proximity.
 */

import {
  MessageRecord,
  MessageCorrelation,
  EventCluster,
  EventStage,
  ExtractedEntity,
} from '../types/forensics';

const STOP_WORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'were', 'what', 'when', 'where',
  'will', 'your', 'there', 'about', 'would', 'could', 'should', 'which',
  'please', 'after', 'before', 'their', 'other', 'some', 'than', 'into',
  'they', 'them', 'been', 'being', 'here', 'just', 'like', 'also', 'very',
  'more', 'much', 'then', 'only', 'over', 'such', 'know', 'said', 'told',
  'mein', 'hain', 'nahi', 'raha', 'rahi', 'kuch', 'bhi', 'liye', 'waha',
  'yaha', 'karo', 'kya', 'kaise', 'kaun', 'aaya', 'gaya', 'tha', 'thi',
]);

// Single generic nouns that must NOT by themselves trigger cross-message correlation or event clustering
const GENERIC_NON_SPECIFIC_TERMS = new Set([
  'station',
  'bag',
  'vehicle',
  'car',
  'bike',
  'package',
  'parcel',
  'meeting',
  'office',
  'building',
  'place',
  'area',
  'road',
  'street',
  'person',
  'man',
  'woman',
  'number',
  'call',
  'message',
  'today',
  'tomorrow',
  'morning',
  'evening',
  'night',
]);

const GENERIC_NORMALIZED_GROUPS = new Set([
  'location:station',
  'location:building',
  'location:warehouse',
  'location:office',
  'object:bag',
  'object:package',
  'object:parcel',
  'vehicle:car',
  'vehicle:vehicle',
]);

// Explicit anaphoric / back-reference expressions connecting to an immediately prior observation
const ANAPHORIC_REFERENCE_REGEX =
  /\b(?:still\s+parked\s+there|parked\s+there|still\s+there|same\s+(?:car|vehicle|bike|van|bag|parcel|man|person|number)|that\s+(?:car|vehicle|bike|van|bag|backpack|package|parcel|man|person|building)|the\s+vehicle\s+is\s+still|picked\s+it\s+up|left\s+it\s+there|dropped\s+it\s+there|wahi\s+(?:gaadi|car|aadmi|bag|jagah)|woh\s+(?:aadmi|gaadi|bag)\s+(?:abhi\s+bhi|wahan|still))\b/i;

/**
 * Calculates temporal distance in minutes between two timestamp strings.
 */
function getDeltaMinutes(t1: string, t2: string): number {
  const d1 = new Date(t1).getTime();
  const d2 = new Date(t2).getTime();
  if (isNaN(d1) || isNaN(d2)) return 0;
  return Math.abs(Math.round((d2 - d1) / (1000 * 60)));
}

/**
 * Extracts normalized non-stopword, non-generic tokens from message text.
 */
function getSpecificTokens(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w) && !GENERIC_NON_SPECIFIC_TERMS.has(w));
  return new Set(words);
}

/**
 * Checks whether an extracted entity is concrete/specific enough to anchor a correlation
 * (i.e., not a bare generic word like "bag", "station", "car", "package", or pure benign DateTime).
 */
function isSpecificCorrelatableEntity(ent: ExtractedEntity): boolean {
  if (ent.category === 'DateTime') return false;
  const lower = ent.text.trim().toLowerCase();
  if (!lower || lower.length < 2) return false;

  if (ent.category === 'VehiclePlate' || ent.category === 'ContactIdentifier') {
    return true;
  }

  if (GENERIC_NON_SPECIFIC_TERMS.has(lower)) {
    return false;
  }

  // Strip leading determiners ("the swift" -> "swift") for specificity check
  const bare = lower.replace(/^(?:the|a|an|that|this)\s+/, '');
  if (GENERIC_NON_SPECIFIC_TERMS.has(bare)) {
    return false;
  }

  return true;
}

/**
 * Checks whether a normalizedGroup is specific enough to link two entity mentions.
 */
function isSpecificNormalizedGroup(group: string | undefined): group is string {
  if (!group) return false;
  const lower = group.toLowerCase();
  if (GENERIC_NORMALIZED_GROUPS.has(lower)) return false;
  const parts = lower.split(':');
  const val = (parts[1] || '').replace(/_/g, ' ').trim();
  if (!val || GENERIC_NON_SPECIFIC_TERMS.has(val)) return false;
  return true;
}

/**
 * Checks if two entities refer to the same underlying referent
 * (exact match, shared specific normalized group, or specific multi-word location containment e.g. "Powerpet" <-> "Powerpet railway station").
 */
function entitiesMatchSpecifically(a: ExtractedEntity, b: ExtractedEntity): string | null {
  if (!isSpecificCorrelatableEntity(a) || !isSpecificCorrelatableEntity(b)) {
    return null;
  }

  const textA = a.text.trim().toLowerCase();
  const textB = b.text.trim().toLowerCase();

  // Never equate two DIFFERENT locations (e.g. "Delhi" vs "Mumbai", or "Sector 62" vs "Sector 18")
  if (a.category === 'Location' && b.category === 'Location') {
    if (textA === textB) return a.text;
    // Allow containment ONLY when a specific proper locality/station name shares >=5 char core token (e.g. "Powerpet" inside "Powerpet railway station")
    const wordsA = textA.split(/\s+/).filter((w) => w.length >= 5 && !GENERIC_NON_SPECIFIC_TERMS.has(w) && w !== 'railway' && w !== 'metro');
    const wordsB = textB.split(/\s+/).filter((w) => w.length >= 5 && !GENERIC_NON_SPECIFIC_TERMS.has(w) && w !== 'railway' && w !== 'metro');
    const sharedProper = wordsA.find((w) => wordsB.includes(w));
    if (sharedProper) {
      return a.text.length >= b.text.length ? b.text : a.text;
    }
    return null;
  }

  if (textA === textB) return a.text;

  if (
    isSpecificNormalizedGroup(a.normalizedGroup) &&
    a.normalizedGroup === b.normalizedGroup
  ) {
    return a.text.length >= b.text.length ? a.text : b.text;
  }

  // Specific vehicle model core match (e.g., "white Swift" and "the Swift" share specific model "swift")
  if (
    (a.category === 'Vehicle' || a.category === 'VehiclePlate') &&
    (b.category === 'Vehicle' || b.category === 'VehiclePlate')
  ) {
    const cleanA = textA.replace(/^(?:the|a|an|that)\s+/, '');
    const cleanB = textB.replace(/^(?:the|a|an|that)\s+/, '');
    if (cleanA === cleanB) return a.text;
    if (
      a.normalizedGroup?.startsWith('vehicle:') &&
      b.normalizedGroup?.startsWith('vehicle:')
    ) {
      const modelA = a.normalizedGroup.split(':')[1]?.split('_')[0];
      const modelB = b.normalizedGroup.split(':')[1]?.split('_')[0];
      if (modelA && modelA === modelB && !GENERIC_NON_SPECIFIC_TERMS.has(modelA)) {
        return a.text.length >= b.text.length ? a.text : b.text;
      }
    }
  }

  return null;
}

/**
 * Checks whether a message has solely benign/mitigated findings (no investigative concern).
 */
function isOnlyBenignFalsePositiveMessage(msg: MessageRecord): boolean {
  if (msg.flaggedFindings.length === 0) return false;
  return msg.flaggedFindings.every((f) => f.isFalsePositiveLikely);
}

/**
 * Checks whether a message explicitly states a single route connecting two locations within the SAME message.
 */
function getExplicitRouteLocations(msg: MessageRecord): string[] {
  const locs = msg.entities.filter((e) => e.category === 'Location').map((e) => e.text.toLowerCase());
  if (locs.length < 2) return [];
  const hasTransitLink = /\b(?:from|to|via|heading\s+to|departed\s+from|moving\s+to|reach|transfer\s+to)\b/i.test(
    msg.text
  );
  return hasTransitLink ? locs : [];
}

/**
 * Core Message Correlation Engine
 * Strictly evaluates messages within the active conversation using concrete contextual evidence.
 */
export function buildMessageCorrelations(messages: MessageRecord[]): MessageCorrelation[] {
  const correlations: MessageCorrelation[] = [];
  const validMessages = messages.filter(
    (m) => !m.isSystemMessage && m.text.trim().length > 0 && !isOnlyBenignFalsePositiveMessage(m)
  );

  for (let i = 0; i < validMessages.length; i++) {
    const msgA = validMessages[i];
    const tokensA = getSpecificTokens(msgA.text);
    const routeLocsA = getExplicitRouteLocations(msgA);

    const maxLookahead = Math.min(validMessages.length, i + 25);
    for (let j = i + 1; j < maxLookahead; j++) {
      const msgB = validMessages[j];
      const deltaMinutes = getDeltaMinutes(msgA.timestamp, msgB.timestamp);

      // 1. Shared Specific Entity Match (excludes bare generic terms like "station", "bag", "car")
      const matchedLabels: string[] = [];
      for (const entA of msgA.entities) {
        for (const entB of msgB.entities) {
          const matched = entitiesMatchSpecifically(entA, entB);
          if (matched && !matchedLabels.some((l) => l.toLowerCase() === matched.toLowerCase())) {
            matchedLabels.push(matched);
          }
        }
      }

      if (matchedLabels.length > 0) {
        const isDifferentSender = msgA.sender !== msgB.sender;
        correlations.push({
          id: `corr-ent-${msgA.id}-${msgB.id}`,
          sourceMessageId: msgA.id,
          targetMessageId: msgB.id,
          correlationType: 'shared_entity',
          sharedEntities: matchedLabels,
          sharedTopics: ['entity_reference'],
          explanation: isDifferentSender
            ? `Cross-participant reference: Both ${msgA.sender} and ${msgB.sender} reference "${matchedLabels[0]}" within ${deltaMinutes} min.`
            : `Repeated reference to "${matchedLabels[0]}" by ${msgA.sender} over ${deltaMinutes} min.`,
          confidence: isDifferentSender ? 'high' : 'medium',
          timeDeltaMinutes: deltaMinutes,
          status: 'suggested',
        });
        continue;
      }

      // 2. Explicit Anaphoric / Deictic Continuation
      // e.g., Msg A identifies a concrete vehicle/object/landmark ("white Swift near Powerpet")
      // and Msg B shortly after replies using "the vehicle is still parked there" / "that bag"
      const hasAnaphoraB = ANAPHORIC_REFERENCE_REGEX.test(msgB.text);
      if (hasAnaphoraB && deltaMinutes <= 30) {
        const anchorEntitiesA = msgA.entities.filter(isSpecificCorrelatableEntity);
        const sharesReferentType =
          (/(?:car|vehicle|parked|swift|bike|van|suv|gaadi)/i.test(msgB.text) &&
            anchorEntitiesA.some(
              (e) =>
                e.category === 'Vehicle' ||
                e.category === 'VehiclePlate' ||
                (e.category === 'Location' && /station|building|warehouse|road/i.test(e.text))
            )) ||
          (/(?:bag|backpack|package|parcel|box)/i.test(msgB.text) &&
            anchorEntitiesA.some((e) => e.category === 'Object' || e.category === 'Document')) ||
          (/(?:aadmi|person|man|number|call)/i.test(msgB.text) &&
            anchorEntitiesA.some((e) => e.category === 'Person' || e.category === 'ContactIdentifier'));

        if (sharesReferentType && anchorEntitiesA.length > 0) {
          const anchorLabel = anchorEntitiesA[0].text;
          correlations.push({
            id: `corr-anaph-${msgA.id}-${msgB.id}`,
            sourceMessageId: msgA.id,
            targetMessageId: msgB.id,
            correlationType: 'cross_participant_reference',
            sharedEntities: [anchorLabel],
            sharedTopics: ['anaphoric_reference'],
            explanation: `Sequential contextual reference (${deltaMinutes} min): ${msgB.sender} appears to refer back to "${anchorLabel}" mentioned by ${msgA.sender}.`,
            confidence: 'medium',
            timeDeltaMinutes: deltaMinutes,
            status: 'suggested',
          });
          continue;
        }
      }

      // 3. Explicit Same-Thread Activity / Route Coordination
      // Only link distinct locations when one message explicitly states transit/route connecting them (e.g. "from X to Y")
      if (routeLocsA.length >= 2 && deltaMinutes <= 60) {
        const locsB = msgB.entities.filter((e) => e.category === 'Location').map((e) => e.text.toLowerCase());
        const overlapLoc = locsB.find((l) => routeLocsA.includes(l));
        if (overlapLoc) {
          correlations.push({
            id: `corr-route-${msgA.id}-${msgB.id}`,
            sourceMessageId: msgA.id,
            targetMessageId: msgB.id,
            correlationType: 'semantic_topic',
            sharedEntities: [overlapLoc],
            sharedTopics: ['route_coordination'],
            explanation: `Explicit transit route linkage involving "${overlapLoc}" across messages by ${msgA.sender} and ${msgB.sender}.`,
            confidence: 'medium',
            timeDeltaMinutes: deltaMinutes,
            status: 'suggested',
          });
          continue;
        }
      }

      // 4. Tight Cross-Participant Coordination Sharing Specific Domain Vocabulary (>= 3 non-generic tokens OR >= 2 + shared active finding)
      const tokensB = getSpecificTokens(msgB.text);
      const commonTokens = Array.from(tokensA).filter((t) => tokensB.has(t));
      const bothHaveNonMitigatedFindings =
        msgA.flaggedFindings.some((f) => !f.isFalsePositiveLikely && f.severity !== 'informational') &&
        msgB.flaggedFindings.some((f) => !f.isFalsePositiveLikely && f.severity !== 'informational');

      if (
        msgA.sender !== msgB.sender &&
        deltaMinutes <= 45 &&
        (commonTokens.length >= 3 || (commonTokens.length >= 2 && bothHaveNonMitigatedFindings))
      ) {
        correlations.push({
          id: `corr-topic-${msgA.id}-${msgB.id}`,
          sourceMessageId: msgA.id,
          targetMessageId: msgB.id,
          correlationType: 'cross_participant_reference',
          sharedEntities: [],
          sharedTopics: commonTokens.slice(0, 4),
          explanation: `Coordinated exchange (${deltaMinutes} min) between ${msgA.sender} and ${msgB.sender} sharing specific terms: ${commonTokens.slice(0, 4).join(', ')}.`,
          confidence: bothHaveNonMitigatedFindings ? 'medium' : 'contextual',
          timeDeltaMinutes: deltaMinutes,
          status: 'suggested',
        });
      }
    }
  }

  return correlations;
}

/**
 * Derive an objective stage label strictly from the message's actual findings & entities.
 */
function deriveStageTitle(msg: MessageRecord, idx: number, total: number): string {
  const categories = new Set(msg.flaggedFindings.map((f) => f.category));
  if (categories.has('Weapon') || categories.has('Threat') || categories.has('MultiFactor')) {
    return idx === 0 ? 'Initial Escalation / Threat Signal' : 'Escalated Threat / Weapon Indicator';
  }
  if (categories.has('MeetingLocation')) return 'Rendezvous Location Coordination';
  if (categories.has('DocumentExchange')) return 'Document Custody / Exchange Reference';
  if (categories.has('ObjectPlacement')) return 'Object Placement Observation';
  if (categories.has('VehicleReference')) return 'Vehicle Movement / Spotting';
  if (categories.has('LogisticsArrival')) return 'Transit & Arrival Timing';
  if (categories.has('SuspiciousContext')) return 'Concealment / Anti-Forensics Indicator';
  if (categories.has('UnusualConcern')) return 'Contextual Concern (Needs Review)';
  if (idx === 0) return 'Initial Correlated Reference';
  if (idx === total - 1) return 'Subsequent Follow-Up Reference';
  return `Stage ${idx + 1}: Correlated Update`;
}

/**
 * Derive a purely evidence-grounded Possible Event title without any hardcoded defaults.
 */
function buildGroundedEventTitle(
  clusterMsgs: MessageRecord[],
  locations: string[],
  vehicles: string[],
  objects: string[],
  documents: string[],
  sharedTopics: string[]
): string {
  const hasHighRisk = clusterMsgs.some((m) =>
    m.flaggedFindings.some((f) => f.severity === 'critical' && !f.isFalsePositiveLikely)
  );
  const hasTamper = clusterMsgs.some((m) =>
    m.flaggedFindings.some((f) => f.category === 'SuspiciousContext')
  );

  if (hasHighRisk && (vehicles.length > 0 || locations.length > 0)) {
    const anchor = locations[0] || vehicles[0];
    return `Possible Event: Escalated Activity & Logistics (${anchor})`;
  }
  if (documents.length > 0 && hasTamper) {
    return `Possible Event: ${documents[0]} Custody & Record Concealment`;
  }
  if (documents.length > 0) {
    return `Possible Event: ${documents[0]} Exchange Coordination`;
  }
  if (locations.length > 0 && vehicles.length > 0) {
    return `Possible Event: ${locations[0]} & ${vehicles[0]} Coordination`;
  }
  if (locations.length > 0 && objects.length > 0) {
    return `Possible Event: ${locations[0]} & ${objects[0]} Activity`;
  }
  if (locations.length > 0) {
    return `Possible Event: ${locations.slice(0, 2).join(' & ')} Coordination`;
  }
  if (vehicles.length > 0) {
    return `Possible Event: ${vehicles[0]} Activity Sequence`;
  }
  if (objects.length > 0) {
    return `Possible Event: ${objects[0]} Handling Sequence`;
  }
  if (sharedTopics.length > 0) {
    return `Possible Event: Coordinated "${sharedTopics[0]}" Discussion`;
  }
  const senders = Array.from(new Set(clusterMsgs.map((m) => m.sender))).slice(0, 2);
  return `Possible Event: Multi-Message Sequence (${senders.join(' & ')})`;
}

/**
 * Evidence-Grounded Possible Event Clustering Engine
 * Builds clusters strictly from connected components of verified correlations in the active chat.
 * Never links standalone/unrelated generic words or isolated Needs Review messages into forced events.
 */
export function buildEventClusters(
  messages: MessageRecord[],
  correlations: MessageCorrelation[]
): EventCluster[] {
  const validMessages = messages.filter((m) => !m.isSystemMessage);
  if (validMessages.length < 2 || correlations.length === 0) return [];

  const msgById = new Map(validMessages.map((m) => [m.id, m]));

  // Only include active correlations whose messages exist and are not purely benign false positives
  const qualifyingCorrs = correlations.filter((c) => {
    if (c.status === 'rejected') return false;
    const mA = msgById.get(c.sourceMessageId);
    const mB = msgById.get(c.targetMessageId);
    if (!mA || !mB) return false;
    if (isOnlyBenignFalsePositiveMessage(mA) || isOnlyBenignFalsePositiveMessage(mB)) {
      return false;
    }
    return (
      c.correlationType === 'shared_entity' ||
      c.correlationType === 'cross_participant_reference' ||
      c.correlationType === 'semantic_topic'
    );
  });

  if (qualifyingCorrs.length === 0) return [];

  // Build adjacency list over qualifying correlated message IDs
  const adj = new Map<number, Set<number>>();
  const corrsInEdge = new Map<string, MessageCorrelation[]>();

  for (const corr of qualifyingCorrs) {
    if (!adj.has(corr.sourceMessageId)) adj.set(corr.sourceMessageId, new Set());
    if (!adj.has(corr.targetMessageId)) adj.set(corr.targetMessageId, new Set());
    adj.get(corr.sourceMessageId)!.add(corr.targetMessageId);
    adj.get(corr.targetMessageId)!.add(corr.sourceMessageId);

    const k = [corr.sourceMessageId, corr.targetMessageId].sort((a, b) => a - b).join(':');
    const existing = corrsInEdge.get(k) || [];
    existing.push(corr);
    corrsInEdge.set(k, existing);
  }

  // Extract connected components via BFS
  const visited = new Set<number>();
  const components: { msgIds: number[]; sharedEntities: string[]; sharedTopics: string[]; corrs: MessageCorrelation[] }[] = [];

  for (const startId of Array.from(adj.keys()).sort((a, b) => a - b)) {
    if (visited.has(startId)) continue;
    const queue = [startId];
    visited.add(startId);
    const compIds: number[] = [];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      compIds.push(curr);
      const neighbors = adj.get(curr) || new Set();
      for (const nxt of neighbors) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          queue.push(nxt);
        }
      }
    }

    compIds.sort((a, b) => a - b);
    if (compIds.length < 2) continue;

    const compSet = new Set(compIds);
    const compCorrs = qualifyingCorrs.filter(
      (c) => compSet.has(c.sourceMessageId) && compSet.has(c.targetMessageId)
    );
    const sharedEntities = Array.from(new Set(compCorrs.flatMap((c) => c.sharedEntities)));
    const sharedTopics = Array.from(
      new Set(
        compCorrs
          .flatMap((c) => c.sharedTopics)
          .filter((t) => t !== 'entity_reference' && t !== 'anaphoric_reference' && t !== 'route_coordination')
      )
    );

    components.push({ msgIds: compIds, sharedEntities, sharedTopics, corrs: compCorrs });
  }

  const clusters: EventCluster[] = [];

  for (const comp of components) {
    const clusterMsgs = comp.msgIds
      .map((id) => msgById.get(id))
      .filter((m): m is MessageRecord => Boolean(m));

    if (clusterMsgs.length < 2) continue;

    // Require genuine investigative signal inside the cluster:
    // At least one non-mitigated finding OR >=2 specific shared entities across >=2 messages
    const activeFindings = clusterMsgs.flatMap((m) =>
      m.flaggedFindings.filter((f) => !f.isFalsePositiveLikely && f.severity !== 'informational')
    );
    const hasCoordinatedEvidence =
      activeFindings.length >= 1 || comp.sharedEntities.length >= 2;
    if (!hasCoordinatedEvidence) continue;

    // Never turn a purely single-sender isolated Needs Review chime into an event unless corroborated across messages
    const isSingleIsolatedNeedsReview =
      clusterMsgs.every((m) =>
        m.flaggedFindings.every((f) => f.severity === 'needs_review')
      ) && comp.sharedEntities.length === 0;
    if (isSingleIsolatedNeedsReview) continue;

    // Extract metadata STRICTLY from entities & senders present within clusterMsgs
    const participants = Array.from(new Set(clusterMsgs.map((m) => m.sender)));
    const locations = Array.from(
      new Set(
        clusterMsgs.flatMap((m) =>
          m.entities.filter((e) => e.category === 'Location').map((e) => e.text)
        )
      )
    );
    const vehicles = Array.from(
      new Set(
        clusterMsgs.flatMap((m) =>
          m.entities
            .filter((e) => e.category === 'Vehicle' || e.category === 'VehiclePlate')
            .map((e) => e.text)
        )
      )
    );
    const objects = Array.from(
      new Set(
        clusterMsgs.flatMap((m) =>
          m.entities
            .filter((e) => e.category === 'Object' || e.category === 'Weapon')
            .map((e) => e.text)
        )
      )
    );
    const documents = Array.from(
      new Set(
        clusterMsgs.flatMap((m) =>
          m.entities.filter((e) => e.category === 'Document').map((e) => e.text)
        )
      )
    );

    const evidenceParts: string[] = [];
    if (comp.sharedEntities.length > 0) {
      evidenceParts.push(`shared references (${comp.sharedEntities.slice(0, 4).join(', ')})`);
    }
    if (locations.length > 0) evidenceParts.push(`location(s): ${locations.join(', ')}`);
    if (vehicles.length > 0) evidenceParts.push(`vehicle(s): ${vehicles.join(', ')}`);
    if (documents.length > 0) evidenceParts.push(`document(s): ${documents.join(', ')}`);
    if (objects.length > 0) evidenceParts.push(`item(s): ${objects.join(', ')}`);

    const summaryDetail =
      evidenceParts.length > 0
        ? `referencing ${evidenceParts.join('; ')}`
        : `sharing correlated conversational context`;

    const stages: EventStage[] = clusterMsgs.map((m, idx) => ({
      stageNumber: idx + 1,
      title: deriveStageTitle(m, idx, clusterMsgs.length),
      messageId: m.id,
      description: m.text,
      timestamp: m.timestamp,
      sender: m.sender,
    }));

    const hasStrongLink = comp.corrs.some((c) => c.confidence === 'high');
    const title = buildGroundedEventTitle(
      clusterMsgs,
      locations,
      vehicles,
      objects,
      documents,
      comp.sharedTopics
    );

    clusters.push({
      id: `possible-event-${clusters.length + 1}`,
      title,
      summary: `Suggested event hypothesis grouping ${clusterMsgs.length} correlated message(s) among ${participants.join(', ')}, ${summaryDetail}. Requires investigator verification.`,
      timeRange: {
        start: clusterMsgs[0].timestamp,
        end: clusterMsgs[clusterMsgs.length - 1].timestamp,
      },
      messageIds: clusterMsgs.map((m) => m.id),
      participants,
      locations,
      vehicles,
      objects,
      documents,
      stages,
      status: 'suggested',
      confidence: hasStrongLink ? 'high' : 'medium',
      investigatorNotes:
        'Preliminary possible event cluster derived strictly from shared entities and correlated messages within this file.',
    });
  }

  return clusters;
}
