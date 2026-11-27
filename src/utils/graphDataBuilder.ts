/**
 * ForenText Relationship Graph Data Builder
 * Generates structured, evidence-backed node-link network models combining
 * Participants, Entities, and Events with Force-Directed, Hierarchical, and Focused layouts.
 * Every edge carries explicit provenance (Rule / NLP / AI) and supporting original messages.
 */

import {
  ForensicCase,
  ExtractedEntity,
  AnalysisSource,
  MessageRecord,
} from '../types/forensics';

export type GraphNodeType =
  | 'participant'
  | 'location'
  | 'vehicle'
  | 'object'
  | 'document'
  | 'person'
  | 'event'
  | 'identifier';

export type GraphLayoutMode = 'force' | 'hierarchical';

export interface GraphSupportingMessage {
  messageId: number;
  rawLineIndex: number;
  sender: string;
  timestamp: string;
  text: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  categoryLabel?: string;
  messageCount: number;
  messageIds: number[];
  details?: string;
  sources?: AnalysisSource[];
  x: number;
  y: number;
  radius: number;
  color: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  label?: string;
  type: string;
  relationshipTypeLabel: string;
  reason: string;
  sources: AnalysisSource[];
  supportingMessages: GraphSupportingMessage[];
  isIndirectContextOnly?: boolean;
  color?: string;
}

export interface NetworkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CombinedGraphOptions {
  layoutMode?: GraphLayoutMode;
  entityCategoryFilter?: string;
  includeNodeTypes?: {
    participant: boolean;
    entity: boolean;
    event: boolean;
  };
  relationshipFilter?: 'ALL' | 'correlation' | 'entity_mention' | 'event';
  width?: number;
  height?: number;
}

// Restrained, high-legibility light-mode forensic palette
export const NODE_TYPE_META: Record<
  GraphNodeType,
  { color: string; fill: string; border: string; label: string; shape: 'circle' | 'rect' | 'diamond' | 'hexagon' }
> = {
  participant: {
    color: '#6D28D9',
    fill: '#EDE9FE',
    border: '#6D28D9',
    label: 'Participant',
    shape: 'circle',
  },
  event: {
    color: '#B45309',
    fill: '#FEF3C7',
    border: '#B45309',
    label: 'Event Cluster',
    shape: 'hexagon',
  },
  location: {
    color: '#0F766E',
    fill: '#CCFBF1',
    border: '#0F766E',
    label: 'Location',
    shape: 'diamond',
  },
  vehicle: {
    color: '#9A3412',
    fill: '#FFEDD5',
    border: '#C2410C',
    label: 'Vehicle / Plate',
    shape: 'rect',
  },
  object: {
    color: '#1D4ED8',
    fill: '#DBEAFE',
    border: '#2563EB',
    label: 'Object / Weapon',
    shape: 'rect',
  },
  document: {
    color: '#4338CA',
    fill: '#E0E7FF',
    border: '#4338CA',
    label: 'Document',
    shape: 'rect',
  },
  person: {
    color: '#9D174D',
    fill: '#FCE7F3',
    border: '#BE185D',
    label: 'Named Person',
    shape: 'diamond',
  },
  identifier: {
    color: '#475569',
    fill: '#F1F5F9',
    border: '#475569',
    label: 'Identifier',
    shape: 'diamond',
  },
};

function toSupportingMessage(msg: MessageRecord): GraphSupportingMessage {
  return {
    messageId: msg.id,
    rawLineIndex: msg.rawLineIndex,
    sender: msg.sender,
    timestamp: msg.timestamp,
    text: msg.text,
  };
}

function dedupeMessages(msgs: MessageRecord[]): GraphSupportingMessage[] {
  const seen = new Set<number>();
  const out: GraphSupportingMessage[] = [];
  msgs
    .slice()
    .sort((a, b) => a.id - b.id)
    .forEach((m) => {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        out.push(toSupportingMessage(m));
      }
    });
  return out;
}

function mapEntityCategoryToNodeType(category: ExtractedEntity['category']): GraphNodeType {
  switch (category) {
    case 'Location':
      return 'location';
    case 'Vehicle':
    case 'VehiclePlate':
      return 'vehicle';
    case 'Document':
      return 'document';
    case 'Person':
      return 'person';
    case 'ContactIdentifier':
      return 'identifier';
    default:
      return 'object';
  }
}

