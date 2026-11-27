import React, { useState } from 'react';
import { FileCheck2, Download, Info, Sliders } from 'lucide-react';
import { ForensicCase } from '../types/forensics';
import { generateForensicPDF, loadPdfFonts, ReportSectionConfig } from '../utils/pdfGenerator';
import { formatBytes } from '../utils/hashHelper';

interface ForensicReportViewProps {
  forensicCase: ForensicCase;
}

export const ForensicReportView: React.FC<ForensicReportViewProps> = ({ forensicCase }) => {
  const [examinerName, setExaminerName] = useState('Senior Forensics Examiner');
  const [agencyName, setAgencyName] = useState('Digital Evidence Investigation Lab');
  const [isGenerating, setIsGenerating] = useState(false);

  const [config, setConfig] = useState<ReportSectionConfig>({
    includeCaseOverview: true,
    includeEntities: true,
    includeFindings: true,
    includeCorrelations: true,
    includeEvents: true,
    includeDisclaimer: true,
  });

  const { metadata, entities, findings, correlations = [], events = [] } = forensicCase;

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const fontBundle = await loadPdfFonts();
      const doc = generateForensicPDF(forensicCase, config, fontBundle);
      const cleanName = metadata.filename.replace(/\.[^/.]+$/, '');
      doc.save(`ForenText-Report-${cleanName}.pdf`);
    } finally {
      setIsGenerating(false);
    }
  };

  const categories = Array.from(new Set(entities.map((e) => e.category))).sort();

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 max-w-5xl mx-auto space-y-5 bg-[#FAF9F6]">
      {/* Action Header */}
      <div className="p-5 rounded-xl bg-white border border-[#E4E1EE] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#18181B] flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-[#6D28D9]" />
            Forensic PDF Investigation Report
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Multi-page evidence dossier with SHA-256 hash custody, extracted entities, correlations, and event clusters.
          </p>
        </div>

        <button
          disabled={isGenerating}
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#6D28D9] hover:bg-[#5B21B6] transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
        >
          <Download className="w-4 h-4 text-white" />
          <span>{isGenerating ? 'Generating PDF...' : 'Download Official PDF Report'}</span>
        </button>
      </div>

      {/* Section Configurator */}
      <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#18181B]">
          <Sliders className="w-3.5 h-3.5 text-[#6D28D9]" />
          <span>Include Report Sections</span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[#3F3F46]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeCaseOverview}
              onChange={(e) => setConfig({ ...config, includeCaseOverview: e.target.checked })}
              className="accent-[#6D28D9] rounded"
            />
            <span>Case Overview &amp; Hash</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeEntities}
              onChange={(e) => setConfig({ ...config, includeEntities: e.target.checked })}
              className="accent-[#6D28D9] rounded"
            />
            <span>Entities ({entities.length})</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeFindings}
              onChange={(e) => setConfig({ ...config, includeFindings: e.target.checked })}
              className="accent-[#6D28D9] rounded"
            />
            <span>Findings ({findings.length})</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeCorrelations}
              onChange={(e) => setConfig({ ...config, includeCorrelations: e.target.checked })}
              className="accent-[#6D28D9] rounded"
            />
            <span>Correlations ({correlations.length})</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeEvents}
              onChange={(e) => setConfig({ ...config, includeEvents: e.target.checked })}
              className="accent-[#6D28D9] rounded"
            />
            <span>Possible Events ({events.length})</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={config.includeDisclaimer}
              onChange={(e) => setConfig({ ...config, includeDisclaimer: e.target.checked })}
              className="accent-[#6D28D9] rounded"
            />
            <span>Disclaimer &amp; Signature</span>
          </label>
        </div>
      </div>

      {/* Paper Preview */}
      <div className="bg-white border border-[#E4E1EE] rounded-xl overflow-hidden text-xs text-[#27272A]">
        <div className="p-7 bg-[#FAF9F6] border-b border-[#E4E1EE] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-[#18181B]">
                Foren<span className="text-[#6D28D9]">Text</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#EDE9FE] text-[#4C1D95] border border-[#DDD6FE]">
                CASE REF: FT-{metadata.sha256.substring(0, 8).toUpperCase()}
              </span>
            </div>
            <p className="text-xs font-semibold text-[#3F3F46]">
              INTEGRATED MESSAGING FORENSICS AND EVIDENCE AUDIT REPORT
            </p>
            <p className="text-[11px] text-[#64748B]">
              Generated: {new Date().toLocaleString()} · ISO/IEC 27037 Hash Custody
            </p>
          </div>

          <div className="text-right space-y-1.5 shrink-0">
            <span className="text-[10px] uppercase font-bold text-[#6D28D9] tracking-wider block">
              Examiner &amp; Laboratory
            </span>
            <input
              type="text"
              value={examinerName}
              onChange={(e) => setExaminerName(e.target.value)}
              className="bg-white border border-[#E4E1EE] rounded px-2.5 py-1 text-right text-xs text-[#18181B] font-medium block w-full"
            />
            <input
              type="text"
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              className="bg-white border border-[#E4E1EE] rounded px-2.5 py-1 text-right text-[11px] text-[#52525B] block w-full"
            />
          </div>
        </div>

        <div className="p-7 space-y-6">
          {/* Section 1 */}
          <div>
            <h3 className="text-xs font-bold text-[#4C1D95] uppercase tracking-wider mb-3">
              1. Digital Evidence Custody &amp; Hashing
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FAF9F6] p-4 rounded-lg border border-[#E4E1EE]">
              <div className="space-y-1 font-mono text-[11px]">
                <p>
                  <span className="text-[#64748B]">Filename:</span>{' '}
                  <span className="text-[#18181B] font-semibold">{metadata.filename}</span>
                </p>
                <p>
                  <span className="text-[#64748B]">File Size:</span>{' '}
                  <span className="text-[#18181B]">
                    {formatBytes(metadata.fileSizeBytes)} ({metadata.fileSizeBytes} bytes)
                  </span>
                </p>
                <p>
                  <span className="text-[#64748B]">Parsed At:</span>{' '}
                  <span className="text-[#18181B]">
                    {new Date(metadata.parsedAt).toLocaleString()}
                  </span>
                </p>
              </div>

              <div className="space-y-1 font-mono text-[11px]">
                <p>
                  <span className="text-[#64748B]">Engine:</span>{' '}
                  <span className="text-[#4C1D95] font-semibold">ForenText Analysis Engine</span>
                </p>
                <p>
                  <span className="text-[#64748B]">Records:</span>{' '}
                  <span className="text-[#18181B] font-semibold">
                    {metadata.totalMessages} messages ({metadata.totalLines} lines)
                  </span>
                </p>
                <p>
                  <span className="text-[#64748B]">Date Horizon:</span>{' '}
                  <span className="text-[#18181B]">
                    {metadata.dateRange.start} → {metadata.dateRange.end}
                  </span>
                </p>
              </div>

              <div className="col-span-1 md:col-span-2 pt-2 border-t border-[#E4E1EE]">
                <span className="text-[10px] text-[#64748B] uppercase font-bold block mb-1">
                  SHA-256 Digest
                </span>
                <p className="font-mono text-xs text-[#18181B] break-all select-all bg-white p-2 rounded border border-[#E4E1EE]">
                  {metadata.sha256}
                </p>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div>
            <h3 className="text-xs font-bold text-[#4C1D95] uppercase tracking-wider mb-3">
              2. Summary Metrics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Messages', val: metadata.totalMessages },
                { label: 'Findings', val: findings.length },
                { label: 'Entities', val: entities.length },
                { label: 'Correlations', val: correlations.length },
                { label: 'Events', val: events.length },
              ].map((m) => (
                <div
                  key={m.label}
                  className="p-3 bg-[#FAF9F6] rounded-lg border border-[#E4E1EE] text-center"
                >
                  <p className="text-[10px] text-[#64748B] uppercase">{m.label}</p>
                  <p className="text-lg font-bold text-[#18181B] font-mono">{m.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 */}
          <div>
            <h3 className="text-xs font-bold text-[#4C1D95] uppercase tracking-wider mb-3">
              3. Extracted Entities
            </h3>
            <div className="space-y-2.5">
              {categories.map((cat) => {
                const items = entities.filter((e) => e.category === cat);
                const uniqueTexts = Array.from(new Set(items.map((i) => i.text)));
                return (
                  <div
                    key={cat}
                    className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE]"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-[#4C1D95]">{cat}</span>
                      <span className="text-[10px] font-mono text-[#64748B]">
                        {items.length} occurrences
                      </span>
                    </div>
                    <p className="font-mono text-xs text-[#18181B]">
                      {uniqueTexts.join('  ·  ')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 4 */}
          {correlations.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-[#4C1D95] uppercase tracking-wider mb-3">
                4. Message Correlations Preview
              </h3>
              <div className="space-y-2">
                {correlations.slice(0, 5).map((corr, idx) => (
                  <div
                    key={corr.id}
                    className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-semibold text-[#4C1D95]">
                        Corr #{idx + 1} | {corr.correlationType.toUpperCase()} | Msg #
                        {corr.sourceMessageId} ↔ Msg #{corr.targetMessageId}
                      </span>
                      <span className="font-mono text-[#64748B]">
                        Δ {corr.timeDeltaMinutes} min
                      </span>
                    </div>
                    <p className="text-xs text-[#18181B]">{corr.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 5 */}
          {events.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-[#4C1D95] uppercase tracking-wider mb-3">
                5. Possible Event Clusters
              </h3>
              <div className="space-y-2">
                {events.map((ev, idx) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E4E1EE] space-y-1"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-semibold text-[#18181B]">
                        Possible Event #{idx + 1}: {ev.title}
                      </span>
                      <span className="font-mono text-[#64748B]">
                        {ev.stages.length} Stages · {ev.participants.join(', ')}
                      </span>
                    </div>
                    <p className="text-xs text-[#52525B]">{ev.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 6: Mandatory Forensic Disclaimer */}
          <div className="p-4 rounded-lg bg-[#F3F1F8] border border-[#DDD6FE] space-y-1.5">
            <h4 className="text-xs font-bold text-[#4C1D95] uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#6D28D9]" />
              6. Forensic Limitations &amp; Verification Mandate
            </h4>
            <div className="text-[11px] text-[#3F3F46] space-y-1 leading-relaxed">
              <p>
                • Automated findings generated by ForenText are preliminary investigative indicators intended solely to assist human examiners during triage.
              </p>
              <p>
                • Vehicle registration patterns, locations, and personal identifiers require official RTO/telecom verification.
              </p>
              <p>
                • Sensitive keyword matches do not establish criminal intent; surrounding context must be manually reviewed by a qualified investigator.
              </p>
            </div>
          </div>

          {/* Attestation */}
          <div className="pt-4 border-t border-[#E4E1EE] grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs text-[#64748B]">
            <div className="space-y-2">
              <p className="font-semibold text-[#18181B]">Examiner Attestation:</p>
              <div className="border-b border-[#D4CFE2] pb-1.5 text-[#18181B] font-mono">
                {examinerName}
              </div>
              <p className="text-[10px]">Verified against SHA-256 hash at extraction time.</p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-[#18181B]">Laboratory Jurisdiction:</p>
              <div className="border-b border-[#D4CFE2] pb-1.5 text-[#18181B] font-mono">
                {agencyName}
              </div>
              <p className="text-[10px]">Status: Triage Report Complete</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
