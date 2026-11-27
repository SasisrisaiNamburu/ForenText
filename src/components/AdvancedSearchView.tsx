import React, { useState, useMemo } from 'react';
import {
  Search,
  Sparkles,
  ExternalLink,
  ShieldAlert,
  Car,
  FileText,
  MapPin,
  Package,
} from 'lucide-react';
import { ForensicCase } from '../types/forensics';

interface AdvancedSearchViewProps {
  forensicCase: ForensicCase;
  onOpenMessage: (id: number) => void;
}

export const AdvancedSearchView: React.FC<AdvancedSearchViewProps> = ({
  forensicCase,
  onOpenMessage,
}) => {
  const [query, setQuery] = useState('');
  const [selectedSender, setSelectedSender] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedReviewStatus, setSelectedReviewStatus] = useState<string>('ALL');
  const [semanticConcept, setSemanticConcept] = useState<string | null>(null);

  const conceptPresets = [
    {
      id: 'logistics',
      label: 'Logistics & Arrival',
      icon: MapPin,
      pattern: /\b(?:reach|station|terminal|airport|arrive|heading|timing|transit|travel)\b/i,
    },
    {
      id: 'vehicle',
      label: 'Vehicle & Spotting',
      icon: Car,
      pattern: /\b(?:swift|car|parked|vehicle|scorpio|suv|van|bike|gaadi)\b/i,
    },
    {
      id: 'object',
      label: 'Object & Backpack',
      icon: Package,
      pattern: /\b(?:backpack|bag|package|parcel|outside|unattended|carton)\b/i,
    },
    {
      id: 'documents',
      label: 'Documents & Handover',
      icon: FileText,
      pattern: /\b(?:property papers|file|agreement|deed|aadhaar|pan card|power of attorney)\b/i,
    },
    {
      id: 'anti_forensics',
      label: 'Sanitization / Secrecy',
      icon: ShieldAlert,
      pattern: /\b(?:wipe|delete|clear chat|partition|pendrive|hard drive|secret|don't tell|mat batana)\b/i,
    },
  ];

  const searchResults = useMemo(() => {
    return forensicCase.messages.filter((msg) => {
      if (query.trim()) {
        const q = query.toLowerCase();
        const matchesText = msg.text.toLowerCase().includes(q);
        const matchesTranslation = (msg.translationInfo?.translatedText || '')
          .toLowerCase()
          .includes(q);
        const matchesEntities = msg.entities.some((e) => e.text.toLowerCase().includes(q));
        const matchesFindings = msg.flaggedFindings.some((f) => f.reason.toLowerCase().includes(q));
        if (!matchesText && !matchesTranslation && !matchesEntities && !matchesFindings) return false;
      }

      if (selectedSender !== 'ALL' && msg.sender !== selectedSender) return false;

      if (selectedCategory !== 'ALL') {
        const hasCategory = msg.entities.some((e) => e.category === selectedCategory);
        if (!hasCategory) return false;
      }

      if (selectedReviewStatus !== 'ALL' && msg.investigatorStatus !== selectedReviewStatus) {
        return false;
      }

      if (semanticConcept) {
        const preset = conceptPresets.find((p) => p.id === semanticConcept);
        const target = `${msg.text} ${msg.translationInfo?.translatedText || ''}`;
        if (preset && !preset.pattern.test(target)) return false;
      }

      return true;
    });
  }, [
    forensicCase.messages,
    query,
    selectedSender,
    selectedCategory,
    selectedReviewStatus,
    semanticConcept,
  ]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF9F6]">
      {/* Search Controls */}
      <div className="px-6 py-4 bg-white border-b border-[#E4E1EE] space-y-3 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#18181B]">Search &amp; Filter</h2>
            <p className="text-xs text-[#64748B]">
              Query messages, extracted entities, senders, triage status, and semantic concepts.
            </p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#EDE9FE] text-[#4C1D95] border border-[#DDD6FE] font-semibold">
            {searchResults.length} matches
          </span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search keywords, vehicle plates, document names, locations, or senders..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg text-xs text-[#18181B] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#F1EFF7]">
          <span className="text-xs text-[#64748B] flex items-center gap-1 font-medium mr-1">
            <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" /> Concepts:
          </span>

          {conceptPresets.map((preset) => {
            const Icon = preset.icon;
            const isActive = semanticConcept === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setSemanticConcept(isActive ? null : preset.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[#EDE9FE] text-[#4C1D95] border-[#C4B5FD]'
                    : 'bg-[#FAF9F6] text-[#52525B] hover:bg-[#F3F1F8] border-[#E4E1EE]'
                }`}
              >
                <Icon className="w-3 h-3" />
                {preset.label}
              </button>
            );
          })}

          {semanticConcept && (
            <button
              onClick={() => setSemanticConcept(null)}
              className="text-xs text-rose-700 hover:underline ml-2 cursor-pointer"
            >
              Clear ×
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={selectedSender}
            onChange={(e) => setSelectedSender(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] text-xs text-[#18181B] focus:outline-none focus:border-[#6D28D9]"
          >
            <option value="ALL">All Participants ({forensicCase.metadata.senders.length})</option>
            {forensicCase.metadata.senders.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] text-xs text-[#18181B] focus:outline-none focus:border-[#6D28D9]"
          >
            <option value="ALL">All Entity Categories</option>
            <option value="Location">Location</option>
            <option value="Vehicle">Vehicle</option>
            <option value="VehiclePlate">Vehicle Plate</option>
            <option value="Object">Object</option>
            <option value="Document">Document</option>
            <option value="Person">Person</option>
            <option value="Weapon">Weapon</option>
            <option value="ContactIdentifier">Contact / Identifier</option>
          </select>

          <select
            value={selectedReviewStatus}
            onChange={(e) => setSelectedReviewStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] text-xs text-[#18181B] focus:outline-none focus:border-[#6D28D9]"
          >
            <option value="ALL">All Review Statuses</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="relevant">Relevant</option>
            <option value="needs_review">Needs Review</option>
            <option value="not_relevant">Benign</option>
          </select>
        </div>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
        {searchResults.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center text-center p-8 bg-white rounded-xl border border-[#E4E1EE]">
            <Search className="w-8 h-8 text-[#94A3B8] mb-2" />
            <p className="text-sm font-medium text-[#3F3F46]">No matching messages found</p>
          </div>
        ) : (
          searchResults.map((msg) => (
            <div
              key={msg.id}
              onClick={() => onOpenMessage(msg.id)}
              className="p-4 rounded-xl bg-white hover:bg-[#FAF8FD] border border-[#E4E1EE] hover:border-[#8B5CF6] cursor-pointer transition-colors space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-[#5B21B6] px-1.5 py-0.5 rounded bg-[#F3F1F8] border border-[#E4E1EE]">
                    #{msg.id}
                  </span>
                  <span className="font-semibold text-[#18181B]">{msg.sender}</span>
                  <span className="text-[#64748B] font-mono text-[11px]">
                    Line {msg.rawLineIndex} · {msg.timestamp}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {msg.flaggedFindings.length > 0 && (() => {
                    const hasCrit = msg.flaggedFindings.some((f) => f.severity === 'critical');
                    const hasElev = msg.flaggedFindings.some((f) => f.severity === 'elevated');
                    const hasNR = msg.flaggedFindings.some((f) => f.severity === 'needs_review');
                    const cls = hasCrit
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : hasElev
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : hasNR
                      ? 'bg-orange-50 text-orange-800 border-orange-300'
                      : 'bg-violet-50 text-violet-700 border-violet-200';
                    return (
                      <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border flex items-center gap-1 ${cls}`}>
                        <ShieldAlert className="w-3 h-3" /> {msg.flaggedFindings.length} flag(s)
                      </span>
                    );
                  })()}
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#F3F1F8] text-[#52525B] border border-[#E4E1EE]">
                    {msg.investigatorStatus}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-[#6D28D9]" />
                </div>
              </div>

              <p className="text-xs text-[#18181B] font-mono bg-[#FAF9F6] p-2.5 rounded border border-[#E4E1EE] leading-relaxed">
                &quot;{msg.text}&quot;
              </p>

              {msg.entities.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {msg.entities.map((ent) => (
                    <span
                      key={ent.id}
                      className="text-[10px] px-2 py-0.5 rounded bg-[#F3F1F8] text-[#4C1D95] border border-[#E4E1EE]"
                    >
                      [{ent.category}] {ent.text}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