/**
 * Deterministic radial positioning (used for Focused view & initial seed)
 */
function applyRadialLayout(
  nodes: GraphNode[],
  width: number,
  height: number,
  centerNodeId?: string
) {
  const cx = width / 2;
  const cy = height / 2;

  if (centerNodeId) {
    const centerNode = nodes.find((n) => n.id === centerNodeId);
    if (centerNode) {
      centerNode.x = cx;
      centerNode.y = cy;
    }
  }

  const peripheralNodes = nodes.filter((n) => n.id !== centerNodeId);
  const total = peripheralNodes.length;
  if (total === 0) return;

  const baseRadius = Math.min(width, height) * 0.36;

  peripheralNodes.forEach((node, idx) => {
    const angle = (2 * Math.PI * idx) / total - Math.PI / 2;
    const tierRadius =
      total > 12 ? (idx % 2 === 0 ? baseRadius * 0.68 : baseRadius * 1.02) : baseRadius;
    node.x = cx + tierRadius * Math.cos(angle);
    node.y = cy + tierRadius * Math.sin(angle);
  });
}

/**
 * Deterministic Force-Directed layout (Fruchterman-Reingold style)
 */
function applyForceDirectedLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
) {
  const n = nodes.length;
  if (n === 0) return;
  if (n === 1) {
    nodes[0].x = width / 2;
    nodes[0].y = height / 2;
    return;
  }

  // Deterministic initial placement grouped softly by node type
  const sorted = [...nodes].sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
  const cx = width / 2;
  const cy = height / 2;
  sorted.forEach((node, idx) => {
    const angle = (2 * Math.PI * idx) / n - Math.PI / 2;
    const initR =
      node.type === 'participant'
        ? Math.min(width, height) * 0.18
        : node.type === 'event'
        ? Math.min(width, height) * 0.28
        : Math.min(width, height) * 0.38;
    node.x = cx + initR * Math.cos(angle);
    node.y = cy + initR * Math.sin(angle);
  });

  const nodeById = new Map(nodes.map((nd) => [nd.id, nd]));
  const area = width * height;
  const k = Math.sqrt(area / Math.max(n, 2)) * 0.85;
  const padX = 76;
  const padY = 56;
  const iterations = 150;

  for (let iter = 0; iter < iterations; iter++) {
    const disp = new Map<string, { dx: number; dy: number }>();
    nodes.forEach((nd) => disp.set(nd.id, { dx: 0, dy: 0 }));

    // Repulsive forces between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const u = nodes[i];
        const v = nodes[j];
        let dx = u.x - v.x;
        let dy = u.y - v.y;
        let dist = Math.hypot(dx, dy);
        if (dist < 0.01) {
          dx = 0.5;
          dy = 0.5;
          dist = 0.7;
        }
        const minDesired = u.radius + v.radius + 54;
        const repulse = (k * k) / dist + (dist < minDesired ? (minDesired - dist) * 1.4 : 0);
        const fx = (dx / dist) * repulse;
        const fy = (dy / dist) * repulse;

        disp.get(u.id)!.dx += fx;
        disp.get(u.id)!.dy += fy;
        disp.get(v.id)!.dx -= fx;
        disp.get(v.id)!.dy -= fy;
      }
    }

    // Attractive forces along edges
    edges.forEach((edge) => {
      const u = nodeById.get(edge.source);
      const v = nodeById.get(edge.target);
      if (!u || !v) return;
      const dx = u.x - v.x;
      const dy = u.y - v.y;
      const dist = Math.max(Math.hypot(dx, dy), 0.01);
      const attract = (dist * dist) / (k * 1.15);
      const fx = (dx / dist) * attract;
      const fy = (dy / dist) * attract;

      disp.get(u.id)!.dx -= fx;
      disp.get(u.id)!.dy -= fy;
      disp.get(v.id)!.dx += fx;
      disp.get(v.id)!.dy += fy;
    });

    // Gentle centering gravity to keep isolated nodes within frame
    nodes.forEach((u) => {
      const d = disp.get(u.id)!;
      d.dx += (cx - u.x) * 0.05;
      d.dy += (cy - u.y) * 0.05;
    });

    const temp = Math.max(2, (1 - iter / iterations) * 32);
    nodes.forEach((u) => {
      const d = disp.get(u.id)!;
      const mag = Math.max(Math.hypot(d.dx, d.dy), 0.01);
      const step = Math.min(mag, temp);
      u.x = Math.min(width - padX, Math.max(padX, u.x + (d.dx / mag) * step));
      u.y = Math.min(height - padY, Math.max(padY, u.y + (d.dy / mag) * step));
    });
  }
}

