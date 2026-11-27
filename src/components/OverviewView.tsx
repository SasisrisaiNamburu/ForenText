import React from 'react';
import {
  MessageSquare,
  AlertOctagon,
  Fingerprint,
  Layers,
  Hash,
  ArrowRight,
  Shield,
  FileText,
  TrendingUp,
  UserCheck,
  GitMerge,
  Cpu,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { ForensicCase } from '../types/forensics';
import { ActiveTab } from './Sidebar';
import { MethodBadge } from './MethodBadge';

interface OverviewViewProps {
  forensicCase: ForensicCase | null;
  isLoadingDemo?: boolean;
  setActiveTab: (tab: ActiveTab) => void;
  onOpenMessage: (id: number) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  forensicCase,
  isLoadingDemo = false,
  setActiveTab,
  onOpenMessage,
}) => {
  if (!forensicCase) {
    if (isLoadingDemo) {
      return (
        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4 bg-[#FAF9F6]">
          <div className="w-14 h-14 rounded-2xl bg-[#EDE9FE] border border-[#DDD6FE] flex items-center justify-center text-[#6D28D9]">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <div className="max-w-md space-y-1.5">
            <h2 className="text-lg font-bold text-[#18181B]">Loading Demonstration Case</h2>
            <p className="text-xs text-[#52525B] leading-relaxed">
              Parsing demo messages, extracting entities, running correlation analysis, and verifying SHA-256 integrity...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4 bg-[#FAF9F6]">
        <div className="w-14 h-14 rounded-2xl bg-[#EDE9FE] border border-[#DDD6FE] flex items-center justify-center text-[#6D28D9]">
          <Shield className="w-7 h-7" />
        </div>
        <div className="max-w-md space-y-1.5">
          <h2 className="text-lg font-bold text-[#18181B]">No Evidence Loaded</h2>
          <p className="text-xs text-[#52525B] leading-relaxed">
            Upload a WhatsApp text export (.txt) to begin message parsing, entity extraction,
            correlation analysis, and SHA-256 verification.
          </p>
        </div>
        <button
          onClick={() => setActiveTab('upload')}
          className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#6D28D9] hover:bg-[#5B21B6] transition-colors cursor-pointer"
        >
          Upload Evidence File
        </button>
      </div>
    );
  }

  const {
    metadata,
    messages,
    entities,
    findings,
    correlations = [],
    events = [],
    hybridStats,
  } = forensicCase;

  const senderCounts: Record<string, number> = {};
  messages.forEach((m) => {
    if (!m.isSystemMessage) {
      senderCounts[m.sender] = (senderCounts[m.sender] || 0) + 1;
    }
  });
  const senderList = Object.entries(senderCounts).sort((a, b) => b[1] - a[1]);

  const dateCounts: Record<string, number> = {};
  messages.forEach((m) => {
    if (m.dateStr) dateCounts[m.dateStr] = (dateCounts[m.dateStr] || 0) + 1;
  });
  const dateEntries = Object.entries(dateCounts).sort((a, b) => a[0].localeCompare(b[0]));
  const maxDateCount = Math.max(...Object.values(dateCounts), 1);

  const categoryCounts: Record<string, number> = {};
  entities.forEach((e) => {
    categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
  });
  const categoryList = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);

  const highCount = findings.filter((f) => f.severity === 'critical').length;
  const mediumCount = findings.filter((f) => f.severity === 'elevated').length;
  const needsReviewCount = findings.filter((f) => f.severity === 'needs_review').length;

  const ruleFindingsCount = findings.filter((f) => f.sources?.includes('rule')).length;
  const nlpFindingsCount = findings.filter((f) => f.sources?.includes('nlp')).length;
  const aiFindingsCount = findings.filter((f) => f.sources?.includes('ai')).length;
  const consensusCount = findings.filter(
    (f) => f.consensus === 'hybrid_consensus' || (f.sources && f.sources.length > 1)
  ).length;
  const disagreementCount = findings.filter(
    (f) => f.consensus === 'method_disagreement'
  ).length;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto overflow-y-auto bg-[#FAF9F6]">
      {/* Evidence Custody Record */}
      <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE] shrink-0">
            <Hash className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#18181B]">
                Evidence Custody & SHA-256 Digest
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium border ${
                  metadata.isDemo
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-sky-50 text-sky-800 border-sky-200'
                }`}
              >
                {metadata.isDemo ? 'Demo Dataset' : 'Uploaded File'}
              </span>
            </div>
            <p className="text-xs font-mono text-[#3F3F46] mt-0.5">
              {metadata.filename} · {metadata.totalMessages} messages ({metadata.totalLines} lines)
            </p>
            <p className="text-[11px] font-mono text-[#64748B] mt-0.5 break-all select-all">
              {metadata.sha256}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('upload')}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#3F3F46] bg-[#FAF9F6] hover:bg-[#F3F1F8] border border-[#E4E1EE] transition-colors cursor-pointer"
          >
            Change File
          </button>
          <button
            onClick={() => setActiveTab('report')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#4C1D95] bg-[#EDE9FE] hover:bg-[#DDD6FE] border border-[#C4B5FD] transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View Report</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => setActiveTab('analysis')}
          className="p-4 rounded-xl bg-white border border-[#E4E1EE] hover:border-[#C4B5FD] cursor-pointer transition-colors flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-[#64748B] font-medium">Total Messages</p>
            <p className="text-2xl font-bold text-[#18181B] font-mono tabular-nums mt-1">
              {metadata.totalMessages}
            </p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {senderList.length} participants
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#EDE9FE] text-[#6D28D9]">
            <MessageSquare className="w-4 h-4" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('findings')}
          className="p-4 rounded-xl bg-white border border-[#E4E1EE] hover:border-[#C4B5FD] cursor-pointer transition-colors flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-[#64748B] font-medium">Relevant Findings</p>
            <p className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
              {findings.length}
            </p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {highCount} high · {mediumCount} med ·{' '}
              <span className={needsReviewCount > 0 ? 'text-orange-700 font-semibold' : ''}>
                {needsReviewCount} review
              </span>
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700">
            <AlertOctagon className="w-4 h-4" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('entities')}
          className="p-4 rounded-xl bg-white border border-[#E4E1EE] hover:border-[#C4B5FD] cursor-pointer transition-colors flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-[#64748B] font-medium">Extracted Entities</p>
            <p className="text-2xl font-bold text-[#6D28D9] font-mono tabular-nums mt-1">
              {entities.length}
            </p>
            <p className="text-[11px] text-[#64748B] mt-0.5">
              {categoryList.length} categories
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#F3F1F8] text-[#6D28D9]">
            <Fingerprint className="w-4 h-4" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('correlation')}
          className="p-4 rounded-xl bg-white border border-[#E4E1EE] hover:border-[#C4B5FD] cursor-pointer transition-colors flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-[#64748B] font-medium">Related Messages</p>
            <p className="text-2xl font-bold text-sky-700 font-mono tabular-nums mt-1">
              {correlations.length}
            </p>
            <p className="text-[11px] text-[#64748B] mt-0.5">Correlation links</p>
          </div>
          <div className="p-2.5 rounded-lg bg-sky-50 text-sky-700">
            <GitMerge className="w-4 h-4" />
          </div>
        </div>

        <div
          onClick={() => setActiveTab('events')}
          className="p-4 rounded-xl bg-white border border-[#E4E1EE] hover:border-[#C4B5FD] cursor-pointer transition-colors flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-[#64748B] font-medium">Possible Events</p>
            <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {events.length}
            </p>
            <p className="text-[11px] text-[#64748B] mt-0.5">Chronological clusters</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
            <Layers className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Compact Hybrid Analysis Pipeline Summary */}
      <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#6D28D9]" />
            <span className="text-xs font-semibold text-[#18181B]">
              Hybrid Analysis Pipeline (Rule + NLP + AI)
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[#52525B] font-mono">
            <span>
              Consensus:{' '}
              <strong className="text-[#18181B]">
                {findings.length > 0 ? Math.round((consensusCount / findings.length) * 100) : 0}%
              </strong>
            </span>
            <span>·</span>
            <span>
              Provider:{' '}
              <strong className="text-[#18181B]">
                {hybridStats?.aiProvider === 'gemini-4-hydrogen'
                  ? 'Gemini 4 Flash'
                  : hybridStats?.aiProvider === 'gemini-3.1-flash-lite'
                  ? 'Gemini 3.1 Flash Lite'
                  : hybridStats?.aiProvider && hybridStats.aiProvider.startsWith('gemini-')
                  ? hybridStats.aiProvider
                  : 'Local Contextual Engine'}
              </strong>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-semibold text-sky-800">RULE-BASED</span>
              <p className="text-[11px] text-[#64748B]">Regex &amp; keyword matching</p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#18181B] bg-white px-2 py-1 rounded border border-[#E4E1EE]">
              {ruleFindingsCount} hits
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-semibold text-violet-800">NLP LINGUISTIC</span>
              <p className="text-[11px] text-[#64748B]">NER, landmarks &amp; syntax</p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#18181B] bg-white px-2 py-1 rounded border border-[#E4E1EE]">
              {nlpFindingsCount} hits
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-semibold text-amber-800">AI CONTEXTUAL</span>
              <p className="text-[11px] text-[#64748B]">Indirect intent &amp; context</p>
            </div>
            <span className="text-xs font-mono font-semibold text-[#18181B] bg-white px-2 py-1 rounded border border-[#E4E1EE]">
              {aiFindingsCount} hits
            </span>
          </div>
        </div>

        {disagreementCount > 0 && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-900">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Method Discrepancy:</strong> {disagreementCount} finding(s) show conflicting Rule vs AI signals requiring examiner review.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('findings')}
              className="text-xs font-semibold text-rose-800 underline hover:text-rose-950 shrink-0 ml-3 cursor-pointer"
            >
              Review
            </button>
          </div>
        )}
      </div>

      {/* Activity & Participants Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Daily Activity Chart */}
        <div className="p-5 rounded-xl bg-white border border-[#E4E1EE] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#6D28D9]" />
              <h3 className="text-sm font-semibold text-[#18181B]">Timeline Activity</h3>
            </div>
            <button
              onClick={() => setActiveTab('timeline')}
              className="text-xs text-[#6D28D9] hover:text-[#4C1D95] font-medium flex items-center gap-1 cursor-pointer"
            >
              Full Timeline <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <p className="text-xs text-[#64748B] mb-4">
            Daily volume from {metadata.dateRange.start} to {metadata.dateRange.end}
          </p>

          <div className="flex-1 flex items-end gap-2.5 min-h-[140px] pb-2 border-b border-[#E4E1EE]">
            {dateEntries.map(([date, count]) => {
              const heightPercent = Math.max((count / maxDateCount) * 100, 10);
              return (
                <div key={date} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <span className="text-[10px] font-mono text-[#4C1D95] opacity-0 group-hover:opacity-100 transition-opacity">
                    {count}
                  </span>
                  <div className="w-full bg-[#F3F1F8] rounded-t relative flex items-end overflow-hidden h-32">
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full bg-[#7C3AED] group-hover:bg-[#6D28D9] rounded-t transition-colors"
                    />
                  </div>
                  <span className="text-[10px] font-mono text-[#64748B] truncate max-w-[70px]">
                    {date.substring(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Participant Breakdown */}
        <div className="p-5 rounded-xl bg-white border border-[#E4E1EE] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#6D28D9]" />
              <h3 className="text-sm font-semibold text-[#18181B]">Participant Breakdown</h3>
            </div>
            <span className="text-xs text-[#64748B] font-mono">
              {senderList.length} Participants
            </span>
          </div>
          <p className="text-xs text-[#64748B] mb-4">
            Share of authored messages per sender
          </p>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[200px]">
            {senderList.map(([sender, count]) => {
              const pct = Math.round((count / Math.max(metadata.totalMessages, 1)) * 100);
              return (
                <div key={sender} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#18181B] truncate max-w-[200px]">
                      {sender}
                    </span>
                    <span className="font-mono text-[#52525B] tabular-nums">
                      {count} msgs ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#F3F1F8] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-[#7C3AED] rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Findings Preview */}
      <div className="p-5 rounded-xl bg-white border border-[#E4E1EE]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[#18181B]">Recent Flagged Findings</h3>
            <p className="text-xs text-[#64748B]">
              Click any item to inspect the original message record
            </p>
          </div>
          <button
            onClick={() => setActiveTab('findings')}
            className="text-xs text-[#6D28D9] hover:text-[#4C1D95] font-medium flex items-center gap-1 cursor-pointer"
          >
            View All {findings.length} Findings <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-2">
          {findings.slice(0, 5).map((f) => {
            const msg = messages.find((m) => m.id === f.messageId);
            return (
              <div
                key={f.id}
                onClick={() => onOpenMessage(f.messageId)}
                className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] hover:border-[#8B5CF6] cursor-pointer transition-colors flex items-start justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
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
                    <MethodBadge sources={f.sources} consensus={f.consensus} size="xs" />
                    <span className="text-xs font-semibold text-[#18181B]">{f.category}</span>
                    <span className="text-[11px] font-mono text-[#64748B]">
                      Line {msg?.rawLineIndex} · {msg?.sender}
                    </span>
                  </div>
                  <p className="text-xs text-[#27272A] font-mono truncate">&quot;{msg?.text}&quot;</p>
                  <p className="text-[11px] text-[#52525B]">{f.reason}</p>
                </div>

                <span className="text-[11px] font-mono text-[#64748B] shrink-0">
                  {msg?.timestamp}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
