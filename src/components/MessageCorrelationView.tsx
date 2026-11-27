import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  User,
  ShieldAlert,
  Search,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import {
  ForensicCase,
  MessageCorrelation,
  CorrelationStatus,
  CorrelationType,
} from '../types/forensics';
import { MethodBadge } from './MethodBadge';

interface MessageCorrelationViewProps {
  forensicCase: ForensicCase;
  onOpenMessage: (id: number) => void;
  onUpdateCorrelationStatus?: (
    correlationId: string,
    status: CorrelationStatus,
    notes?: string
  ) => void;
}

export const MessageCorrelationView: React.FC<MessageCorrelationViewProps> = ({
  forensicCase,
  onOpenMessage,
  onUpdateCorrelationStatus,
}) => {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const correlations = forensicCase.correlations || [];

  const filteredCorrelations = correlations.filter((corr) => {
    if (typeFilter !== 'ALL' && corr.correlationType !== typeFilter) return false;
    if (statusFilter !== 'ALL' && corr.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const srcMsg = forensicCase.messages.find((m) => m.id === corr.sourceMessageId);
      const tgtMsg = forensicCase.messages.find((m) => m.id === corr.targetMessageId);
      const matchText =
        corr.explanation.toLowerCase().includes(q) ||
        corr.sharedEntities.some((e) => e.toLowerCase().includes(q)) ||
        (srcMsg && srcMsg.text.toLowerCase().includes(q)) ||
        (tgtMsg && tgtMsg.text.toLowerCase().includes(q));
      if (!matchText) return false;
    }
    return true;
  });

  const getSourceAndTarget = (corr: MessageCorrelation) => {
    const src = forensicCase.messages.find((m) => m.id === corr.sourceMessageId);
    const tgt = forensicCase.messages.find((m) => m.id === corr.targetMessageId);
    return { src, tgt };
  };

  const getTypeLabel = (type: CorrelationType) => {
    switch (type) {
      case 'shared_entity':
        return 'Shared Entity Link';
      case 'semantic_topic':
        return 'Semantic Topic Correlation';
      case 'temporal_proximity':
        return 'Temporal Proximity';
      case 'cross_participant_reference':
        return 'Cross-Participant Reference';
      default:
        return type;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF9F6]">
      {/* Filter Header */}
      <div className="px-6 py-4 bg-white border-b border-[#E4E1EE] space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#18181B]">
              Related Messages ({correlations.length} links)
            </h2>
            <p className="text-xs text-[#64748B]">
              Cross-message links derived from shared entities, semantic topics, and AI contextual correlation.
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search correlations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg text-xs text-[#18181B] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9] w-56"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#F1EFF7]">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Types' },
              { id: 'shared_entity', label: 'Shared Entities' },
              { id: 'semantic_topic', label: 'Semantic Topics' },
              { id: 'cross_participant_reference', label: 'Cross-Participant' },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => setTypeFilter(pill.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                  typeFilter === pill.id
                    ? 'bg-[#EDE9FE] text-[#4C1D95] border-[#C4B5FD]'
                    : 'bg-[#FAF9F6] text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[#64748B]">Status:</span>
            {['ALL', 'suggested', 'confirmed', 'rejected'].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono border capitalize transition-colors cursor-pointer ${
                  statusFilter === s
                    ? 'bg-[#EDE9FE] text-[#4C1D95] border-[#C4B5FD] font-semibold'
                    : 'bg-[#FAF9F6] text-[#52525B] border-[#E4E1EE]'
                }`}
              >
                {s.toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Correlation Cards */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3.5">
        {filteredCorrelations.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center p-8 bg-white rounded-xl border border-[#E4E1EE]">
            <HelpCircle className="w-8 h-8 text-[#94A3B8] mb-2" />
            <p className="text-sm font-medium text-[#3F3F46]">No correlations match current filters</p>
          </div>
        ) : (
          filteredCorrelations.map((corr, idx) => {
            const { src, tgt } = getSourceAndTarget(corr);
            if (!src || !tgt) return null;

            return (
              <div
                key={corr.id}
                className="p-4 rounded-xl bg-white border border-[#E4E1EE] hover:border-[#C4B5FD] transition-colors space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#F1EFF7]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-[#5B21B6] px-2 py-0.5 rounded bg-[#F3F1F8] border border-[#E4E1EE]">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-[#18181B]">
                      {getTypeLabel(corr.correlationType)}
                    </span>
                    <MethodBadge sources={corr.sources} size="xs" />
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border uppercase ${
                        corr.confidence === 'high'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : corr.confidence === 'medium'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-violet-50 text-violet-700 border-violet-200'
                      }`}
                    >
                      {corr.confidence}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-[#64748B] font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Δ {corr.timeDeltaMinutes} min
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                        corr.status === 'confirmed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : corr.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-[#FAF9F6] text-[#52525B] border-[#E4E1EE]'
                      }`}
                    >
                      {corr.status}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] flex items-start gap-2 text-xs text-[#27272A]">
                  <ShieldAlert className="w-4 h-4 text-[#6D28D9] shrink-0 mt-0.5" />
                  <span>{corr.explanation}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#4C1D95] flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {src.sender}
                      </span>
                      <span className="text-[11px] font-mono text-[#64748B]">
                        Msg #{src.id} · {src.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-[#18181B] font-mono leading-relaxed">
                      &quot;{src.text}&quot;
                    </p>
                    <button
                      onClick={() => onOpenMessage(src.id)}
                      className="text-[11px] text-[#6D28D9] hover:text-[#4C1D95] flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" /> Inspect #{src.id}
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-sky-800 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {tgt.sender}
                      </span>
                      <span className="text-[11px] font-mono text-[#64748B]">
                        Msg #{tgt.id} · {tgt.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-[#18181B] font-mono leading-relaxed">
                      &quot;{tgt.text}&quot;
                    </p>
                    <button
                      onClick={() => onOpenMessage(tgt.id)}
                      className="text-[11px] text-sky-700 hover:text-sky-900 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" /> Inspect #{tgt.id}
                    </button>
                  </div>
                </div>

                {onUpdateCorrelationStatus && (
                  <div className="flex items-center justify-end gap-2 pt-1 text-xs">
                    <button
                      onClick={() => onUpdateCorrelationStatus(corr.id, 'confirmed')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                        corr.status === 'confirmed'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-[#FAF9F6] text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Confirm
                    </button>
                    <button
                      onClick={() => onUpdateCorrelationStatus(corr.id, 'rejected')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                        corr.status === 'rejected'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-[#FAF9F6] text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
