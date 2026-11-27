import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Share2,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowLeft,
  Target,
  Activity,
  Network,
  GitFork,
  ExternalLink,
  AlertCircle,
  Maximize2,
  Crosshair,
} from 'lucide-react';
import { ForensicCase } from '../types/forensics';
import {
  buildCombinedOverviewGraph,
  buildFocusedNodeGraph,
  GraphNode,
  GraphEdge,
  GraphLayoutMode,
  NODE_TYPE_META,
  NetworkGraph,
} from '../utils/graphDataBuilder';
import { MethodBadge } from './MethodBadge';

interface RelationshipGraphsViewProps {
  forensicCase: ForensicCase;
  onOpenMessage: (id: number) => void;
}

type ViewScope = 'overall' | 'focused' | 'activity';

export const RelationshipGraphsView: React.FC<RelationshipGraphsViewProps> = ({
  forensicCase,
  onOpenMessage,
}) => {
  const [viewScope, setViewScope] = useState<ViewScope>('overall');
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('force');
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);

  // Filters
  const [includeTypes, setIncludeTypes] = useState({
    participant: true,
    entity: true,
    event: true,
  });
  const [entityCategory, setEntityCategory] = useState<string>('ALL');
  const [relationshipFilter, setRelationshipFilter] = useState<
    'ALL' | 'correlation' | 'entity_mention' | 'event'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Selection & Inspection
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Interactive Pan / Zoom / Node Drag state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragOverrides, setDragOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const dragRef = useRef<
    | { kind: 'pan'; startX: number; startY: number; origPanX: number; origPanY: number }
    | { kind: 'node'; nodeId: string; startSvgX: number; startSvgY: number; origX: number; origY: number; moved: boolean }
    | null
  >(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const svgWidth = 960;
  const svgHeight = 580;

  // 1. Base combined graph
  const overallGraph: NetworkGraph = useMemo(() => {
    return buildCombinedOverviewGraph(forensicCase, {
      layoutMode,
      entityCategoryFilter: entityCategory,
      includeNodeTypes: includeTypes,
      relationshipFilter,
      width: svgWidth,
      height: svgHeight,
    });
  }, [forensicCase, layoutMode, entityCategory, includeTypes, relationshipFilter]);

  // 2. Active displayed graph (Overall vs Focused)
  const activeGraph: NetworkGraph = useMemo(() => {
    const base =
      viewScope === 'focused' && focusNodeId
        ? buildFocusedNodeGraph(overallGraph, focusNodeId, svgWidth, svgHeight)
        : overallGraph;

    return {
      nodes: base.nodes.map((n) => {
        const override = dragOverrides[n.id];
        return override ? { ...n, x: override.x, y: override.y } : n;
      }),
      edges: base.edges,
    };
  }, [overallGraph, viewScope, focusNodeId, dragOverrides]);

  const nodeMap = useMemo(
    () => new Map(activeGraph.nodes.map((n) => [n.id, n])),
    [activeGraph.nodes]
  );

  // Matching search highlight IDs
  const searchMatchIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return new Set(
      activeGraph.nodes
        .filter(
          (n) =>
            n.label.toLowerCase().includes(q) ||
            (n.categoryLabel || '').toLowerCase().includes(q)
        )
        .map((n) => n.id)
    );
  }, [activeGraph.nodes, searchQuery]);

  const selectedNode: GraphNode | null = selectedNodeId
    ? nodeMap.get(selectedNodeId) || null
    : null;
  const selectedEdge: GraphEdge | null = selectedEdgeId
    ? activeGraph.edges.find((e) => e.id === selectedEdgeId) || null
    : null;

  // Connected edges & neighbors for selected node
  const selectedNodeEdges = useMemo(() => {
    if (!selectedNode) return [];
    return activeGraph.edges.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );
  }, [selectedNode, activeGraph.edges]);

  // Diurnal Activity Data (Activity Rhythm tab)
  const activityData = useMemo(() => {
    const hourCounts = new Array(24).fill(0);
    const dateCounts: Record<string, number> = {};
    forensicCase.messages.forEach((m) => {
      if (m.isSystemMessage) return;
      hourCounts[m.hour] = (hourCounts[m.hour] || 0) + 1;
      dateCounts[m.dateStr] = (dateCounts[m.dateStr] || 0) + 1;
    });
    const maxHour = Math.max(...hourCounts, 1);
    return { hourCounts, dateCounts, maxHour };
  }, [forensicCase.messages]);

  const MIN_ZOOM = 0.35;
  const MAX_ZOOM = 4.0;

  // Convert client coordinates accurately under SVG preserveAspectRatio="xMidYMid meet"
  const getViewBoxMetrics = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return { scale: 1, offsetX: 0, offsetY: 0, rectLeft: 0, rectTop: 0 };
    const rect = svg.getBoundingClientRect();
    const scale = Math.min(rect.width / svgWidth, rect.height / svgHeight) || 1;
    const offsetX = (rect.width - svgWidth * scale) / 2;
    const offsetY = (rect.height - svgHeight * scale) / 2;
    return { scale, offsetX, offsetY, rectLeft: rect.left, rectTop: rect.top };
  }, [svgWidth, svgHeight]);

  const clientToViewBox = useCallback(
    (clientX: number, clientY: number) => {
      const m = getViewBoxMetrics();
      return {
        x: (clientX - m.rectLeft - m.offsetX) / m.scale,
        y: (clientY - m.rectTop - m.offsetY) / m.scale,
      };
    },
    [getViewBoxMetrics]
  );

  // Convert mouse client coordinates to graph coordinates
  const clientToSvg = useCallback(
    (clientX: number, clientY: number) => {
      const vb = clientToViewBox(clientX, clientY);
      return {
        x: (vb.x - pan.x) / zoom,
        y: (vb.y - pan.y) / zoom,
      };
    },
    [clientToViewBox, pan.x, pan.y, zoom]
  );

  // Keep graph reachable inside the navigable viewport so nodes/edges cannot get lost off-screen
  const clampPanToGraph = useCallback(
    (candidatePan: { x: number; y: number }, targetZoom: number, nodes: GraphNode[]) => {
      if (nodes.length === 0) return candidatePan;
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      nodes.forEach((n) => {
        const pad = n.radius + 24;
        if (n.x - pad < minX) minX = n.x - pad;
        if (n.x + pad > maxX) maxX = n.x + pad;
        if (n.y - pad < minY) minY = n.y - pad;
        if (n.y + pad > maxY) maxY = n.y + pad;
      });

      const marginX = 90;
      const marginY = 70;
      const minPanX = marginX - maxX * targetZoom;
      const maxPanX = svgWidth - marginX - minX * targetZoom;
      const minPanY = marginY - maxY * targetZoom;
      const maxPanY = svgHeight - marginY - minY * targetZoom;

      return {
        x: Math.min(Math.max(candidatePan.x, minPanX), maxPanX),
        y: Math.min(Math.max(candidatePan.y, minPanY), maxPanY),
      };
    },
    [svgWidth, svgHeight]
  );

  // Anchor zoom around any point (vx, vy) in SVG viewBox coordinates
  const applyZoomAtViewBoxPoint = useCallback(
    (
      nextZoomRaw: number,
      anchorVb: { x: number; y: number },
      currentZoom: number,
      currentPan: { x: number; y: number },
      nodes: GraphNode[]
    ) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(nextZoomRaw.toFixed(3))));
      if (nextZoom === currentZoom) return { zoom: currentZoom, pan: currentPan };

      const gx = (anchorVb.x - currentPan.x) / currentZoom;
      const gy = (anchorVb.y - currentPan.y) / currentZoom;
      const rawPan = {
        x: anchorVb.x - gx * nextZoom,
        y: anchorVb.y - gy * nextZoom,
      };
      return {
        zoom: nextZoom,
        pan: clampPanToGraph(rawPan, nextZoom, nodes),
      };
    },
    [clampPanToGraph]
  );

  const zoomByFactor = useCallback(
    (factor: number, customAnchorVb?: { x: number; y: number }) => {
      const anchor = customAnchorVb
        ? customAnchorVb
        : selectedNode
        ? {
            x: pan.x + selectedNode.x * zoom,
            y: pan.y + selectedNode.y * zoom,
          }
        : { x: svgWidth / 2, y: svgHeight / 2 };

      const result = applyZoomAtViewBoxPoint(
        zoom * factor,
        anchor,
        zoom,
        pan,
        activeGraph.nodes
      );
      setZoom(result.zoom);
      setPan(result.pan);
    },
    [
      selectedNode,
      pan,
      zoom,
      svgWidth,
      svgHeight,
      applyZoomAtViewBoxPoint,
      activeGraph.nodes,
    ]
  );

  const fitGraphToScreen = useCallback(() => {
    const nodes = activeGraph.nodes;
    if (nodes.length === 0) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    nodes.forEach((n) => {
      const rPadX = n.radius + 48;
      const rPadTop = n.radius + 24;
      const rPadBottom = n.radius + 42;
      if (n.x - rPadX < minX) minX = n.x - rPadX;
      if (n.x + rPadX > maxX) maxX = n.x + rPadX;
      if (n.y - rPadTop < minY) minY = n.y - rPadTop;
      if (n.y + rPadBottom > maxY) maxY = n.y + rPadBottom;
    });

    const boxW = Math.max(maxX - minX, 120);
    const boxH = Math.max(maxY - minY, 120);
    const padding = 36;
    const scaleX = (svgWidth - padding * 2) / boxW;
    const scaleY = (svgHeight - padding * 2) / boxH;
    const targetZoom = Math.min(2.2, Math.max(MIN_ZOOM, Number(Math.min(scaleX, scaleY).toFixed(3))));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoom(targetZoom);
    setPan(
      clampPanToGraph(
        {
          x: svgWidth / 2 - centerX * targetZoom,
          y: svgHeight / 2 - centerY * targetZoom,
        },
        targetZoom,
        nodes
      )
    );
  }, [activeGraph.nodes, svgWidth, svgHeight, clampPanToGraph]);

  const centerOnNode = useCallback(
    (node: GraphNode, minTargetZoom = 1.45) => {
      const targetZoom = Math.min(MAX_ZOOM, Math.max(zoom, minTargetZoom));
      const nextPan = clampPanToGraph(
        {
          x: svgWidth / 2 - node.x * targetZoom,
          y: svgHeight / 2 - node.y * targetZoom,
        },
        targetZoom,
        activeGraph.nodes
      );
      setZoom(targetZoom);
      setPan(nextPan);
    },
    [zoom, svgWidth, svgHeight, clampPanToGraph, activeGraph.nodes]
  );

  // Keep latest state in a ref for non-passive wheel / trackpad listener
  const wheelStateRef = useRef({
    zoom,
    pan,
    nodes: activeGraph.nodes,
    clientToViewBox,
    applyZoomAtViewBoxPoint,
    clampPanToGraph,
    getViewBoxMetrics,
  });
  wheelStateRef.current = {
    zoom,
    pan,
    nodes: activeGraph.nodes,
    clientToViewBox,
    applyZoomAtViewBoxPoint,
    clampPanToGraph,
    getViewBoxMetrics,
  };

  useEffect(() => {
    if (viewScope === 'activity') return;
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = wheelStateRef.current;

      // Trackpad two-finger horizontal swipe pans; pinch (ctrlKey) or vertical scroll zooms toward pointer
      const isHorizontalPan = !e.ctrlKey && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.1;
      if (isHorizontalPan) {
        const m = s.getViewBoxMetrics();
        const nextPan = s.clampPanToGraph(
          {
            x: s.pan.x - e.deltaX / m.scale,
            y: s.pan.y - e.deltaY / m.scale,
          },
          s.zoom,
          s.nodes
        );
        setPan(nextPan);
        return;
      }

      const sensitivity = e.ctrlKey ? 0.012 : 0.0022;
      const clampedDelta = Math.max(-120, Math.min(120, e.deltaY));
      const factor = Math.exp(-clampedDelta * sensitivity);
      const anchorVb = s.clientToViewBox(e.clientX, e.clientY);
      const next = s.applyZoomAtViewBoxPoint(
        s.zoom * factor,
        anchorVb,
        s.zoom,
        s.pan,
        s.nodes
      );
      setZoom(next.zoom);
      setPan(next.pan);
    };

    svgEl.addEventListener('wheel', onNativeWheel, { passive: false });
    return () => {
      svgEl.removeEventListener('wheel', onNativeWheel);
    };
  }, [viewScope]);

  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).dataset.bg === 'true') {
      dragRef.current = {
        kind: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        origPanX: pan.x,
        origPanY: pan.y,
      };
    }
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    const pt = clientToSvg(e.clientX, e.clientY);
    dragRef.current = {
      kind: 'node',
      nodeId: node.id,
      startSvgX: pt.x,
      startSvgY: pt.y,
      origX: node.x,
      origY: node.y,
      moved: false,
    };
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;

    if (d.kind === 'pan') {
      const m = getViewBoxMetrics();
      const rawPan = {
        x: d.origPanX + (e.clientX - d.startX) / m.scale,
        y: d.origPanY + (e.clientY - d.startY) / m.scale,
      };
      setPan(clampPanToGraph(rawPan, zoom, activeGraph.nodes));
    } else if (d.kind === 'node') {
      const pt = clientToSvg(e.clientX, e.clientY);
      const dx = pt.x - d.startSvgX;
      const dy = pt.y - d.startSvgY;
      if (Math.hypot(dx, dy) > 3) {
        d.moved = true;
      }
      if (d.moved) {
        setDragOverrides((prev) => ({
          ...prev,
          [d.nodeId]: { x: d.origX + dx, y: d.origY + dy },
        }));
      }
    }
  };

  const handleSvgMouseUp = () => {
    const d = dragRef.current;
    if (d && d.kind === 'node' && !d.moved) {
      setSelectedNodeId(d.nodeId);
      setSelectedEdgeId(null);
    }
    dragRef.current = null;
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const resetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setDragOverrides({});
  };

  const handleFocusOnNode = (nodeId: string) => {
    setFocusNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setViewScope('focused');
    resetViewport();
  };

  const handleBackToOverall = () => {
    setViewScope('overall');
    setFocusNodeId(null);
    resetViewport();
  };

  const activeHighlightNodeId = hoveredNodeId || selectedNodeId;

  // Render distinct SVG node shape per category
  const renderNodeShape = (node: GraphNode, isSelected: boolean) => {
    const meta = NODE_TYPE_META[node.type] || NODE_TYPE_META.object;
    const strokeColor = isSelected ? '#18181B' : meta.border;
    const strokeW = isSelected ? 2.5 : 1.5;

    if (meta.shape === 'rect') {
      const w = node.radius * 1.9;
      const h = node.radius * 1.45;
      return (
        <rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          rx={6}
          fill={meta.fill}
          stroke={strokeColor}
          strokeWidth={strokeW}
        />
      );
    }

    if (meta.shape === 'diamond') {
      const r = node.radius * 1.15;
      return (
        <polygon
          points={`0,${-r} ${r},0 0,${r} ${-r},0`}
          fill={meta.fill}
          stroke={strokeColor}
          strokeWidth={strokeW}
        />
      );
    }

    if (meta.shape === 'hexagon') {
      const r = node.radius * 1.12;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        return `${(r * Math.cos(angle)).toFixed(1)},${(r * Math.sin(angle)).toFixed(1)}`;
      }).join(' ');
      return (
        <polygon
          points={pts}
          fill={meta.fill}
          stroke={strokeColor}
          strokeWidth={strokeW}
        />
      );
    }

    return (
      <circle
        r={node.radius}
        fill={meta.fill}
        stroke={strokeColor}
        strokeWidth={strokeW}
      />
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF9F6]">
      {/* Compact Header & Controls */}
      <div className="px-5 py-3.5 bg-white border-b border-[#E4E1EE] space-y-2.5 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Primary Scope Switcher */}
          <div className="flex items-center gap-2 flex-wrap">
            {viewScope === 'focused' && (
              <button
                onClick={handleBackToOverall}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#EDE9FE] text-[#4C1D95] border border-[#C4B5FD] hover:bg-[#DDD6FE] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Overall Graph
              </button>
            )}

            <div className="flex items-center gap-1 p-1 bg-[#F3F1F8] rounded-lg border border-[#E4E1EE]">
              <button
                onClick={() => {
                  setViewScope('overall');
                  setDragOverrides({});
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewScope === 'overall'
                    ? 'bg-white text-[#4C1D95] border border-[#DDD6FE] shadow-2xs'
                    : 'text-[#52525B] hover:text-[#18181B]'
                }`}
              >
                <Share2 className="w-3.5 h-3.5" />
                Overall Graph
              </button>
              <button
                onClick={() => {
                  const targetId =
                    focusNodeId || selectedNodeId || activeGraph.nodes[0]?.id || null;
                  if (targetId) {
                    setFocusNodeId(targetId);
                    setSelectedNodeId(targetId);
                    setViewScope('focused');
                    resetViewport();
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewScope === 'focused'
                    ? 'bg-white text-[#4C1D95] border border-[#DDD6FE] shadow-2xs'
                    : 'text-[#52525B] hover:text-[#18181B]'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                Focused Graph
              </button>
              <button
                onClick={() => setViewScope('activity')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  viewScope === 'activity'
                    ? 'bg-white text-[#4C1D95] border border-[#DDD6FE] shadow-2xs'
                    : 'text-[#52525B] hover:text-[#18181B]'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Activity Rhythm
              </button>
            </div>

            {viewScope === 'overall' && (
              <div className="flex items-center gap-1 p-1 bg-[#F3F1F8] rounded-lg border border-[#E4E1EE]">
                <button
                  onClick={() => {
                    setLayoutMode('force');
                    setDragOverrides({});
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    layoutMode === 'force'
                      ? 'bg-white text-[#18181B] border border-[#E4E1EE]'
                      : 'text-[#64748B] hover:text-[#18181B]'
                  }`}
                >
                  <Network className="w-3 h-3" />
                  Force-Directed
                </button>
                <button
                  onClick={() => {
                    setLayoutMode('hierarchical');
                    setDragOverrides({});
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    layoutMode === 'hierarchical'
                      ? 'bg-white text-[#18181B] border border-[#E4E1EE]'
                      : 'text-[#64748B] hover:text-[#18181B]'
                  }`}
                >
                  <GitFork className="w-3 h-3" />
                  Hierarchical
                </button>
              </div>
            )}
          </div>

          {/* Search Node */}
          {viewScope !== 'activity' && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                placeholder="Highlight node..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg text-xs text-[#18181B] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9] w-48"
              />
            </div>
          )}
        </div>

        {/* Filters Row */}
        {viewScope !== 'activity' && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F1EFF7] text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-[#64748B]">Nodes:</span>
              {[
                { key: 'participant' as const, label: 'Participants' },
                { key: 'entity' as const, label: 'Entities' },
                { key: 'event' as const, label: 'Events' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setIncludeTypes((prev) => ({ ...prev, [t.key]: !prev[t.key] }));
                    setDragOverrides({});
                  }}
                  className={`px-2 py-0.5 rounded border text-[11px] font-medium cursor-pointer transition-colors ${
                    includeTypes[t.key]
                      ? 'bg-[#EDE9FE] text-[#4C1D95] border-[#C4B5FD]'
                      : 'bg-[#FAF9F6] text-[#71717A] border-[#E4E1EE]'
                  }`}
                >
                  {t.label}
                </button>
              ))}

              <select
                value={entityCategory}
                onChange={(e) => {
                  setEntityCategory(e.target.value);
                  setDragOverrides({});
                }}
                className="bg-[#FAF9F6] border border-[#E4E1EE] rounded px-2 py-0.5 text-[11px] text-[#18181B]"
              >
                <option value="ALL">All Entity Types</option>
                <option value="Location">Locations</option>
                <option value="Vehicle">Vehicles & Plates</option>
                <option value="Object">Objects & Weapons</option>
                <option value="Document">Documents</option>
                <option value="Person">Named People</option>
                <option value="ContactIdentifier">Identifiers</option>
              </select>

              <select
                value={relationshipFilter}
                onChange={(e) => {
                  setRelationshipFilter(e.target.value as any);
                  setDragOverrides({});
                }}
                className="bg-[#FAF9F6] border border-[#E4E1EE] rounded px-2 py-0.5 text-[11px] text-[#18181B]"
              >
                <option value="ALL">All Relationship Types</option>
                <option value="correlation">Cross-Participant Correlations</option>
                <option value="entity_mention">Entity Mentions</option>
                <option value="event">Event Links</option>
              </select>
            </div>

            <div className="text-[11px] font-mono text-[#64748B]">
              {activeGraph.nodes.length} nodes · {activeGraph.edges.length} edges
            </div>
          </div>
        )}
      </div>

      {/* Main Content Split: Graph Canvas + Inspection Drawer */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {viewScope === 'activity' ? (
          /* Diurnal & Daily Activity Rhythm */
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FAF9F6]">
            <div className="p-6 rounded-xl bg-white border border-[#E4E1EE] space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#18181B] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#6D28D9]" />
                  Hourly Communication Rhythm
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Hourly message volume distribution across the parsed conversation log.
                </p>
              </div>

              <div className="h-52 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-[#E4E1EE]">
                {activityData.hourCounts.map((count, hour) => {
                  const heightPercent = Math.max((count / activityData.maxHour) * 100, 3);
                  const isLateNight = hour >= 22 || hour <= 4;
                  return (
                    <div
                      key={hour}
                      className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group"
                    >
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono font-semibold text-[#18181B]">
                        {count}
                      </span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className={`w-full rounded-t transition-colors ${
                          isLateNight ? 'bg-amber-500' : 'bg-[#7C3AED]'
                        }`}
                        title={`${count} messages at ${hour.toString().padStart(2, '0')}:00`}
                      />
                      <span className="text-[10px] font-mono text-[#64748B]">{hour}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-[#64748B]">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#7C3AED]" /> Standard Hours
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Off-Hours (22:00 –
                    04:00)
                  </span>
                </div>
                <span className="font-mono text-[#18181B] font-medium">
                  Peak: {activityData.maxHour} msgs/hr
                </span>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-white border border-[#E4E1EE] space-y-4">
              <h3 className="text-sm font-bold text-[#18181B]">Daily Message Volume</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(activityData.dateCounts).map(([dateStr, count]) => (
                  <div
                    key={dateStr}
                    className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] flex items-center justify-between"
                  >
                    <span className="text-xs font-mono font-medium text-[#18181B]">{dateStr}</span>
                    <span className="text-sm font-mono font-bold text-[#6D28D9]">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Interactive SVG Network Canvas */
          <div className="flex-1 relative overflow-hidden bg-[#FAF9F6] flex flex-col">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              onMouseDown={handleSvgMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
              className="w-full h-full select-none cursor-grab active:cursor-grabbing"
            >
              <defs>
                <pattern id="ivory-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <circle cx="12" cy="12" r="1" fill="#DDD8EA" />
                </pattern>
              </defs>

              {/* Clickable Background covering entire canvas and letterboxed margins */}
              <rect
                data-bg="true"
                x={-2500}
                y={-2500}
                width={6000}
                height={6000}
                fill="url(#ivory-grid)"
                onClick={() => {
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
              />

              {/* Hierarchical Tier Guides when in Hierarchical layout */}
              {viewScope === 'overall' && layoutMode === 'hierarchical' && (
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} opacity={0.55}>
                  <text x={18} y={svgHeight * 0.16} fontSize={10} fill="#64748B" fontFamily="monospace">
                    EVENTS
                  </text>
                  <text x={18} y={svgHeight * 0.45} fontSize={10} fill="#64748B" fontFamily="monospace">
                    PARTICIPANTS
                  </text>
                  <text x={18} y={svgHeight * 0.78} fontSize={10} fill="#64748B" fontFamily="monospace">
                    ENTITIES
                  </text>
                </g>
              )}

              <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                {/* Edges */}
                <g className="edges">
                  {activeGraph.edges.map((edge) => {
                    const src = nodeMap.get(edge.source);
                    const tgt = nodeMap.get(edge.target);
                    if (!src || !tgt) return null;

                    const isEdgeSelected = selectedEdgeId === edge.id;
                    const isAdjacentToActive =
                      activeHighlightNodeId &&
                      (src.id === activeHighlightNodeId || tgt.id === activeHighlightNodeId);
                    const isDimmed =
                      (activeHighlightNodeId && !isAdjacentToActive && !isEdgeSelected) ||
                      (selectedEdgeId && !isEdgeSelected);

                    const strokeColor = isEdgeSelected
                      ? '#6D28D9'
                      : isAdjacentToActive
                      ? '#4C1D95'
                      : edge.color || '#94A3B8';

                    return (
                      <g
                        key={edge.id}
                        className="cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEdgeId(edge.id);
                          setSelectedNodeId(null);
                        }}
                      >
                        {/* Invisible wide hit-target for easy clicking */}
                        <line
                          x1={src.x}
                          y1={src.y}
                          x2={tgt.x}
                          y2={tgt.y}
                          stroke="transparent"
                          strokeWidth={14}
                        />
                        <line
                          x1={src.x}
                          y1={src.y}
                          x2={tgt.x}
                          y2={tgt.y}
                          stroke={strokeColor}
                          strokeWidth={
                            isEdgeSelected
                              ? 3
                              : isAdjacentToActive
                              ? 2.2
                              : Math.min(1.2 + edge.weight * 0.35, 2.5)
                          }
                          strokeOpacity={isDimmed ? 0.14 : isEdgeSelected || isAdjacentToActive ? 0.95 : 0.45}
                          strokeDasharray={
                            edge.isIndirectContextOnly || edge.type === 'event_entity'
                              ? '5,4'
                              : undefined
                          }
                        />
                      </g>
                    );
                  })}
                </g>

                {/* Nodes */}
                <g className="nodes">
                  {activeGraph.nodes.map((node) => {
                    const isSelected = selectedNodeId === node.id || focusNodeId === node.id;
                    const isConnected =
                      activeHighlightNodeId &&
                      (activeHighlightNodeId === node.id ||
                        activeGraph.edges.some(
                          (e) =>
                            (e.source === activeHighlightNodeId && e.target === node.id) ||
                            (e.target === activeHighlightNodeId && e.source === node.id)
                        ));
                    const matchesSearch = !searchMatchIds || searchMatchIds.has(node.id);
                    const dimmed =
                      (activeHighlightNodeId && !isConnected) ||
                      (searchMatchIds && !matchesSearch);

                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onMouseDown={(e) => handleNodeMouseDown(e, node)}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        opacity={dimmed ? 0.25 : 1}
                        className="cursor-pointer"
                      >
                        {isSelected && (
                          <circle
                            r={node.radius + 7}
                            fill="none"
                            stroke="#6D28D9"
                            strokeWidth={1.8}
                            strokeDasharray="4,3"
                          />
                        )}

                        {renderNodeShape(node, isSelected)}

                        {/* Inner Count */}
                        <text
                          textAnchor="middle"
                          dy=".34em"
                          fill="#18181B"
                          fontSize={node.radius > 20 ? 11 : 9.5}
                          fontWeight="700"
                          fontFamily="monospace"
                          pointerEvents="none"
                        >
                          {node.messageCount}
                        </text>

                        {/* Crisp haloed label */}
                        <text
                          textAnchor="middle"
                          y={node.radius + 14}
                          fill={isSelected ? '#4C1D95' : '#18181B'}
                          stroke="#FAF9F6"
                          strokeWidth={3.5}
                          paintOrder="stroke"
                          fontSize={10.5}
                          fontWeight={isSelected ? '700' : '500'}
                          fontFamily="sans-serif"
                          pointerEvents="none"
                        >
                          {node.label.length > 20
                            ? `${node.label.substring(0, 18)}…`
                            : node.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>

            {/* Bottom-Left Restrained Legend */}
            <div className="absolute bottom-3 left-3 bg-white/95 border border-[#E4E1EE] rounded-lg px-3 py-2 shadow-2xs flex flex-wrap items-center gap-3 text-[11px] text-[#3F3F46] max-w-xl">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#EDE9FE] border border-[#6D28D9]" />
                Participant
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#FFEDD5] border border-[#C2410C]" />
                Vehicle / Object
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rotate-45 bg-[#CCFBF1] border border-[#0F766E]" />
                Location / Person
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#FEF3C7] border border-[#B45309]" />
                Event
              </span>
              <span className="text-[#64748B] border-l border-[#E4E1EE] pl-2.5">
                Scroll / pinch to zoom at pointer · Drag canvas to pan · Drag nodes to arrange
              </span>
            </div>

            {/* Top-Right Zoom & Navigation Controls */}
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 border border-[#E4E1EE] rounded-lg p-1 shadow-2xs">
              <button
                onClick={() => zoomByFactor(1.2)}
                className="p-1.5 rounded hover:bg-[#F3F1F8] text-[#3F3F46] cursor-pointer"
                title={selectedNode ? `Zoom In toward ${selectedNode.label}` : 'Zoom In'}
                aria-label="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-[#52525B] px-1.5 min-w-[44px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => zoomByFactor(1 / 1.2)}
                className="p-1.5 rounded hover:bg-[#F3F1F8] text-[#3F3F46] cursor-pointer"
                title={selectedNode ? `Zoom Out from ${selectedNode.label}` : 'Zoom Out'}
                aria-label="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <div className="h-4 w-px bg-[#E4E1EE] mx-0.5" />
              {selectedNode && (
                <button
                  onClick={() => centerOnNode(selectedNode)}
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#EDE9FE] text-[#4C1D95] text-[11px] font-medium cursor-pointer"
                  title={`Center view on ${selectedNode.label}`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Center Node</span>
                </button>
              )}
              <button
                onClick={fitGraphToScreen}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#F3F1F8] text-[#3F3F46] text-[11px] font-medium cursor-pointer"
                title="Fit entire graph to screen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Fit</span>
              </button>
              <button
                onClick={resetZoom}
                className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#F3F1F8] text-[#3F3F46] text-[11px] font-medium cursor-pointer"
                title="Reset zoom to 100% and center"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>
          </div>
        )}

        {/* Right Side Inspection Drawer: Node or Edge Evidence */}
        {viewScope !== 'activity' && (selectedNode || selectedEdge) && (
          <aside className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-[#E4E1EE] bg-white p-5 overflow-y-auto space-y-5 shrink-0">
            {selectedEdge ? (
              /* Relationship Evidence Inspection */
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[#E4E1EE]">
                  <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-[#EDE9FE] text-[#4C1D95] border border-[#DDD6FE]">
                    Relationship Evidence
                  </span>
                  <button
                    onClick={() => setSelectedEdgeId(null)}
                    className="text-xs text-[#64748B] hover:text-[#18181B] cursor-pointer"
                  >
                    Close ×
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-mono text-[#64748B]">
                    {nodeMap.get(selectedEdge.source)?.label} ↔{' '}
                    {nodeMap.get(selectedEdge.target)?.label}
                  </div>
                  <h3 className="text-sm font-bold text-[#18181B]">
                    {selectedEdge.relationshipTypeLabel}
                  </h3>
                  <MethodBadge sources={selectedEdge.sources} size="xs" />
                </div>

                {selectedEdge.isIndirectContextOnly && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Contextual link derived from shared entities/topics in the log. It does not independently confirm a direct private reply between participants.
                    </span>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] text-xs text-[#27272A] leading-relaxed">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
                    Why This Relationship Was Established
                  </span>
                  {selectedEdge.reason}
                </div>

                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                    Supporting Original Messages ({selectedEdge.supportingMessages.length})
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                    {selectedEdge.supportingMessages.map((sm) => (
                      <div
                        key={sm.messageId}
                        onClick={() => onOpenMessage(sm.messageId)}
                        className="p-2.5 rounded-lg bg-[#FAF9F6] hover:bg-[#F5F2FC] border border-[#E4E1EE] hover:border-[#8B5CF6] cursor-pointer transition-colors space-y-1 group"
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono">
                          <span className="font-semibold font-sans text-[#4C1D95]">
                            {sm.sender}
                          </span>
                          <span>
                            Msg #{sm.messageId} · L{sm.rawLineIndex} · {sm.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-[#18181B] font-mono leading-relaxed">
                          &quot;{sm.text}&quot;
                        </p>
                        <span className="text-[10px] text-[#6D28D9] flex items-center gap-1 font-medium">
                          Inspect Message <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : selectedNode ? (
              /* Selected Node Details */
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[#E4E1EE]">
                  <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-[#F3F1F8] text-[#4C1D95] border border-[#E4E1EE]">
                    {selectedNode.categoryLabel || selectedNode.type}
                  </span>
                  <button
                    onClick={() => setSelectedNodeId(null)}
                    className="text-xs text-[#64748B] hover:text-[#18181B] cursor-pointer"
                  >
                    Close ×
                  </button>
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-bold text-[#18181B]">{selectedNode.label}</h3>
                  {selectedNode.details && (
                    <p className="text-xs text-[#52525B] leading-relaxed">{selectedNode.details}</p>
                  )}
                  {selectedNode.sources && selectedNode.sources.length > 0 && (
                    <MethodBadge sources={selectedNode.sources} size="xs" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => centerOnNode(selectedNode)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#F3F1F8] hover:bg-[#EDE9FE] text-[#4C1D95] border border-[#DDD6FE] transition-colors cursor-pointer"
                    title="Center and zoom view onto this node"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    Center on Node
                  </button>
                  <button
                    onClick={() => handleFocusOnNode(selectedNode.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#6D28D9] hover:bg-[#5B21B6] text-white transition-colors cursor-pointer"
                  >
                    <Target className="w-3.5 h-3.5" />
                    Focus Graph on Node
                  </button>
                </div>

                {/* Connected Relationships */}
                {selectedNodeEdges.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                      Connected Relationships ({selectedNodeEdges.length})
                    </h4>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {selectedNodeEdges.map((edge) => {
                        const otherId =
                          edge.source === selectedNode.id ? edge.target : edge.source;
                        const other = nodeMap.get(otherId);
                        if (!other) return null;
                        return (
                          <div
                            key={edge.id}
                            className="p-2 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] flex items-center justify-between gap-2 text-xs"
                          >
                            <button
                              onClick={() => {
                                setSelectedNodeId(other.id);
                                if (viewScope === 'focused') setFocusNodeId(other.id);
                              }}
                              className="text-left font-medium text-[#18181B] hover:text-[#6D28D9] truncate cursor-pointer"
                            >
                              {other.label}
                              <span className="block text-[10px] text-[#64748B] font-normal">
                                {edge.relationshipTypeLabel}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedEdgeId(edge.id);
                                setSelectedNodeId(null);
                              }}
                              className="text-[10px] px-2 py-1 rounded bg-white border border-[#E4E1EE] hover:border-[#6D28D9] text-[#5B21B6] font-medium shrink-0 cursor-pointer"
                            >
                              Evidence ({edge.supportingMessages.length})
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Supporting Messages */}
                {selectedNode.messageIds.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                      Source Messages ({Math.min(selectedNode.messageIds.length, 6)} shown)
                    </h4>
                    <div className="space-y-2">
                      {selectedNode.messageIds.slice(0, 6).map((mId) => {
                        const msg = forensicCase.messages.find((m) => m.id === mId);
                        if (!msg) return null;
                        return (
                          <div
                            key={mId}
                            onClick={() => onOpenMessage(mId)}
                            className="p-2.5 rounded-lg bg-[#FAF9F6] hover:bg-[#F5F2FC] border border-[#E4E1EE] hover:border-[#8B5CF6] cursor-pointer transition-colors space-y-1"
                          >
                            <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono">
                              <span className="font-semibold font-sans text-[#4C1D95]">
                                {msg.sender}
                              </span>
                              <span>
                                Msg #{msg.id} · {msg.timestamp}
                              </span>
                            </div>
                            <p className="text-xs text-[#18181B] font-mono line-clamp-2">
                              &quot;{msg.text}&quot;
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </aside>
        )}
      </div>
    </div>
  );
};