/**
 * Deterministic 3-Tier Hierarchical Layout:
 * Top: Events | Middle: Participants | Bottom: Entities (auto-wrapped into subrows if dense)
 */
function applyHierarchicalLayout(nodes: GraphNode[], width: number, height: number) {
  const events = nodes.filter((n) => n.type === 'event');
  const participants = nodes.filter((n) => n.type === 'participant');
  const entities = nodes.filter((n) => n.type !== 'event' && n.type !== 'participant');

  const placeRow = (rowNodes: GraphNode[], yPos: number) => {
    if (rowNodes.length === 0) return;
    const padX = 76;
    const usableW = width - padX * 2;
    rowNodes.forEach((node, idx) => {
      node.x =
        rowNodes.length === 1
          ? width / 2
          : padX + (usableW * idx) / (rowNodes.length - 1);
      node.y = yPos;
    });
  };

  placeRow(events, height * 0.16);
  placeRow(participants, height * 0.45);

  if (entities.length <= 8) {
    placeRow(entities, height * 0.78);
  } else {
    const mid = Math.ceil(entities.length / 2);
    placeRow(entities.slice(0, mid), height * 0.71);
    placeRow(entities.slice(mid), height * 0.87);
  }
}

/**
 * Combined Forensic Relationship Graph (Participants + Entities + Events)
 * Strictly backed by parsed messages, extracted entities, correlations, and event clusters.
 */
