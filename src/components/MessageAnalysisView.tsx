import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Paperclip,
  Clock,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Fingerprint,
  CheckCircle,
  HelpCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  User,
} from 'lucide-react';
import {
  ForensicCase,
  ReviewStatus,
  FlaggedFinding,
  ExtractedEntity,
} from '../types/forensics';
import { MethodBadge } from './MethodBadge';

interface MessageAnalysisViewProps {
  forensicCase: ForensicCase;
  onOpenMessage: (id: number) => void;
  onUpdateStatus: (msgId: number, status: ReviewStatus, notes?: string) => void;
}

const PAGE_SIZE = 50;

export const MessageAnalysisView: React.FC<MessageAnalysisViewProps> = ({
  forensicCase,
  onOpenMessage,
  onUpdateStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSender, setSelectedSender] = useState<string>('all');
  const [flagFilter, setFlagFilter] = useState<
    'all' | 'flagged' | 'critical' | 'needs_review' | 'media' | 'rule' | 'nlp' | 'ai'
  >('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expandedFindingIds, setExpandedFindingIds] = useState<Record<string, boolean>>({});
  const [noteDraft, setNoteDraft] = useState<string>('');

  const { messages, metadata, findings, entities } = forensicCase;

  // Index hybrid findings & entities per messageId for fast lookup
  const findingsByMsgId = useMemo(() => {
    const map = new Map<number, FlaggedFinding[]>();
    findings.forEach((f) => {
      const list = map.get(f.messageId) || [];
      list.push(f);
      map.set(f.messageId, list);
    });
    return map;
  }, [findings]);

  const entitiesByMsgId = useMemo(() => {
    const map = new Map<number, ExtractedEntity[]>();
    entities.forEach((e) => {
      const list = map.get(e.messageId) || [];
      list.push(e);
      map.set(e.messageId, list);
    });
    return map;
  }, [entities]);

  // Filter & sort messages
  const filteredMessages = useMemo(() => {
    return messages
      .filter((msg) => {
        const msgFindings = findingsByMsgId.get(msg.id) || msg.flaggedFindings;
        const msgEntities = entitiesByMsgId.get(msg.id) || msg.entities;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesText = msg.text.toLowerCase().includes(q);
          const matchesTranslation = (msg.translationInfo?.translatedText || '')
            .toLowerCase()
            .includes(q);
          const matchesSender = msg.sender.toLowerCase().includes(q);
          const matchesEntity = msgEntities.some((e) => e.text.toLowerCase().includes(q));
          if (!matchesText && !matchesTranslation && !matchesSender && !matchesEntity) return false;
        }

        if (selectedSender !== 'all' && msg.sender !== selectedSender) return false;

        if (flagFilter === 'flagged' && msgFindings.length === 0) return false;
        if (
          flagFilter === 'critical' &&
          !msgFindings.some((f) => f.severity === 'critical' || f.severity === 'elevated')
        ) {
          return false;
        }
        if (
          flagFilter === 'needs_review' &&
          !msgFindings.some((f) => f.severity === 'needs_review')
        ) {
          return false;
        }
        if (flagFilter === 'media' && !msg.hasMediaAttachment) return false;
        if (flagFilter === 'rule' && !msgFindings.some((f) => f.sources?.includes('rule'))) {
          return false;
        }
        if (flagFilter === 'nlp' && !msgFindings.some((f) => f.sources?.includes('nlp'))) {
          return false;
        }
        if (flagFilter === 'ai' && !msgFindings.some((f) => f.sources?.includes('ai'))) {
          return false;
        }

        if (statusFilter !== 'all' && msg.investigatorStatus !== statusFilter) return false;

        return true;
      })
      .sort((a, b) => (sortOrder === 'asc' ? a.id - b.id : b.id - a.id));
  }, [
    messages,
    findingsByMsgId,
    entitiesByMsgId,
    searchQuery,
    selectedSender,
    flagFilter,
    statusFilter,
    sortOrder,
  ]);

  // Reset pagination when filters change
  const totalPages = Math.max(1, Math.ceil(filteredMessages.length / PAGE_SIZE));
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSender, flagFilter, statusFilter, sortOrder]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedMessages = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredMessages.slice(start, start + PAGE_SIZE);
  }, [filteredMessages, currentPage]);

  // Keep selected message synced to first visible item if none selected
  const activeMessage = useMemo(() => {
    if (selectedId !== null) {
      const found = filteredMessages.find((m) => m.id === selectedId);
      if (found) return found;
    }
    return paginatedMessages[0] || null;
  }, [selectedId, filteredMessages, paginatedMessages]);

  useEffect(() => {
    setNoteDraft(activeMessage?.investigatorNotes || '');
  }, [activeMessage?.id, activeMessage?.investigatorNotes]);

  const activeFindings = activeMessage
    ? findingsByMsgId.get(activeMessage.id) || activeMessage.flaggedFindings
    : [];
  const activeEntities = activeMessage
    ? entitiesByMsgId.get(activeMessage.id) || activeMessage.entities
    : [];

  const toggleFindingDetails = (findingId: string) => {
    setExpandedFindingIds((prev) => ({ ...prev, [findingId]: !prev[findingId] }));
  };

  const startIdx = filteredMessages.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(currentPage * PAGE_SIZE, filteredMessages.length);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF9F6]">
      {/* Filter and Search Toolbar */}
      <div className="px-5 py-3.5 bg-white border-b border-[#E4E1EE] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search message text, sender, or entity..."
              className="w-full bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#18181B] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9]"
            />
          </div>

          <select
            value={selectedSender}
            onChange={(e) => setSelectedSender(e.target.value)}
            className="bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:outline-none focus:border-[#6D28D9]"
          >
            <option value="all">All Senders ({metadata.senders.length})</option>
            {metadata.senders.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | ReviewStatus)}
            className="bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B] focus:outline-none focus:border-[#6D28D9]"
          >
            <option value="all">All Triage States</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="relevant">Relevant</option>
            <option value="needs_review">Needs Review</option>
            <option value="not_relevant">Benign</option>
          </select>
        </div>

        {/* Category / Method Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[#F3F1F8] rounded-lg border border-[#E4E1EE] flex-wrap">
          {[
            { id: 'all', label: `All (${messages.length})` },
            { id: 'flagged', label: `Flagged (${findings.length})` },
            { id: 'rule', label: 'Rule' },
            { id: 'nlp', label: 'NLP' },
            { id: 'ai', label: 'AI' },
            { id: 'critical', label: 'High Priority' },
            {
              id: 'needs_review',
              label: `Needs Review (${findings.filter((f) => f.severity === 'needs_review').length})`,
            },
            { id: 'media', label: 'Media' },
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFlagFilter(btn.id as typeof flagFilter)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                flagFilter === btn.id
                  ? btn.id === 'needs_review'
                    ? 'bg-orange-50 text-orange-800 border border-orange-300 shadow-2xs'
                    : 'bg-white text-[#4C1D95] border border-[#DDD6FE] shadow-2xs'
                  : btn.id === 'needs_review'
                  ? 'text-orange-700 hover:bg-orange-50/70'
                  : 'text-[#52525B] hover:text-[#18181B]'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#FAF9F6] text-[#3F3F46] border border-[#E4E1EE] hover:bg-[#F3F1F8] transition-colors cursor-pointer"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-[#64748B]" />
          <span>{sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}</span>
        </button>
      </div>

      {/* Two-Panel Body: Left Paginated List + Right Inspector Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Message List + Pagination */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {paginatedMessages.length === 0 ? (
              <div className="p-12 text-center text-[#64748B] bg-white rounded-xl border border-[#E4E1EE]">
                <p className="text-sm font-medium text-[#3F3F46]">
                  No messages matched your current filters.
                </p>
                <p className="text-xs mt-1">
                  Try clearing your search query or selecting All Senders.
                </p>
              </div>
            ) : (
              paginatedMessages.map((msg) => {
                const msgFindings = findingsByMsgId.get(msg.id) || msg.flaggedFindings;
                const msgEntities = entitiesByMsgId.get(msg.id) || msg.entities;
                const hasCritical = msgFindings.some((f) => f.severity === 'critical');
                const hasElevated = msgFindings.some((f) => f.severity === 'elevated');
                const hasNeedsReview = msgFindings.some((f) => f.severity === 'needs_review');
                const isSelected = activeMessage?.id === msg.id;

                return (
                  <div
                    key={msg.id}
                    onClick={() => setSelectedId(msg.id)}
                    className={`relative p-3 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F5F2FC] border-[#8B5CF6]'
                        : 'bg-white border-[#E4E1EE] hover:border-[#C4B5FD] hover:bg-[#FAF8FD]'
                    }`}
                  >
                    {/* Subtle left accent bar for flagged items */}
                    {msgFindings.length > 0 && (
                      <span
                        className={`absolute left-0 top-2 bottom-2 w-1 rounded-r ${
                          hasCritical
                            ? 'bg-rose-500'
                            : hasElevated
                            ? 'bg-amber-500'
                            : hasNeedsReview
                            ? 'bg-orange-500'
                            : 'bg-[#7C3AED]'
                        }`}
                      />
                    )}

                    {/* Compact Top Row */}
                    <div className="flex items-center justify-between gap-2 text-xs pl-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] text-[#64748B] shrink-0">
                          #{msg.id} · L{msg.rawLineIndex}
                        </span>
                        <span
                          className={`font-semibold truncate ${
                            msg.isSystemMessage ? 'text-[#64748B] italic' : 'text-[#18181B]'
                          }`}
                        >
                          {msg.sender}
                        </span>
                        {msg.hasMediaAttachment && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                            <Paperclip className="w-2.5 h-2.5" />
                            {msg.mediaDescription}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] text-[#64748B] tabular-nums">
                          {msg.timestamp}
                        </span>
                        {msg.investigatorStatus === 'relevant' && (
                          <span className="text-[10px] font-medium text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            Relevant
                          </span>
                        )}
                        {msg.investigatorStatus === 'needs_review' && (
                          <span className="text-[10px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Review
                          </span>
                        )}
                        {msg.investigatorStatus === 'not_relevant' && (
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Benign
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenMessage(msg.id);
                          }}
                          className="lg:hidden px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F3F1F8] text-[#5B21B6] border border-[#DDD6FE] hover:bg-[#EDE9FE] cursor-pointer"
                          title="Inspect message details"
                        >
                          Inspect
                        </button>
                      </div>
                    </div>

                    {/* Message Preview */}
                    <p className="text-xs text-[#27272A] mt-1.5 pl-1.5 line-clamp-2 leading-relaxed">
                      {msg.text}
                    </p>
                    {msg.translationInfo && msg.translationInfo.status === 'translated' && msg.translationInfo.translatedText && (
                      <p className="text-[11px] text-[#4C1D95] mt-1 pl-1.5 line-clamp-2 leading-relaxed">
                        <span className="font-semibold">English Translation (AI): </span>
                        {msg.translationInfo.translatedText}
                      </p>
                    )}

                    {/* Compact Inline Findings & Entity Chips */}
                    {(msgFindings.length > 0 || msgEntities.length > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-1.5">
                        {msgFindings.slice(0, 2).map((f) => (
                          <span
                            key={f.id}
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${
                              f.severity === 'critical'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : f.severity === 'elevated'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : f.severity === 'needs_review'
                                ? 'bg-orange-50 text-orange-800 border-orange-300'
                                : 'bg-violet-50 text-violet-800 border-violet-200'
                            }`}
                          >
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {f.category}
                          </span>
                        ))}

                        {msgEntities.slice(0, 3).map((e) => (
                          <span
                            key={e.id}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#F3F1F8] text-[#4C1D95] border border-[#E4E1EE]"
                          >
                            {e.category}: {e.text}
                          </span>
                        ))}

                        {msgEntities.length > 3 && (
                          <span className="text-[10px] text-[#64748B] font-mono">
                            +{msgEntities.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination Footer */}
          <div className="px-4 py-2.5 bg-white border-t border-[#E4E1EE] flex items-center justify-between text-xs text-[#52525B] shrink-0">
            <span className="font-mono text-[11px]">
              Showing {startIdx}–{endIdx} of {filteredMessages.length} messages
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#E4E1EE] bg-[#FAF9F6] hover:bg-[#F3F1F8] disabled:opacity-40 text-xs font-medium cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Prev
              </button>
              <span className="px-2 font-mono text-[11px] text-[#18181B]">
                Page {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#E4E1EE] bg-[#FAF9F6] hover:bg-[#F3F1F8] disabled:opacity-40 text-xs font-medium cursor-pointer"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel: Selected Message Inspector */}
        <aside className="hidden lg:flex lg:w-[400px] xl:w-[430px] border-l border-[#E4E1EE] bg-white flex-col overflow-hidden shrink-0">
          {activeMessage ? (
            <>
              <div className="px-4 py-3 border-b border-[#E4E1EE] bg-[#FAF9F6] flex items-center justify-between shrink-0">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold font-mono text-[#18181B]">
                      Message #{activeMessage.id}
                    </span>
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#F3F1F8] text-[#4B4860] border border-[#E4E1EE]">
                      Line {activeMessage.rawLineIndex}
                    </span>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#4C1D95] border border-[#DDD6FE]"
                      title={activeMessage.languageInfo.reasons.join(' ')}
                    >
                      {activeMessage.languageInfo.label} · {activeMessage.languageInfo.confidence}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] flex items-center gap-1.5 mt-0.5">
                    <User className="w-3 h-3" />
                    <span className="font-medium text-[#18181B]">{activeMessage.sender}</span>
                    <span>·</span>
                    <Clock className="w-3 h-3" />
                    <span className="font-mono">{activeMessage.timestamp}</span>
                  </p>
                </div>

                <button
                  onClick={() => onOpenMessage(activeMessage.id)}
                  className="p-1.5 rounded-lg border border-[#E4E1EE] bg-white hover:bg-[#F3F1F8] text-[#5B21B6] transition-colors cursor-pointer"
                  title="Expand message modal"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Original Message Content */}
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1">
                    Original Message
                  </span>
                  <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] font-mono text-xs text-[#18181B] whitespace-pre-wrap leading-relaxed select-text">
                    {activeMessage.text}
                  </div>
                </div>

                {/* AI English Translation (only for Hindi Devanagari / Roman Hindi / Hinglish) */}
                {activeMessage.translationInfo &&
                  activeMessage.translationInfo.status !== 'not_needed' && (
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5B21B6]">
                          English Translation
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#EDE9FE] text-[#4C1D95] border border-[#DDD6FE]">
                          {activeMessage.translationInfo.status === 'translated'
                            ? 'AI-Generated Interpretation'
                            : 'Translation Unavailable'}
                        </span>
                      </div>
                      {activeMessage.translationInfo.status === 'translated' &&
                      activeMessage.translationInfo.translatedText ? (
                        <div className="p-3 rounded-lg bg-[#F5F2FC] border border-[#DDD6FE] text-xs text-[#18181B] whitespace-pre-wrap leading-relaxed select-text">
                          {activeMessage.translationInfo.translatedText}
                        </div>
                      ) : (
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                          {activeMessage.translationInfo.unavailableReason ||
                            'AI translation unavailable for this message. Original evidence text is preserved above.'}
                        </div>
                      )}
                    </div>
                  )}

                {/* Analysis Findings */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Findings ({activeFindings.length})
                  </span>

                  {activeFindings.length === 0 ? (
                    <p className="text-xs text-[#64748B] bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg p-3">
                      No relevance flags raised for this message.
                    </p>
                  ) : (
                    activeFindings.map((f) => {
                      const isExpanded = !!expandedFindingIds[f.id];
                      return (
                        <div
                          key={f.id}
                          className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-semibold text-[#4C1D95]">{f.category}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                f.severity === 'critical'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : f.severity === 'elevated'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : f.severity === 'needs_review'
                                  ? 'bg-orange-50 text-orange-800 border-orange-300'
                                  : 'bg-violet-50 text-violet-700 border-violet-200'
                              }`}
                            >
                              {f.label}
                            </span>
                          </div>

                          <MethodBadge
                            sources={f.sources}
                            consensus={f.consensus}
                            size="xs"
                          />

                          <p className="text-[#18181B] leading-snug">{f.reason}</p>

                          {(f.contextRationale || f.aiExplanation || f.disagreementNote) && (
                            <button
                              type="button"
                              onClick={() => toggleFindingDetails(f.id)}
                              className="flex items-center gap-1 text-[11px] font-medium text-[#6D28D9] hover:text-[#4C1D95] cursor-pointer"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" /> Hide Analysis Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3.5 h-3.5" /> View Analysis Details
                                </>
                              )}
                            </button>
                          )}

                          {isExpanded && (
                            <div className="space-y-1.5 pt-1 border-t border-[#E4E1EE] text-[11px]">
                              {f.contextRationale && (
                                <p className="text-[#52525B]">
                                  <strong>Rationale:</strong> {f.contextRationale}
                                </p>
                              )}
                              {f.aiExplanation && (
                                <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-950">
                                  <strong>AI Context:</strong> {f.aiExplanation}
                                </div>
                              )}
                              {f.disagreementNote && (
                                <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-900">
                                  <strong>Method Disagreement:</strong> {f.disagreementNote}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Extracted Entities */}
                <div className="space-y-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                    <Fingerprint className="w-3.5 h-3.5 text-[#6D28D9]" />
                    Extracted Entities ({activeEntities.length})
                  </span>

                  {activeEntities.length === 0 ? (
                    <p className="text-xs text-[#64748B] bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg p-3">
                      No structured entities extracted from this message.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {activeEntities.map((ent) => (
                        <div
                          key={ent.id}
                          className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <span className="font-mono font-semibold text-[#18181B] block truncate">
                              {ent.text}
                            </span>
                            <span className="text-[10px] text-[#64748B]">
                              {ent.category} · {ent.method}
                            </span>
                          </div>
                          <MethodBadge sources={ent.sources} consensus={ent.consensus} size="xs" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Triage & Examiner Notes */}
                <div className="pt-3 border-t border-[#E4E1EE] space-y-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
                    Investigator Triage
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() => onUpdateStatus(activeMessage.id, 'relevant', noteDraft)}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                        activeMessage.investigatorStatus === 'relevant'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-white text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                      }`}
                    >
                      <CheckCircle className="w-3 h-3 text-rose-600" />
                      Relevant
                    </button>
                    <button
                      onClick={() => onUpdateStatus(activeMessage.id, 'needs_review', noteDraft)}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                        activeMessage.investigatorStatus === 'needs_review'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-white text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                      }`}
                    >
                      <HelpCircle className="w-3 h-3 text-amber-600" />
                      Review
                    </button>
                    <button
                      onClick={() => onUpdateStatus(activeMessage.id, 'not_relevant', noteDraft)}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                        activeMessage.investigatorStatus === 'not_relevant'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-white text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                      }`}
                    >
                      <XCircle className="w-3 h-3 text-emerald-600" />
                      Benign
                    </button>
                  </div>

                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onBlur={() =>
                      onUpdateStatus(activeMessage.id, activeMessage.investigatorStatus, noteDraft)
                    }
                    placeholder="Add investigator notes..."
                    rows={2}
                    className="w-full bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg p-2 text-xs text-[#18181B] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9]"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-xs text-[#64748B]">
              Select a message on the left to inspect its details.
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
