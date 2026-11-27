import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ExternalLink,
  Edit3,
  Cpu,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { ForensicCase, ReviewStatus } from '../types/forensics';
import { MethodBadge } from './MethodBadge';

interface RelevantFindingsViewProps {
  forensicCase: ForensicCase;
  onOpenMessage: (id: number) => void;
  onUpdateStatus: (msgId: number, status: ReviewStatus, notes?: string) => void;
}

const PAGE_SIZE = 30;

export const RelevantFindingsView: React.FC<RelevantFindingsViewProps> = ({
  forensicCase,
  onOpenMessage,
  onUpdateStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<
    'all' | 'critical' | 'elevated' | 'needs_review' | 'contextual' | 'informational'
  >('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [tempNoteText, setTempNoteText] = useState('');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);

  const { findings, messages, hybridStats } = forensicCase;

  const categories = useMemo(() => {
    return Array.from(new Set(findings.map((f) => f.category))).sort();
  }, [findings]);

  const filteredFindings = useMemo(() => {
    return findings.filter((f) => {
      const msg = messages.find((m) => m.id === f.messageId);
      if (!msg) return false;

      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && msg.investigatorStatus !== statusFilter) return false;

      if (methodFilter === 'rule' && !f.sources?.includes('rule')) return false;
      if (methodFilter === 'nlp' && !f.sources?.includes('nlp')) return false;
      if (methodFilter === 'ai' && !f.sources?.includes('ai')) return false;
      if (methodFilter === 'consensus' && f.consensus !== 'hybrid_consensus') return false;
      if (methodFilter === 'disagreement' && f.consensus !== 'method_disagreement') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesReason = f.reason.toLowerCase().includes(q);
        const matchesCategory = f.category.toLowerCase().includes(q);
        const matchesTokens = f.matchedTokens.some((t) => t.toLowerCase().includes(q));
        const matchesText = msg.text.toLowerCase().includes(q);
        const matchesTranslation = (msg.translationInfo?.translatedText || '')
          .toLowerCase()
          .includes(q);
        const matchesSender = msg.sender.toLowerCase().includes(q);
        const matchesAi = (f.aiExplanation || '').toLowerCase().includes(q);
        const matchesDisagreement = (f.disagreementNote || '').toLowerCase().includes(q);
        if (
          !matchesReason &&
          !matchesCategory &&
          !matchesTokens &&
          !matchesText &&
          !matchesTranslation &&
          !matchesSender &&
          !matchesAi &&
          !matchesDisagreement
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    findings,
    messages,
    categoryFilter,
    severityFilter,
    statusFilter,
    methodFilter,
    searchQuery,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredFindings.length / PAGE_SIZE));
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, severityFilter, statusFilter, methodFilter, searchQuery]);

  const paginatedFindings = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredFindings.slice(start, start + PAGE_SIZE);
  }, [filteredFindings, currentPage]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartEditNote = (msgId: number, currentNote?: string) => {
    setEditingNoteId(msgId);
    setTempNoteText(currentNote || '');
  };

  const handleSaveNote = (msgId: number, currentStatus: ReviewStatus) => {
    onUpdateStatus(msgId, currentStatus, tempNoteText);
    setEditingNoteId(null);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF9F6]">
      {/* Filter Header */}
      <div className="px-6 py-4 bg-white border-b border-[#E4E1EE] space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search findings, tokens, AI notes, or message text..."
              className="w-full bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#18181B] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B]"
          >
            <option value="all">All Categories ({findings.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            className="bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B]"
          >
            <option value="all">All Priority Tiers</option>
            <option value="critical">High (Critical)</option>
            <option value="elevated">Medium (Elevated)</option>
            <option value="needs_review">Orange – Needs Review</option>
            <option value="contextual">Contextual</option>
            <option value="informational">Informational</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg px-2.5 py-1.5 text-xs text-[#18181B]"
          >
            <option value="all">All Review States</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="relevant">Marked Relevant</option>
            <option value="needs_review">Needs Review</option>
            <option value="not_relevant">Marked Benign</option>
          </select>
        </div>

        {/* Method Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F1EFF7]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[#64748B] flex items-center gap-1 font-medium mr-1">
              <Cpu className="w-3.5 h-3.5 text-[#6D28D9]" /> Source:
            </span>
            {[
              { id: 'all', label: 'All Methods' },
              { id: 'rule', label: 'Rule' },
              { id: 'nlp', label: 'NLP' },
              { id: 'ai', label: 'AI' },
              { id: 'consensus', label: 'Consensus' },
              { id: 'disagreement', label: 'Disagreements' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setMethodFilter(pill.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  methodFilter === pill.id
                    ? 'bg-[#EDE9FE] text-[#4C1D95] border border-[#C4B5FD]'
                    : 'bg-[#FAF9F6] text-[#52525B] hover:bg-[#F3F1F8] border border-[#E4E1EE]'
                }`}
              >
                {pill.label}
                {pill.id === 'disagreement' && hybridStats?.disagreementCount ? (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded font-semibold">
                    {hybridStats.disagreementCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {[
              {
                id: 'critical' as const,
                label: 'High',
                count: findings.filter((f) => f.severity === 'critical').length,
                cls: 'bg-rose-50 text-rose-700 border-rose-200',
              },
              {
                id: 'elevated' as const,
                label: 'Medium',
                count: findings.filter((f) => f.severity === 'elevated').length,
                cls: 'bg-amber-50 text-amber-800 border-amber-200',
              },
              {
                id: 'needs_review' as const,
                label: 'Orange – Needs Review',
                count: findings.filter((f) => f.severity === 'needs_review').length,
                cls: 'bg-orange-50 text-orange-800 border-orange-300',
              },
            ].map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() =>
                  setSeverityFilter((prev) => (prev === tier.id ? 'all' : tier.id))
                }
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border cursor-pointer transition-opacity ${tier.cls} ${
                  severityFilter !== 'all' && severityFilter !== tier.id ? 'opacity-50' : ''
                }`}
              >
                {tier.label}: {tier.count}
              </button>
            ))}
            <span className="text-[11px] font-mono text-[#64748B] ml-1">
              {filteredFindings.length} finding(s)
            </span>
          </div>
        </div>
      </div>

      {/* Findings List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {paginatedFindings.length === 0 ? (
          <div className="p-12 text-center text-[#64748B] bg-white rounded-xl border border-[#E4E1EE]">
            <p className="text-sm font-medium text-[#3F3F46]">
              No findings match the current filter selection.
            </p>
          </div>
        ) : (
          paginatedFindings.map((finding, idx) => {
            const msg = messages.find((m) => m.id === finding.messageId);
            if (!msg) return null;

            const isEditingNote = editingNoteId === msg.id;
            const isExpanded = !!expandedIds[finding.id];
            const hasDetails =
              !!finding.contextRationale ||
              !!finding.aiExplanation ||
              !!finding.disagreementNote;

            return (
              <div
                key={finding.id}
                className={`p-4 rounded-xl bg-white border border-[#E4E1EE] hover:border-[#C4B5FD] transition-colors space-y-2.5 border-l-4 ${
                  finding.severity === 'critical'
                    ? 'border-l-rose-500'
                    : finding.severity === 'elevated'
                    ? 'border-l-amber-500'
                    : finding.severity === 'needs_review'
                    ? 'border-l-orange-500'
                    : 'border-l-[#7C3AED]'
                }`}
              >
                {/* Top Summary Line */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        finding.severity === 'critical'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : finding.severity === 'elevated'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : finding.severity === 'needs_review'
                          ? 'bg-orange-50 text-orange-800 border-orange-300'
                          : 'bg-violet-50 text-violet-700 border-violet-200'
                      }`}
                    >
                      {finding.label}
                    </span>
                    <span className="text-xs font-semibold text-[#18181B]">
                      #{(currentPage - 1) * PAGE_SIZE + idx + 1} · {finding.category}
                    </span>
                    <MethodBadge sources={finding.sources} consensus={finding.consensus} />
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-[#64748B] font-mono">
                    <span>Msg #{msg.id}</span>
                    <span>·</span>
                    <span>Line {msg.rawLineIndex}</span>
                    <span>·</span>
                    <span>{msg.timestamp}</span>
                    <span>·</span>
                    <span className="font-sans font-semibold text-[#18181B]">{msg.sender}</span>
                  </div>
                </div>

                {/* Short Reason */}
                <p className="text-xs font-medium text-[#27272A]">{finding.reason}</p>

                {/* Original Message & English Translation (Click to inspect source) */}
                <div
                  onClick={() => onOpenMessage(msg.id)}
                  className="px-3 py-2.5 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] hover:border-[#8B5CF6] cursor-pointer transition-colors space-y-2 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] block">
                        Original Message
                      </span>
                      <p className="font-mono text-xs text-[#27272A] whitespace-pre-wrap break-words leading-relaxed">
                        {msg.text}
                      </p>
                    </div>
                    <span className="text-[11px] font-medium text-[#6D28D9] flex items-center gap-1 shrink-0 mt-0.5">
                      Inspect <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>

                  {msg.translationInfo && msg.translationInfo.status !== 'not_needed' && (
                    <div className="pt-2 border-t border-[#E4E1EE]">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5B21B6]">
                          English Translation
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#EDE9FE] text-[#4C1D95] border border-[#DDD6FE]">
                          {msg.translationInfo.status === 'translated'
                            ? 'AI-Generated'
                            : 'Unavailable'}
                        </span>
                      </div>
                      {msg.translationInfo.status === 'translated' &&
                      msg.translationInfo.translatedText ? (
                        <p className="text-xs text-[#18181B] whitespace-pre-wrap break-words leading-relaxed">
                          {msg.translationInfo.translatedText}
                        </p>
                      ) : (
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          {msg.translationInfo.unavailableReason ||
                            'AI translation unavailable. Original evidence preserved.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Expandable Detailed Rationale / AI / Disagreement */}
                {hasDetails && isExpanded && (
                  <div className="space-y-2 pt-1">
                    {finding.contextRationale && (
                      <p className="text-xs text-[#52525B] bg-[#FAF9F6] p-2.5 rounded-lg border border-[#E4E1EE]">
                        <strong>Context Rationale:</strong> {finding.contextRationale}
                      </p>
                    )}
                    {finding.aiExplanation && (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-amber-900">
                            AI Contextual Explanation:{' '}
                          </span>
                          {finding.aiExplanation}
                        </div>
                      </div>
                    )}
                    {finding.disagreementNote && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-rose-800">
                            Method Disagreement:{' '}
                          </span>
                          {finding.disagreementNote}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Action & Triage Row */}
                <div className="pt-2 border-t border-[#F1EFF7] flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      onClick={() => onUpdateStatus(msg.id, 'relevant')}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                        msg.investigatorStatus === 'relevant'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-[#FAF9F6] text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                      }`}
                    >
                      Relevant
                    </button>
                    <button
                      onClick={() => onUpdateStatus(msg.id, 'needs_review')}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                        msg.investigatorStatus === 'needs_review'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-[#FAF9F6] text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                      }`}
                    >
                      Needs Review
                    </button>
                    <button
                      onClick={() => onUpdateStatus(msg.id, 'not_relevant')}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors cursor-pointer ${
                        msg.investigatorStatus === 'not_relevant'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-[#FAF9F6] text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                      }`}
                    >
                      Benign
                    </button>

                    {hasDetails && (
                      <button
                        onClick={() => toggleExpanded(finding.id)}
                        className="ml-2 flex items-center gap-1 text-[11px] font-medium text-[#6D28D9] hover:text-[#4C1D95] cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" /> Hide Details
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" /> Analysis Details
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="flex items-center gap-2">
                    {isEditingNote ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={tempNoteText}
                          onChange={(e) => setTempNoteText(e.target.value)}
                          placeholder="Add investigator note..."
                          className="px-2 py-1 rounded bg-[#FAF9F6] border border-[#6D28D9] text-xs text-[#18181B] focus:outline-none w-52"
                        />
                        <button
                          onClick={() => handleSaveNote(msg.id, msg.investigatorStatus)}
                          className="px-2.5 py-1 rounded bg-[#6D28D9] text-white text-xs font-medium cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="text-xs text-[#64748B] hover:text-[#18181B] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {msg.investigatorNotes && (
                          <span className="text-[11px] text-[#5B21B6] italic font-mono truncate max-w-[200px]">
                            &quot;{msg.investigatorNotes}&quot;
                          </span>
                        )}
                        <button
                          onClick={() => handleStartEditNote(msg.id, msg.investigatorNotes)}
                          className="flex items-center gap-1 text-[11px] text-[#64748B] hover:text-[#6D28D9] cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{msg.investigatorNotes ? 'Edit Note' : 'Add Note'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Footer */}
      {filteredFindings.length > PAGE_SIZE && (
        <div className="px-6 py-2.5 bg-white border-t border-[#E4E1EE] flex items-center justify-between text-xs text-[#52525B] shrink-0">
          <span className="font-mono text-[11px]">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, filteredFindings.length)} of {filteredFindings.length}{' '}
            findings
          </span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#E4E1EE] bg-[#FAF9F6] hover:bg-[#F3F1F8] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <span className="px-2 font-mono text-[11px] text-[#18181B]">
              Page {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 px-2.5 py-1 rounded border border-[#E4E1EE] bg-[#FAF9F6] hover:bg-[#F3F1F8] disabled:opacity-40 cursor-pointer"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