export function buildCombinedOverviewGraph(
  forensicCase: ForensicCase,
  options: CombinedGraphOptions = {}
): NetworkGraph {
  const {
    layoutMode = 'force',
    entityCategoryFilter = 'ALL',
    includeNodeTypes = { participant: true, entity: true, event: true },
    relationshipFilter = 'ALL',
    width = 960,
    height = 580,
  } = options;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const messageById = new Map(forensicCase.messages.map((m) => [m.id, m]));

  // 1. Participant Nodes
  const participantNodes = new Map<string, GraphNode>();
  if (includeNodeTypes.participant) {
    const senders = forensicCase.metadata.senders.filter((s) => s !== 'System Event');
    const maxSenderMsgs = Math.max(
      1,
      ...senders.map((s) => forensicCase.messages.filter((m) => m.sender === s).length)
    );

    senders.forEach((sender) => {
      const msgs = forensicCase.messages.filter((m) => m.sender === sender);
      const pNode: GraphNode = {
        id: `part:${sender}`,
        label: sender,
        type: 'participant',
        categoryLabel: 'Participant',
        messageCount: msgs.length,
        messageIds: msgs.map((m) => m.id),
        details: `${msgs.length} message(s) authored in this conversation`,
        sources: ['rule'],
        x: 0,
        y: 0,
        radius: 20 + Math.round((msgs.length / maxSenderMsgs) * 8),
        color: NODE_TYPE_META.participant.color,
      };
      nodes.push(pNode);
      participantNodes.set(sender, pNode);
    });
  }

  // 2. Entity Nodes (canonicalized by category + lowercase text)
  const entityNodes = new Map<string, GraphNode>();
  const entitySendersMap = new Map<string, Map<string, { msgs: MessageRecord[]; sources: Set<AnalysisSource> }>>();

  if (includeNodeTypes.entity) {
    const entityAgg = new Map<
      string,
      {
        rep: ExtractedEntity;
        messageIds: Set<number>;
        senders: Set<string>;
        sources: Set<AnalysisSource>;
      }
    >();

    forensicCase.entities.forEach((ent) => {
      if (entityCategoryFilter === 'ALL') {
        // Keep DateTime out of default overview clutter unless specifically chosen
        if (ent.category === 'DateTime') return;
      } else if (entityCategoryFilter === 'Vehicle') {
        if (ent.category !== 'Vehicle' && ent.category !== 'VehiclePlate') return;
      } else if (entityCategoryFilter === 'Object') {
        if (ent.category !== 'Object' && ent.category !== 'Weapon') return;
      } else if (ent.category !== entityCategoryFilter) {
        return;
      }

      const key = `${ent.category}:${ent.text.toLowerCase()}`;
      const msg = messageById.get(ent.messageId);
      const sender = msg && !msg.isSystemMessage ? msg.sender : null;

      if (!entityAgg.has(key)) {
        entityAgg.set(key, {
          rep: ent,
          messageIds: new Set([ent.messageId]),
          senders: new Set(sender ? [sender] : []),
          sources: new Set(ent.sources || ['nlp']),
        });
      } else {
        const entry = entityAgg.get(key)!;
        entry.messageIds.add(ent.messageId);
        if (sender) entry.senders.add(sender);
        (ent.sources || ['nlp']).forEach((s) => entry.sources.add(s));
      }

      if (sender && msg) {
        if (!entitySendersMap.has(key)) entitySendersMap.set(key, new Map());
        const sMap = entitySendersMap.get(key)!;
        if (!sMap.has(sender)) {
          sMap.set(sender, { msgs: [msg], sources: new Set(ent.sources || ['nlp']) });
        } else {
          const sEntry = sMap.get(sender)!;
          sEntry.msgs.push(msg);
          (ent.sources || ['nlp']).forEach((s) => sEntry.sources.add(s));
        }
      }
    });

    const topEntities = Array.from(entityAgg.entries())
      .sort((a, b) => {
        const scoreA = a[1].senders.size * 3 + a[1].messageIds.size;
        const scoreB = b[1].senders.size * 3 + b[1].messageIds.size;
        return scoreB - scoreA;
      })
      .slice(0, 20);

    topEntities.forEach(([key, agg]) => {
      const nodeType = mapEntityCategoryToNodeType(agg.rep.category);
      const meta = NODE_TYPE_META[nodeType];
      const entNode: GraphNode = {
        id: `ent:${key}`,
        label: agg.rep.text,
        type: nodeType,
        categoryLabel: agg.rep.category,
        messageCount: agg.messageIds.size,
        messageIds: Array.from(agg.messageIds).sort((a, b) => a - b),
        details: `${agg.rep.category} · Extracted via ${agg.rep.method}${agg.rep.details ? ` — ${agg.rep.details}` : ''}`,
        sources: Array.from(agg.sources),
        x: 0,
        y: 0,
        radius: 15 + Math.min(agg.messageIds.size * 2, 8),
        color: meta.color,
      };
      nodes.push(entNode);
      entityNodes.set(key, entNode);
    });
  }

  // 3. Event Nodes
  const eventNodes = new Map<string, GraphNode>();
  if (includeNodeTypes.event) {
    forensicCase.events.forEach((ev) => {
      const evNode: GraphNode = {
        id: `event:${ev.id}`,
        label: ev.title.length > 26 ? `${ev.title.substring(0, 24)}…` : ev.title,
        type: 'event',
        categoryLabel: `Event Cluster (${ev.status})`,
        messageCount: ev.messageIds.length,
        messageIds: ev.messageIds,
        details: ev.summary,
        sources: ev.sources || ['nlp', 'ai'],
        x: 0,
        y: 0,
        radius: 23,
        color: NODE_TYPE_META.event.color,
      };
      nodes.push(evNode);
      eventNodes.set(ev.id, evNode);
    });
  }

  // 4. Edges — Strictly Evidence-Backed
  // A. Participant <-> Participant ONLY from forensicCase.correlations (cross-participant)
  if (
    includeNodeTypes.participant &&
    (relationshipFilter === 'ALL' || relationshipFilter === 'correlation')
  ) {
    const pairAgg = new Map<
      string,
      {
        s1: string;
        s2: string;
        types: Set<string>;
        sources: Set<AnalysisSource>;
        explanations: string[];
        msgs: MessageRecord[];
        count: number;
      }
    >();

    forensicCase.correlations.forEach((corr) => {
      const m1 = messageById.get(corr.sourceMessageId);
      const m2 = messageById.get(corr.targetMessageId);
      if (!m1 || !m2 || m1.isSystemMessage || m2.isSystemMessage) return;
      if (m1.sender === m2.sender) return;

      const sortedPair = [m1.sender, m2.sender].sort();
      const pairKey = `${sortedPair[0]}:::${sortedPair[1]}`;

      if (!pairAgg.has(pairKey)) {
        pairAgg.set(pairKey, {
          s1: sortedPair[0],
          s2: sortedPair[1],
          types: new Set([corr.correlationType]),
          sources: new Set(corr.sources || ['nlp']),
          explanations: [corr.explanation],
          msgs: [m1, m2],
          count: 1,
        });
      } else {
        const item = pairAgg.get(pairKey)!;
        item.types.add(corr.correlationType);
        (corr.sources || ['nlp']).forEach((s) => item.sources.add(s));
        if (item.explanations.length < 3 && !item.explanations.includes(corr.explanation)) {
          item.explanations.push(corr.explanation);
        }
        item.msgs.push(m1, m2);
        item.count += 1;
      }
    });

    pairAgg.forEach((agg, pairKey) => {
      const n1 = participantNodes.get(agg.s1);
      const n2 = participantNodes.get(agg.s2);
      if (!n1 || !n2) return;

      const hasAI = agg.sources.has('ai');
      const hasSharedEntity = agg.types.has('shared_entity');
      const typeLabel = hasSharedEntity
        ? hasAI
          ? 'Shared Entity & AI Correlation'
          : 'Shared Entity Correlation'
        : hasAI
        ? 'AI Contextual & Topic Correlation'
        : 'Topic / Contextual Correlation';

      edges.push({
        id: `edge-corr-${pairKey}`,
        source: n1.id,
        target: n2.id,
        weight: agg.count,
        label: `${agg.count} link${agg.count > 1 ? 's' : ''}`,
        type: hasSharedEntity ? 'shared_entity' : 'semantic_topic',
        relationshipTypeLabel: typeLabel,
        reason: `${agg.explanations.join(' ')} (Derived from cross-participant message correlations — indicates shared context, not direct 1-to-1 reply verification.)`,
        sources: Array.from(agg.sources),
        supportingMessages: dedupeMessages(agg.msgs),
        isIndirectContextOnly: true,
        color: '#6D28D9',
      });
    });
  }

  // B. Participant <-> Entity (direct entity mention in authored message)
  if (
    includeNodeTypes.participant &&
    includeNodeTypes.entity &&
    (relationshipFilter === 'ALL' || relationshipFilter === 'entity_mention')
  ) {
    entityNodes.forEach((entNode, key) => {
      const sMap = entitySendersMap.get(key);
      if (!sMap) return;

      sMap.forEach((data, sender) => {
        const pNode = participantNodes.get(sender);
        if (!pNode) return;
        const uniqueMsgs = dedupeMessages(data.msgs);
        edges.push({
          id: `edge-mention-${pNode.id}-${entNode.id}`,
          source: pNode.id,
          target: entNode.id,
          weight: uniqueMsgs.length,
          label: `${uniqueMsgs.length} mention${uniqueMsgs.length > 1 ? 's' : ''}`,
          type: 'entity_mention',
          relationshipTypeLabel: 'Entity Mention',
          reason: `${sender} referenced "${entNode.label}" (${entNode.categoryLabel}) in ${uniqueMsgs.length} message(s).`,
          sources: Array.from(data.sources),
          supportingMessages: uniqueMsgs,
          isIndirectContextOnly: false,
          color: '#64748B',
        });
      });
    });
  }

  // C. Event <-> Participant and Event <-> Entity
  if (
    includeNodeTypes.event &&
    (relationshipFilter === 'ALL' || relationshipFilter === 'event')
  ) {
    forensicCase.events.forEach((ev) => {
      const evNode = eventNodes.get(ev.id);
      if (!evNode) return;

      // Event <-> Participant
      if (includeNodeTypes.participant) {
        ev.participants.forEach((sender) => {
          const pNode = participantNodes.get(sender);
          if (!pNode) return;
          const evMsgs = ev.messageIds
            .map((id) => messageById.get(id))
            .filter((m): m is MessageRecord => !!m && m.sender === sender);

          edges.push({
            id: `edge-ev-part-${ev.id}-${sender}`,
            source: evNode.id,
            target: pNode.id,
            weight: Math.max(1, evMsgs.length),
            label: `${evMsgs.length} msg${evMsgs.length !== 1 ? 's' : ''}`,
            type: 'event_participation',
            relationshipTypeLabel: 'Event Participation',
            reason: `${sender} authored ${evMsgs.length} message(s) grouped inside "${ev.title}".`,
            sources: ev.sources || ['nlp', 'ai'],
            supportingMessages: dedupeMessages(evMsgs),
            isIndirectContextOnly: false,
            color: '#B45309',
          });
        });
      }

      // Event <-> Entity
      if (includeNodeTypes.entity) {
        const evMsgSet = new Set(ev.messageIds);
        entityNodes.forEach((entNode) => {
          const sharedMsgIds = entNode.messageIds.filter((id) => evMsgSet.has(id));
          if (sharedMsgIds.length === 0) return;
          const sharedMsgs = sharedMsgIds
            .map((id) => messageById.get(id))
            .filter((m): m is MessageRecord => !!m);

          edges.push({
            id: `edge-ev-ent-${ev.id}-${entNode.id}`,
            source: evNode.id,
            target: entNode.id,
            weight: sharedMsgIds.length,
            label: 'in event',
            type: 'event_entity',
            relationshipTypeLabel: 'Event Entity Association',
            reason: `"${entNode.label}" appears within ${sharedMsgIds.length} message(s) belonging to "${ev.title}".`,
            sources: Array.from(
              new Set([...(ev.sources || ['nlp']), ...(entNode.sources || ['nlp'])])
            ),
            supportingMessages: dedupeMessages(sharedMsgs),
            isIndirectContextOnly: false,
            color: '#0F766E',
          });
        });
      }
    });
  }

  // Apply chosen layout algorithm
  if (layoutMode === 'hierarchical') {
    applyHierarchicalLayout(nodes, width, height);
  } else {
    applyForceDirectedLayout(nodes, edges, width, height);
  }

  return { nodes, edges };
}

