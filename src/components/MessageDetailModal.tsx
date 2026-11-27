import React from 'react';
import {
  X,
  Clock,
  User,
  Hash,
  AlertTriangle,
  Fingerprint,
  CheckCircle,
  XCircle,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react';
import {
  MessageRecord,
  ReviewStatus,
  FlaggedFinding,
  ExtractedEntity,
} from '../types/forensics';
import { MethodBadge } from './MethodBadge';

interface MessageDetailModalProps {
  message: MessageRecord | null;
  hybridFindings?: FlaggedFinding[];
  hybridEntities?: ExtractedEntity[];
  totalMessages: number;
  onClose: () => void;
  onSelectMessage: (msgId: number) => void;
  onUpdateStatus: (msgId: number, status: ReviewStatus, notes?: string) => void;
}

export const MessageDetailModal: React.FC<MessageDetailModalProps> = ({
  message,
  hybridFindings,
  hybridEntities,
  totalMessages,
  onClose,
  onSelectMessage,
  onUpdateStatus,
}) => {
  if (!message) return null;

  const [notes, setNotes] = React.useState(message.investigatorNotes || '');

  React.useEffect(() => {
    setNotes(message.investigatorNotes || '');
  }, [message]);

  const findings = hybridFindings && hybridFindings.length >= message.flaggedFindings.length
    ? hybridFindings
    : message.flaggedFindings;

  const entities = hybridEntities && hybridEntities.length >= message.entities.length
    ? hybridEntities
    : message.entities;

  const handleStatusChange = (newStatus: ReviewStatus) => {
    onUpdateStatus(message.id, newStatus, notes);
  };

  const handleNotesBlur = () => {
    onUpdateStatus(message.id, message.investigatorStatus, notes);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#18181B]/45 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white border border-[#E4E1EE] rounded-xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden text-[#18181B]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E4E1EE] flex items-center justify-between bg-[#FAF9F6]">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-[#EDE9FE] text-[#6D28D9] border border-[#DDD6FE]">
              <Shield className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-[#18181B] font-mono">
                  Message #{message.id}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded bg-[#F3F1F8] text-[#4B4860] border border-[#E4E1EE] font-mono">
                  Line {message.rawLineIndex}
                </span>
              </div>
              <p className="text-xs text-[#64748B]">Source Evidence Traceability</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={message.id <= 1}
              onClick={() => onSelectMessage(message.id - 1)}
              className="p-1.5 rounded-lg bg-white hover:bg-[#F3F1F8] disabled:opacity-40 text-[#5B21B6] border border-[#E4E1EE] transition-colors cursor-pointer"
              title="Previous message"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono text-[#64748B] px-1">
              {message.id} / {totalMessages}
            </span>
            <button
              disabled={message.id >= totalMessages}
              onClick={() => onSelectMessage(message.id + 1)}
              className="p-1.5 rounded-lg bg-white hover:bg-[#F3F1F8] disabled:opacity-40 text-[#5B21B6] border border-[#E4E1EE] transition-colors cursor-pointer"
              title="Next message"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white hover:bg-[#F3F1F8] text-[#64748B] hover:text-[#18181B] border border-[#E4E1EE] transition-colors ml-2 cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-[#FAF9F6] p-3.5 rounded-lg border border-[#E4E1EE]">
            <div className="flex items-center gap-2 text-[#52525B]">
              <Clock className="w-3.5 h-3.5 text-[#6D28D9] shrink-0" />
              <span>Timestamp:</span>
              <span className="font-mono text-[#18181B] font-medium tabular-nums">
                {message.timestamp}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#52525B]">
              <User className="w-3.5 h-3.5 text-[#6D28D9] shrink-0" />
              <span>Sender:</span>
              <span className="font-semibold text-[#18181B] truncate">{message.sender}</span>
            </div>
            <div className="flex items-center gap-2 text-[#52525B]">
              <Hash className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
              <span>Raw Header:</span>
              <span className="font-mono text-[#475569] truncate">{message.timestampRaw}</span>
            </div>
            <div className="flex items-center gap-2 text-[#52525B]">
              <span>Attachment:</span>
              <span className="font-medium text-[#3F3F46]">
                {message.hasMediaAttachment ? message.mediaDescription || 'Yes' : 'None'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[#52525B] sm:col-span-2">
              <span>Detected Language:</span>
              <span className="font-mono text-[#4C1D95] font-medium">
                {message.languageInfo.label} ({message.languageInfo.script} script · {message.languageInfo.confidence} confidence)
              </span>
            </div>
          </div>

          {/* Original Message Text */}
          <div>
            <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-1.5">
              Original Message
            </label>
            <div className="p-4 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] font-mono text-sm leading-relaxed text-[#18181B] whitespace-pre-wrap select-text">
              {message.text}
            </div>
          </div>

          {/* English Translation (for Hindi / Roman Hindi / Hinglish messages) */}
          {message.translationInfo && message.translationInfo.status !== 'not_needed' && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="text-[11px] font-semibold text-[#5B21B6] uppercase tracking-wider">
                  English Translation
                </label>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#EDE9FE] text-[#4C1D95] border border-[#DDD6FE]">
                  {message.translationInfo.status === 'translated'
                    ? 'AI-Generated Interpretation'
                    : 'Unavailable'}
                </span>
              </div>
              {message.translationInfo.status === 'translated' &&
              message.translationInfo.translatedText ? (
                <div className="p-4 rounded-lg bg-[#F5F2FC] border border-[#DDD6FE] text-sm leading-relaxed text-[#18181B] whitespace-pre-wrap select-text">
                  {message.translationInfo.translatedText}
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs leading-relaxed text-amber-900">
                  {message.translationInfo.unavailableReason ||
                    'AI translation unavailable for this message. Original evidence message preserved verbatim.'}
                </div>
              )}
            </div>
          )}

          {/* Flagged Findings */}
          {findings.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Forensic Findings ({findings.length})
              </label>
              <div className="space-y-2.5">
                {findings.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-3.5 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#4C1D95]">{finding.category}</span>
                        <MethodBadge
                          sources={finding.sources}
                          consensus={finding.consensus}
                          size="xs"
                        />
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
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
                    </div>
                    <p className="text-[#18181B] font-medium">{finding.reason}</p>
                    <p className="text-[11px] text-[#52525B]">
                      Rationale: {finding.contextRationale}
                    </p>

                    {(finding.aiExplanation || finding.aiContextualInterpretation) && (
                      <div className="p-2.5 rounded bg-amber-50/70 border border-amber-200 text-[11px] text-amber-950">
                        <span className="font-semibold text-amber-800">Contextual AI Insight: </span>
                        {finding.aiExplanation || finding.aiContextualInterpretation}
                      </div>
                    )}

                    {(finding.disagreementNote || finding.discrepancyNote) && (
                      <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-[11px] text-rose-900">
                        <span className="font-semibold text-rose-800">Method Disagreement: </span>
                        {finding.disagreementNote || finding.discrepancyNote}
                      </div>
                    )}

                    {finding.isFalsePositiveLikely && (
                      <p className="text-[11px] text-amber-900 bg-amber-50 p-2 rounded border border-amber-200">
                        Contextual Note: Surrounding text suggests probable benign usage. Manual examiner verification required.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Entities */}
          {entities.length > 0 && (
            <div>
              <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Fingerprint className="w-3.5 h-3.5 text-[#6D28D9]" />
                Extracted Entities ({entities.length})
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {entities.map((entity) => (
                  <div
                    key={entity.id}
                    className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono font-semibold text-[#18181B]">
                        {entity.text}
                      </span>
                      <span className="text-[10px] text-[#5B21B6] px-1.5 py-0.5 rounded bg-[#EDE9FE] border border-[#DDD6FE]">
                        {entity.category}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-[#64748B] truncate">{entity.method}</p>
                      <MethodBadge
                        sources={entity.sources}
                        consensus={entity.consensus}
                        size="xs"
                      />
                    </div>
                    {entity.details && (
                      <p className="text-[10px] text-[#52525B] italic">{entity.details}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Investigator Triage & Status */}
          <div className="pt-3 border-t border-[#E4E1EE] space-y-3">
            <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block">
              Investigator Assessment
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleStatusChange('relevant')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
                  message.investigatorStatus === 'relevant'
                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                    : 'bg-white text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 text-rose-600" />
                <span>Mark Relevant</span>
              </button>

              <button
                onClick={() => handleStatusChange('needs_review')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
                  message.investigatorStatus === 'needs_review'
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-white text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Needs Review</span>
              </button>

              <button
                onClick={() => handleStatusChange('not_relevant')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
                  message.investigatorStatus === 'not_relevant'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-white text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                }`}
              >
                <XCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>Not Relevant / Benign</span>
              </button>
            </div>

            <div>
              <label className="text-[11px] text-[#64748B] block mb-1">
                Examiner Case Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Enter observations, corroboration steps, or warrant references..."
                rows={2}
                className="w-full bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg p-2.5 text-xs text-[#18181B] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9]"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#E4E1EE] bg-[#FAF9F6] flex items-center justify-between text-xs text-[#64748B]">
          <span>Changes saved to active session</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
