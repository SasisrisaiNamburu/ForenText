import React, { useState } from 'react';
import {
  Users,
  MapPin,
  Car,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { ForensicCase } from '../types/forensics';
import { MethodBadge } from './MethodBadge';

interface EventAnalysisViewProps {
  forensicCase: ForensicCase;
  onOpenMessage: (id: number) => void;
  onUpdateEventStatus?: (
    eventId: string,
    status: 'suggested' | 'confirmed' | 'rejected'
  ) => void;
}

export const EventAnalysisView: React.FC<EventAnalysisViewProps> = ({
  forensicCase,
  onOpenMessage,
  onUpdateEventStatus,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(
    forensicCase.events?.[0]?.id || ''
  );

  const events = forensicCase.events || [];
  const activeEvent = events.find((e) => e.id === selectedEventId) || events[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#FAF9F6]">
      {/* Header */}
      <div className="px-6 py-3.5 bg-white border-b border-[#E4E1EE] shrink-0">
        <h2 className="text-sm font-bold text-[#18181B]">
          Possible Event Clusters ({events.length})
        </h2>
        <p className="text-xs text-[#64748B]">
          Preliminary event hypotheses grouped strictly from shared specific entities and verified correlations within this file.
        </p>
      </div>

      {/* Split Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left List */}
        <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-[#E4E1EE] overflow-y-auto p-4 space-y-2.5 bg-[#F7F6FA]">
          {events.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#64748B] bg-white rounded-xl border border-[#E4E1EE]">
              No multi-message event clusters generated for this file.
            </div>
          ) : (
            events.map((ev, idx) => {
              const isSelected = activeEvent?.id === ev.id;
              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-colors space-y-2 ${
                    isSelected
                      ? 'bg-[#F3EFFC] border-[#8B5CF6]'
                      : 'bg-white border-[#E4E1EE] hover:border-[#C4B5FD]'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-[#6D28D9]">
                      Possible Event #{idx + 1}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border ${
                        ev.status === 'confirmed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : ev.status === 'rejected'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-[#FAF9F6] text-[#52525B] border-[#E4E1EE]'
                      }`}
                    >
                      {ev.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-[#18181B] leading-snug">
                    {ev.title}
                  </h4>

                  <p className="text-xs text-[#52525B] line-clamp-2 leading-relaxed">
                    {ev.summary}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1.5 border-t border-[#F1EFF7]">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {ev.stages.length} stages
                    </span>
                    <span className="font-mono text-[#4C1D95]">
                      {ev.participants.length} participants
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Detail Pane */}
        {activeEvent ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#FAF9F6]">
            <div className="p-5 rounded-xl bg-white border border-[#E4E1EE] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-semibold text-[#4C1D95] px-2 py-0.5 rounded bg-[#EDE9FE] border border-[#DDD6FE]">
                      POSSIBLE EVENT
                    </span>
                    <MethodBadge sources={activeEvent.sources} size="xs" />
                    <span className="text-xs font-mono text-[#64748B]">
                      {activeEvent.id} · {activeEvent.messageIds.map((id) => `#${id}`).join(', ')}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#18181B] mt-1.5">
                    {activeEvent.title}
                  </h3>
                </div>

                {onUpdateEventStatus && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onUpdateEventStatus(activeEvent.id, 'confirmed')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        activeEvent.status === 'confirmed'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-[#FAF9F6] text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Confirm
                    </button>
                    <button
                      onClick={() => onUpdateEventStatus(activeEvent.id, 'rejected')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        activeEvent.status === 'rejected'
                          ? 'bg-rose-50 text-rose-800 border-rose-300'
                          : 'bg-[#FAF9F6] text-[#52525B] border-[#E4E1EE] hover:bg-[#F3F1F8]'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                      Reject
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-[#27272A] leading-relaxed">{activeEvent.summary}</p>

              {/* Involved Entities */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#F1EFF7]">
                <div className="flex items-center gap-1 text-xs text-[#64748B] mr-1">
                  <Users className="w-3.5 h-3.5 text-[#6D28D9]" />
                  <span>Participants:</span>
                </div>
                {activeEvent.participants.map((p) => (
                  <span
                    key={p}
                    className="text-xs px-2 py-0.5 rounded bg-[#EDE9FE] text-[#4C1D95] border border-[#DDD6FE] font-medium"
                  >
                    {p}
                  </span>
                ))}

                {activeEvent.locations.length > 0 && (
                  <>
                    <div className="flex items-center gap-1 text-xs text-[#64748B] ml-2 mr-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Locations:</span>
                    </div>
                    {activeEvent.locations.map((loc) => (
                      <span
                        key={loc}
                        className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium"
                      >
                        {loc}
                      </span>
                    ))}
                  </>
                )}

                {activeEvent.vehicles.length > 0 && (
                  <>
                    <div className="flex items-center gap-1 text-xs text-[#64748B] ml-2 mr-1">
                      <Car className="w-3.5 h-3.5 text-amber-700" />
                      <span>Vehicles:</span>
                    </div>
                    {activeEvent.vehicles.map((v) => (
                      <span
                        key={v}
                        className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium"
                      >
                        {v}
                      </span>
                    ))}
                  </>
                )}

                {activeEvent.objects.length > 0 && (
                  <>
                    <div className="flex items-center gap-1 text-xs text-[#64748B] ml-2 mr-1">
                      <Package className="w-3.5 h-3.5 text-sky-700" />
                      <span>Objects:</span>
                    </div>
                    {activeEvent.objects.map((obj) => (
                      <span
                        key={obj}
                        className="text-xs px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-medium"
                      >
                        {obj}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Chronological Stages */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#52525B] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#6D28D9]" />
                  Chronological Sequence ({activeEvent.stages.length} Steps)
                </h4>
                <span className="text-xs font-mono text-[#64748B]">
                  {activeEvent.timeRange.start} → {activeEvent.timeRange.end}
                </span>
              </div>

              <div className="relative pl-6 space-y-3 before:content-[''] before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#DDD6FE]">
                {activeEvent.stages.map((stage) => {
                  const parentMsg = forensicCase.messages.find((m) => m.id === stage.messageId);

                  return (
                    <div
                      key={stage.stageNumber}
                      className="relative p-4 rounded-xl bg-white border border-[#E4E1EE] hover:border-[#C4B5FD] transition-colors space-y-2"
                    >
                      <div className="absolute -left-[27px] top-4 w-5 h-5 rounded-full bg-[#EDE9FE] border border-[#6D28D9] flex items-center justify-center text-[10px] font-bold text-[#4C1D95]">
                        {stage.stageNumber}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#4C1D95]">{stage.title}</span>
                          <span className="text-[#94A3B8]">·</span>
                          <span className="font-semibold text-[#18181B]">{stage.sender}</span>
                        </div>
                        <span className="font-mono text-[#64748B] text-[11px]">
                          Msg #{stage.messageId} · {stage.timestamp}
                        </span>
                      </div>

                      <p className="text-xs text-[#18181B] font-mono bg-[#FAF9F6] p-2.5 rounded border border-[#E4E1EE] leading-relaxed">
                        &quot;{stage.description}&quot;
                      </p>

                      <div className="flex items-center justify-between pt-1">
                        {parentMsg && parentMsg.entities.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {parentMsg.entities.slice(0, 3).map((ent) => (
                              <span
                                key={ent.id}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F1F8] text-[#4C1D95] border border-[#E4E1EE]"
                              >
                                {ent.text}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div />
                        )}

                        <button
                          onClick={() => onOpenMessage(stage.messageId)}
                          className="text-[11px] text-[#6D28D9] hover:text-[#4C1D95] flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <ExternalLink className="w-3 h-3" /> Inspect Message
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-[#64748B]">
            Select an event cluster to inspect its stages.
          </div>
        )}
      </div>
    </div>
  );
};