/**
 * Focused Graph centered on a single selected node (shows 1-hop neighbors + inter-neighbor edges)
 */
export function buildFocusedNodeGraph(
  overallGraph: NetworkGraph,
  centerNodeId: string,
  width = 960,
  height = 580
): NetworkGraph {
  const center = overallGraph.nodes.find((n) => n.id === centerNodeId);
  if (!center) return overallGraph;

  const connectedNodeIds = new Set<string>([centerNodeId]);
  overallGraph.edges.forEach((edge) => {
    if (edge.source === centerNodeId) connectedNodeIds.add(edge.target);
    if (edge.target === centerNodeId) connectedNodeIds.add(edge.source);
  });

  const subNodes: GraphNode[] = overallGraph.nodes
    .filter((n) => connectedNodeIds.has(n.id))
    .map((n) => ({ ...n }))
    .sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));

  const subEdges: GraphEdge[] = overallGraph.edges.filter(
    (e) => connectedNodeIds.has(e.source) && connectedNodeIds.has(e.target)
  );

  applyRadialLayout(subNodes, width, height, centerNodeId);
  return { nodes: subNodes, edges: subEdges };
}

/**
 * Legacy helper exports retained cleanly for compatibility
 */
export function buildParticipantGraph(
  forensicCase: ForensicCase,
  width = 700,
  height = 500
): NetworkGraph {
  return buildCombinedOverviewGraph(forensicCase, {
    includeNodeTypes: { participant: true, entity: false, event: false },
    width,
    height,
  });
}

export function buildEntityRelationshipGraph(
  forensicCase: ForensicCase,
  selectedCategoryFilter?: string,
  width = 800,
  height = 550
): NetworkGraph {
  return buildCombinedOverviewGraph(forensicCase, {
    entityCategoryFilter: selectedCategoryFilter || 'ALL',
    includeNodeTypes: { participant: true, entity: true, event: false },
    width,
    height,
  });
}

export function buildEventRelationshipGraph(
  forensicCase: ForensicCase,
  width = 800,
  height = 550
): NetworkGraph {
  return buildCombinedOverviewGraph(forensicCase, {
    includeNodeTypes: { participant: true, entity: true, event: true },
    relationshipFilter: 'event',
    width,
    height,
  });
}
