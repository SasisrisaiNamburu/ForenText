import React from 'react';
import { Download, Loader2, Play, UploadCloud } from 'lucide-react';
import { ForensicCase } from '../types/forensics';
import { ActiveTab } from './Sidebar';
import { generateForensicPDF, loadPdfFonts } from '../utils/pdfGenerator';

interface TopBarProps {
  activeTab: ActiveTab;
  forensicCase: ForensicCase | null;
  isLoadingDemo?: boolean;
  onLoadDemo: () => void;
  onNavigateToUpload: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  forensicCase,
  isLoadingDemo = false,
  onLoadDemo,
  onNavigateToUpload,
}) => {

  const getTabTitle = (tab: ActiveTab) => {
    switch (tab) {
      case 'overview':
        return 'Dashboard';
      case 'upload':
        return 'Evidence Ingestion & Verification';
      case 'analysis':
        return 'Message Explorer';
      case 'entities':
        return 'Entity Extraction & Normalisation';
      case 'timeline':
        return 'Timeline Analysis';
      case 'findings':
        return 'Relevant Findings';
      case 'correlation':
        return 'Related Messages';
      case 'events':
        return 'Possible Events';
      case 'graphs':
        return 'Relationship Graph';
      case 'search':
        return 'Search & Filter';
      case 'report':
        return 'Forensic Report';
      case 'about':
        return 'About ForenText';
      default:
        return 'Dashboard';
    }
  };

  const handleDownloadPDF = async () => {
    if (!forensicCase) return;
    const fontBundle = await loadPdfFonts();
    const doc = generateForensicPDF(forensicCase, {}, fontBundle);
    const cleanName = forensicCase.metadata.filename.replace(/\.[^/.]+$/, '');
    doc.save(`ForenText-Report-${cleanName}.pdf`);
  };

  return (
    <header className="h-14 px-6 border-b border-[#E4E1EE] bg-white flex items-center justify-between gap-4 shrink-0">
      {/* Contextual View Title & Active Evidence Chip */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs font-mono text-[#64748B] hidden sm:inline">ForenText /</span>
        <h1 className="text-sm font-semibold text-[#18181B] tracking-tight truncate">
          {getTabTitle(activeTab)}
        </h1>

        {forensicCase && (
          <span
            className={`text-[11px] font-mono px-2 py-0.5 rounded border shrink-0 hidden md:flex items-center gap-1.5 ${
              forensicCase.metadata.isDemo
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-sky-50 text-sky-800 border-sky-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                forensicCase.metadata.isDemo ? 'bg-amber-500' : 'bg-sky-600'
              }`}
            />
            <span className="truncate max-w-[200px]">
              {forensicCase.metadata.isDemo
                ? 'Demo Case Active'
                : forensicCase.metadata.filename}
            </span>
          </span>
        )}
      </div>

      {/* Primary Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onNavigateToUpload}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap border cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-[#EDE9FE] text-[#4C1D95] border-[#C4B5FD]'
              : 'text-[#3F3F46] bg-[#FAF9F6] hover:bg-[#F3F1F8] border-[#E4E1EE]'
          }`}
          title="Upload chat evidence (.txt, .csv, .json, .html)"
        >
          <UploadCloud className="w-3.5 h-3.5 text-[#6D28D9]" />
          <span className="hidden md:inline">Upload Chat</span>
          <span className="md:hidden">Upload</span>
        </button>

        <button
          type="button"
          onClick={onLoadDemo}
          disabled={isLoadingDemo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#3F3F46] bg-[#FAF9F6] hover:bg-[#F3F1F8] disabled:opacity-60 disabled:cursor-wait border border-[#E4E1EE] transition-colors whitespace-nowrap cursor-pointer"
          title="Load preconfigured fictional demonstration case"
        >
          {isLoadingDemo ? (
            <Loader2 className="w-3.5 h-3.5 text-[#6D28D9] animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 text-[#64748B]" />
          )}
          <span className="hidden md:inline">
            {isLoadingDemo ? 'Loading Demo...' : 'Load Demo'}
          </span>
          <span className="md:hidden">{isLoadingDemo ? 'Loading...' : 'Demo'}</span>
        </button>

        {forensicCase && (
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#6D28D9] hover:bg-[#5B21B6] transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
        )}
      </div>
    </header>
  );
};
