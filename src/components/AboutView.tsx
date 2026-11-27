import React from 'react';
import {
  Shield,
  Lock,
  GitMerge,
  Layers,
  Sparkles,
} from 'lucide-react';

export const AboutView: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-6 lg:p-8 max-w-5xl mx-auto space-y-6 text-[#18181B] bg-[#FAF9F6]">
      {/* Overview Card */}
      <div className="p-6 rounded-xl bg-white border border-[#E4E1EE] space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6D28D9] flex items-center justify-center text-white shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#18181B]">
              Foren<span className="text-[#6D28D9]">Text</span>
            </h2>
            <p className="text-xs text-[#64748B]">
              Integrated Messaging Forensics, Entity Extraction &amp; Correlation Platform
            </p>
          </div>
        </div>

        <p className="text-xs text-[#3F3F46] leading-relaxed max-w-3xl">
          ForenText is an integrated digital messaging forensics application designed for structured
          triage of exported chat logs. It combines SHA-256 integrity verification, rule-based
          pattern matching, NLP entity extraction, contextual AI analysis, cross-participant
          correlation, chronological event clustering, interactive relationship graphs, and PDF
          reporting.
        </p>
      </div>

      {/* Core Architecture */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#6D28D9]" />
          Tri-Method Hybrid Forensics Architecture
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] space-y-1.5">
            <div className="text-xs font-mono font-semibold text-sky-800">
              1. Rule &amp; RegEx Engine
            </div>
            <p className="text-xs text-[#52525B] leading-relaxed">
              Detects vehicle plates, structured contact identifiers, UPI handles, ID numbers, and
              sensitive keyword lexicons deterministically.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] space-y-1.5">
            <div className="text-xs font-mono font-semibold text-violet-800">
              2. NLP Linguistic Engine
            </div>
            <p className="text-xs text-[#52525B] leading-relaxed">
              Tokenises text and extracts geographical locations, landmarks, objects, documents, and
              candidate alias groups without destructive merging.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] space-y-1.5">
            <div className="text-xs font-mono font-semibold text-amber-800">
              3. Contextual AI Interpretation
            </div>
            <p className="text-xs text-[#52525B] leading-relaxed">
              Identifies indirect references, helps disambiguate benign idioms from true flags, and
              surfaces method disagreements for human review.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#18181B]">
              <GitMerge className="w-3.5 h-3.5 text-[#6D28D9]" />
              Message Correlation
            </div>
            <p className="text-xs text-[#52525B] leading-relaxed">
              Links related messages via shared entities, topic similarity, and temporal proximity
              with investigator confirmation controls.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#18181B]">
              <Layers className="w-3.5 h-3.5 text-[#6D28D9]" />
              Event Clustering
            </div>
            <p className="text-xs text-[#52525B] leading-relaxed">
              Synthesizes multi-stage chronological sequences tying together participants, vehicles,
              locations, and objects.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#18181B]">
              <Lock className="w-3.5 h-3.5 text-[#6D28D9]" />
              Provenance &amp; Discrepancy Audit
            </div>
            <p className="text-xs text-[#52525B] leading-relaxed">
              Preserves Rule/NLP/AI provenance on every finding and highlights method conflicts for
              manual verification.
            </p>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#E4E1EE] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#64748B]">
        <span>Academic Digital Forensics &amp; Cyber Security Project</span>
        <span>ISO/IEC 27037 Evidence Custody Guidelines · ForenText</span>
      </div>
    </div>
  );
};
