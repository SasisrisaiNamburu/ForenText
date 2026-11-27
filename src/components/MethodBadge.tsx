import React from 'react';
import { AnalysisSource, MethodConsensus } from '../types/forensics';
import { Sparkles, Cpu, CheckCircle2, AlertTriangle, Shield } from 'lucide-react';

interface MethodBadgeProps {
  sources?: AnalysisSource[];
  consensus?: MethodConsensus;
  disagreementNote?: string;
  showDetails?: boolean;
  size?: 'xs' | 'sm';
}

export const MethodBadge: React.FC<MethodBadgeProps> = ({
  sources = [],
  consensus,
  disagreementNote,
  showDetails = false,
}) => {
  const activeSources = sources || [];
  return (
    <div className="inline-flex flex-wrap items-center gap-1 text-[10px] font-mono">
      {activeSources.includes('rule') && (
        <span
          className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 flex items-center gap-1 font-medium"
          title="Extracted via deterministic Rule / Keyword engine"
        >
          <Shield className="w-2.5 h-2.5 text-sky-600" />
          RULE
        </span>
      )}

      {activeSources.includes('nlp') && (
        <span
          className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-800 border border-violet-200 flex items-center gap-1 font-medium"
          title="Extracted via NLP syntactic & lexical heuristics"
        >
          <Cpu className="w-2.5 h-2.5 text-violet-600" />
          NLP
        </span>
      )}

      {activeSources.includes('ai') && (
        <span
          className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 font-semibold"
          title="Contextual AI analysis identified indirect reference or intent"
        >
          <Sparkles className="w-2.5 h-2.5 text-amber-600" />
          AI
        </span>
      )}

      {consensus === 'hybrid_consensus' && (
        <span
          className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 font-medium"
          title="Agreement between multiple extraction approaches"
        >
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
          CONSENSUS
        </span>
      )}

      {consensus === 'method_disagreement' && (
        <span
          className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1 font-semibold"
          title="Disagreement identified between Keyword and Contextual AI"
        >
          <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
          DISAGREEMENT
        </span>
      )}

      {showDetails && disagreementNote && (
        <div className="w-full mt-1 p-2 rounded bg-rose-50 border border-rose-200 text-rose-900 text-[11px] leading-relaxed font-sans">
          <strong>Method Discrepancy:</strong> {disagreementNote}
        </div>
      )}
    </div>
  );
};
