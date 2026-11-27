import React, { useState, useMemo } from 'react';
import { Calendar, Clock, Moon } from 'lucide-react';
import { ForensicCase } from '../types/forensics';

interface TimelineAnalysisViewProps {
  forensicCase: ForensicCase;
  onOpenMessage: (id: number) => void;
}

export const TimelineAnalysisView: React.FC<TimelineAnalysisViewProps> = ({
  forensicCase,
  onOpenMessage,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [selectedSender, setSelectedSender] = useState<string>('all');

  const { messages, metadata } = forensicCase;

  const dateCounts: Record<string, number> = useMemo(() => {
    const counts: Record<string, number> = {};
    messages.forEach((m) => {
      if (m.dateStr) counts[m.dateStr] = (counts[m.dateStr] || 0) + 1;
    });
    return counts;
  }, [messages]);

  const sortedDates = Object.keys(dateCounts).sort();
  const maxDateCount = Math.max(...Object.values(dateCounts), 1);

  const hourlyCounts: number[] = useMemo(() => {
    const counts = new Array(24).fill(0);
    messages.forEach((m) => {
      const h = m.hour >= 0 && m.hour < 24 ? m.hour : 0;
      counts[h] += 1;
    });
    return counts;
  }, [messages]);

  const maxHourCount = Math.max(...hourlyCounts, 1);

  const peakDate = sortedDates.reduce(
    (max, d) => (dateCounts[d] > (dateCounts[max] || 0) ? d : max),
    sortedDates[0] || 'N/A'
  );

  let peakHour = 0;
  let peakHourMax = 0;
  hourlyCounts.forEach((c, h) => {
    if (c > peakHourMax) {
      peakHourMax = c;
      peakHour = h;
    }
  });

  const nightMessages = messages.filter((m) => m.hour >= 22 || m.hour <= 5);

  const timelineMessages = useMemo(() => {
    return messages.filter((m) => {
      if (selectedDate !== 'all' && m.dateStr !== selectedDate) return false;
      if (selectedSender !== 'all' && m.sender !== selectedSender) return false;
      return true;
    });
  }, [messages, selectedDate, selectedSender]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 space-y-5 max-w-7xl mx-auto bg-[#FAF9F6]">
      {/* Peak Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] flex items-center justify-between">
          <div>
            <p className="text-xs text-[#64748B]">Peak Activity Date</p>
            <p className="text-lg font-bold text-[#18181B] font-mono mt-0.5">{peakDate}</p>
            <p className="text-[11px] text-[#6D28D9] font-mono">
              {dateCounts[peakDate] || 0} messages recorded
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-[#EDE9FE] text-[#6D28D9]">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] flex items-center justify-between">
          <div>
            <p className="text-xs text-[#64748B]">Peak Activity Hour</p>
            <p className="text-lg font-bold text-[#18181B] font-mono mt-0.5">
              {peakHour.toString().padStart(2, '0')}:00 –{' '}
              {(peakHour + 1).toString().padStart(2, '0')}:00
            </p>
            <p className="text-[11px] text-amber-800 font-mono">
              {peakHourMax} messages ({Math.round((peakHourMax / Math.max(messages.length, 1)) * 100)}%)
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-700">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] flex items-center justify-between">
          <div>
            <p className="text-xs text-[#64748B]">Night-Time Messages</p>
            <p className="text-lg font-bold text-[#18181B] font-mono mt-0.5">
              {nightMessages.length} msgs
            </p>
            <p className="text-[11px] text-rose-700 font-mono">22:00 – 05:00 window</p>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700">
            <Moon className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Daily Volume Chart */}
      <div className="p-5 rounded-xl bg-white border border-[#E4E1EE] space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#18181B] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#6D28D9]" />
              Daily Message Volume
            </h3>
            <p className="text-xs text-[#64748B]">Click a date bar to filter the chronological log below</p>
          </div>

          <button
            onClick={() => setSelectedDate('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
              selectedDate === 'all'
                ? 'bg-[#EDE9FE] text-[#4C1D95] border-[#C4B5FD]'
                : 'text-[#52525B] hover:text-[#18181B] bg-[#FAF9F6] border-[#E4E1EE]'
            }`}
          >
            All Dates ({messages.length})
          </button>
        </div>

        <div className="flex items-end gap-2.5 min-h-[160px] pt-4 pb-2 border-b border-[#E4E1EE]">
          {sortedDates.map((date) => {
            const count = dateCounts[date];
            const heightPercent = Math.max((count / maxDateCount) * 100, 12);
            const isSelected = selectedDate === date;

            return (
              <div
                key={date}
                onClick={() => setSelectedDate(isSelected ? 'all' : date)}
                className="flex-1 flex flex-col items-center gap-1.5 cursor-pointer group"
              >
                <span
                  className={`text-[10px] font-mono tabular-nums ${
                    isSelected ? 'text-amber-700 font-bold' : 'text-[#5B21B6]'
                  }`}
                >
                  {count}
                </span>
                <div className="w-full bg-[#F3F1F8] rounded-t relative flex items-end overflow-hidden h-32">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t transition-colors ${
                      isSelected ? 'bg-amber-500' : 'bg-[#7C3AED] group-hover:bg-[#6D28D9]'
                    }`}
                  />
                </div>
                <span
                  className={`text-[10px] font-mono truncate max-w-[80px] ${
                    isSelected ? 'text-[#18181B] font-semibold' : 'text-[#64748B]'
                  }`}
                >
                  {date}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hourly Distribution */}
      <div className="p-5 rounded-xl bg-white border border-[#E4E1EE] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#18181B] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#6D28D9]" />
              24-Hour Distribution
            </h3>
            <p className="text-xs text-[#64748B]">Message volume across each hour of the day</p>
          </div>
          <span className="text-xs text-[#64748B] font-mono">00:00 – 23:59</span>
        </div>

        <div className="flex items-end gap-1.5 min-h-[130px] pt-4 pb-2 border-b border-[#E4E1EE] overflow-x-auto">
          {hourlyCounts.map((count, hour) => {
            const heightPercent = count > 0 ? Math.max((count / maxHourCount) * 100, 8) : 2;
            const isNight = hour >= 22 || hour <= 5;
            const isPeak = hour === peakHour;

            return (
              <div key={hour} className="flex-1 min-w-[24px] flex flex-col items-center gap-1 group">
                <span className="text-[9px] font-mono text-[#64748B] opacity-0 group-hover:opacity-100 transition-opacity">
                  {count}
                </span>
                <div className="w-full bg-[#F3F1F8] rounded-t-sm relative flex items-end h-24">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full rounded-t-sm transition-colors ${
                      isPeak
                        ? 'bg-amber-500'
                        : isNight
                        ? 'bg-rose-400'
                        : 'bg-[#7C3AED]'
                    }`}
                  />
                </div>
                <span className="text-[9px] font-mono text-[#64748B]">
                  {hour.toString().padStart(2, '0')}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#7C3AED]" /> Standard Hours
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Off-Hours (22:00–05:00)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Peak Hour
          </span>
        </div>
      </div>

      {/* Chronological Log */}
      <div className="p-5 rounded-xl bg-white border border-[#E4E1EE] space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#18181B]">
              Chronological Log ({timelineMessages.length} Messages)
            </h3>
            <p className="text-xs text-[#64748B]">
              {selectedDate !== 'all' ? `Filtered to ${selectedDate}` : 'All dates'}
            </p>
          </div>

          <select
            value={selectedSender}
            onChange={(e) => setSelectedSender(e.target.value)}
            className="bg-[#FAF9F6] border border-[#E4E1EE] rounded-lg px-2.5 py-1 text-xs text-[#18181B]"
          >
            <option value="all">All Senders</option>
            {metadata.senders.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {timelineMessages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => onOpenMessage(msg.id)}
              className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] hover:border-[#8B5CF6] cursor-pointer transition-colors flex items-start justify-between gap-3 text-xs"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[#6D28D9] font-semibold">{msg.timestamp}</span>
                  <span className="font-semibold text-[#18181B]">{msg.sender}</span>
                  <span className="text-[10px] font-mono text-[#64748B]">
                    Line {msg.rawLineIndex}
                  </span>
                </div>
                <p className="font-mono text-[#27272A] whitespace-pre-wrap">{msg.text}</p>
              </div>

              {msg.flaggedFindings.length > 0 && (() => {
                const hasCrit = msg.flaggedFindings.some((f) => f.severity === 'critical');
                const hasElev = msg.flaggedFindings.some((f) => f.severity === 'elevated');
                const hasNeedsReview = msg.flaggedFindings.some((f) => f.severity === 'needs_review');
                const badgeClass = hasCrit
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : hasElev
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : hasNeedsReview
                  ? 'bg-orange-50 text-orange-800 border-orange-300'
                  : 'bg-violet-50 text-violet-700 border-violet-200';
                const badgeText = hasCrit
                  ? 'High'
                  : hasElev
                  ? 'Medium'
                  : hasNeedsReview
                  ? 'Needs Review'
                  : 'Contextual';
                return (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${badgeClass}`}>
                    {badgeText}
                  </span>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
