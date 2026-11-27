import React, { useState, useMemo } from 'react';
import {
  Fingerprint,
  Search,
  Car,
  Shield,
  FileText,
  MapPin,
  User,
  Phone,
  Clock,
  Skull,
  ExternalLink,
  Info,
  Package,
  Layers,
} from 'lucide-react';
import { ForensicCase, EntityCategory, AnalysisSource } from '../types/forensics';
import { MethodBadge } from './MethodBadge';

interface EntityExtractionViewProps {
  forensicCase: ForensicCase;
  onOpenMessage: (id: number) => void;
  onToggleEntityVerification?: (entityId: string) => void;
}

export const EntityExtractionView: React.FC<EntityExtractionViewProps> = ({
  forensicCase,
  onOpenMessage,
}) => {
  const [activeViewTab, setActiveViewTab] = useState<'catalog' | 'normalisation'>('catalog');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<'all' | AnalysisSource | 'consensus'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { entities, messages, normalisationGroups = [] } = forensicCase;

  const categoryMeta: Record<
    EntityCategory,
    { label: string; icon: React.FC<{ className?: string }>; color: string }
  > = {
    Person: { label: 'People', icon: User, color: 'text-rose-700' },
    Location: { label: 'Locations', icon: MapPin, color: 'text-emerald-700' },
    Vehicle: { label: 'Vehicles', icon: Car, color: 'text-amber-700' },
    VehiclePlate: { label: 'Plates', icon: Car, color: 'text-[#6D28D9]' },
    Object: { label: 'Objects', icon: Package, color: 'text-sky-700' },
    Document: { label: 'Documents', icon: FileText, color: 'text-indigo-700' },
    Weapon: { label: 'Weapons', icon: Shield, color: 'text-rose-700' },
    Violence: { label: 'Violence', icon: Skull, color: 'text-red-700' },
    DateTime: { label: 'Dates/Times', icon: Clock, color: 'text-teal-700' },
    ContactIdentifier: { label: 'Contacts/IDs', icon: Phone, color: 'text-purple-700' },
  };

  const categories = Object.keys(categoryMeta) as EntityCategory[];

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: entities.length };
    categories.forEach((c) => (counts[c] = 0));
    entities.forEach((e) => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, [entities, categories]);

  const sourceCounts = useMemo(() => {
    return {
      all: entities.length,
      rule: entities.filter((e) => e.sources?.includes('rule')).length,
      nlp: entities.filter((e) => e.sources?.includes('nlp')).length,
      ai: entities.filter((e) => e.sources?.includes('ai')).length,
      consensus: entities.filter(
        (e) => e.consensus === 'hybrid_consensus' || (e.sources && e.sources.length > 1)
      ).length,
    };
  }, [entities]);

  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
      if (selectedSource === 'rule' && !e.sources?.includes('rule')) return false;
      if (selectedSource === 'nlp' && !e.sources?.includes('nlp')) return false;
      if (selectedSource === 'ai' && !e.sources?.includes('ai')) return false;
      if (
        selectedSource === 'consensus' &&
        !(e.consensus === 'hybrid_consensus' || (e.sources && e.sources.length > 1))
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesText = e.text.toLowerCase().includes(q);
        const matchesMethod = e.method.toLowerCase().includes(q);
        const matchesDetails = (e.details || '').toLowerCase().includes(q);
        if (!matchesText && !matchesMethod && !matchesDetails) return false;
      }
      return true;
    });
  }, [entities, selectedCategory, selectedSource, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF9F6]">
      {/* Mode Header */}
      <div className="px-6 py-3.5 bg-white border-b border-[#E4E1EE] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-sm font-bold text-[#18181B]">
            Extracted Entities &amp; Candidate Normalisation
          </h2>
          <p className="text-xs text-[#64748B]">
            Structured indicators traceable to source messages and extraction methods.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#F3F1F8] rounded-lg border border-[#E4E1EE]">
          <button
            onClick={() => setActiveViewTab('catalog')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeViewTab === 'catalog'
                ? 'bg-white text-[#4C1D95] border border-[#DDD6FE]'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            Entity Catalog ({entities.length})
          </button>
          <button
            onClick={() => setActiveViewTab('normalisation')}
            className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeViewTab === 'normalisation'
                ? 'bg-white text-[#4C1D95] border border-[#DDD6FE]'
                : 'text-[#52525B] hover:text-[#18181B]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Normalisation Groups ({normalisationGroups.length})
          </button>
        </div>
      </div>

      {activeViewTab === 'normalisation' ? (
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="p-3.5 rounded-lg bg-[#F3F1F8] border border-[#DDD6FE] flex items-start gap-2.5 text-xs text-[#3F3F46]">
            <Info className="w-4 h-4 text-[#6D28D9] shrink-0 mt-0.5" />
            <span>
              Alternative expressions (e.g. &quot;white Swift&quot;, &quot;the Swift&quot;) are grouped as candidate aliases for manual verification without altering original text.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {normalisationGroups.map((group, gIdx) => (
              <div
                key={group.groupId}
                className="p-4 rounded-xl bg-white border border-[#E4E1EE] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-[#EDE9FE] text-[#4C1D95] border border-[#DDD6FE]">
                      {group.category}
                    </span>
                    <span className="text-xs font-mono text-[#64748B]">Group #{gIdx + 1}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-[#18181B]">
                    {group.variants.length} mentions
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-[#18181B] font-mono">
                    {group.canonicalName}
                  </h4>
                  <p className="text-[11px] text-[#64748B] font-mono">{group.groupId}</p>
                </div>

                <div className="space-y-1.5 pt-1">
                  {group.variants.map((variant, vIdx) => {
                    const msg = messages.find((m) => m.id === variant.messageId);
                    return (
                      <div
                        key={vIdx}
                        onClick={() => onOpenMessage(variant.messageId)}
                        className="p-2 rounded-lg bg-[#FAF9F6] hover:bg-[#F3F1F8] border border-[#E4E1EE] cursor-pointer transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-semibold text-[#18181B] truncate">
                            &quot;{variant.text}&quot;
                          </span>
                          <span className="text-[11px] text-[#64748B] shrink-0">
                            by {msg?.sender || 'Participant'}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-[#6D28D9] flex items-center gap-1 shrink-0">
                          Msg #{variant.messageId}
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="px-6 py-3.5 bg-white border-b border-[#E4E1EE] space-y-3 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search entities, methods, or details..."
                  className="w-full bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#18181B] placeholder-[#94A3B8] focus:outline-none focus:border-[#6D28D9]"
                />
              </div>

              <div className="flex items-center gap-1 bg-[#F3F1F8] p-1 rounded-lg border border-[#E4E1EE]">
                {[
                  { id: 'all', label: `All (${sourceCounts.all})` },
                  { id: 'rule', label: `Rule (${sourceCounts.rule})` },
                  { id: 'nlp', label: `NLP (${sourceCounts.nlp})` },
                  { id: 'ai', label: `AI (${sourceCounts.ai})` },
                  { id: 'consensus', label: `Consensus (${sourceCounts.consensus})` },
                ].map((src) => (
                  <button
                    key={src.id}
                    onClick={() => setSelectedSource(src.id as any)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      selectedSource === src.id
                        ? 'bg-white text-[#4C1D95] border border-[#DDD6FE] font-semibold'
                        : 'text-[#52525B] hover:text-[#18181B]'
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-[#EDE9FE] text-[#4C1D95] border-[#C4B5FD]'
                    : 'text-[#52525B] hover:text-[#18181B] bg-[#FAF9F6] border-[#E4E1EE]'
                }`}
              >
                All ({entities.length})
              </button>
              {categories.map((cat) => {
                const count = categoryCounts[cat] || 0;
                const meta = categoryMeta[cat];
                const Icon = meta.icon;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#EDE9FE] text-[#4C1D95] border-[#C4B5FD]'
                        : 'text-[#52525B] hover:text-[#18181B] bg-[#FAF9F6] border-[#E4E1EE]'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                    <span>{meta.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Entity Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {filteredEntities.length === 0 ? (
              <div className="p-12 text-center text-[#64748B] bg-white rounded-xl border border-[#E4E1EE]">
                <p className="text-sm font-medium text-[#3F3F46]">
                  No entities matched your current filter or search query.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredEntities.map((ent) => {
                  const msg = messages.find((m) => m.id === ent.messageId);
                  const meta = categoryMeta[ent.category];
                  const Icon = meta?.icon || Fingerprint;

                  return (
                    <div
                      key={ent.id}
                      onClick={() => onOpenMessage(ent.messageId)}
                      className="p-4 rounded-xl bg-white border border-[#E4E1EE] hover:border-[#8B5CF6] cursor-pointer transition-colors flex flex-col justify-between group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-[#18181B]">
                            <Icon className={`w-3.5 h-3.5 ${meta?.color || 'text-[#6D28D9]'}`} />
                            <span>{ent.category}</span>
                          </span>
                          <MethodBadge
                            sources={ent.sources}
                            consensus={ent.consensus}
                            size="xs"
                          />
                        </div>

                        <div className="p-2.5 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] font-mono text-sm text-[#18181B] font-semibold break-all">
                          {ent.text}
                        </div>

                        <p className="text-[11px] text-[#64748B]">
                          Method: <span className="text-[#18181B] font-medium">{ent.method}</span>
                        </p>
                        {ent.details && (
                          <p className="text-[11px] text-[#52525B] italic">{ent.details}</p>
                        )}
                      </div>

                      <div className="pt-2.5 mt-3 border-t border-[#F1EFF7] flex items-center justify-between text-[11px] text-[#64748B]">
                        <span className="truncate max-w-[200px]">
                          Line {msg?.rawLineIndex} · {msg?.sender}
                        </span>
                        <span className="text-[#6D28D9] font-medium flex items-center gap-1">
                          View <ExternalLink className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
