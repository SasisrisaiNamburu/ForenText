import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Hash,
  AlertTriangle,
  CheckCircle,
  Play,
  Shield,
  ArrowRight,
  FolderOpen,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { ForensicCase } from '../types/forensics';
import { parseEvidenceFile } from '../utils/fileParsers';
import { FICTIONAL_DEMO_TEXT } from '../utils/demoData';
import { formatBytes } from '../utils/hashHelper';
import { clearAnalysisCaches } from '../utils/aiAnalyzer';

interface UploadViewProps {
  forensicCase: ForensicCase | null;
  onCaseLoaded: (newCase: ForensicCase) => void;
  onResetCase: () => void;
  onNavigateToAnalysis: () => void;
  onLoadDemo?: () => Promise<void>;
  isLoadingDemo?: boolean;
}

export const UploadView: React.FC<UploadViewProps> = ({
  forensicCase,
  onCaseLoaded,
  onResetCase,
  onNavigateToAnalysis,
  onLoadDemo,
  isLoadingDemo = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileWithFileReader = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('FileReader returned empty or non-text result.'));
        }
      };
      reader.onerror = () => {
        reject(
          new Error(
            `FileReader failed: ${reader.error?.message || 'Unable to read file from disk.'}`
          )
        );
      };
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setProcessingStatus(`Reading file from disk (${percent}%)...`);
        }
      };
      reader.readAsText(file, 'UTF-8');
    });
  };

  const processSelectedFile = async (file: File) => {
    setErrorMessage(null);

    const lowerName = file.name.toLowerCase();
    const isSupportedExtension =
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.csv') ||
      lowerName.endsWith('.json') ||
      lowerName.endsWith('.html') ||
      lowerName.endsWith('.htm');

    const supportedMimeTypes = new Set([
      '',
      'text/plain',
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',
      'application/json',
      'text/json',
      'text/html',
    ]);
    const isSupportedMime = supportedMimeTypes.has(file.type.toLowerCase());

    if (!isSupportedExtension && !isSupportedMime) {
      setErrorMessage(
        `Unsupported file format: "${file.name}". ForenText accepts .txt, .csv, .json, and .html messaging export files.`
      );
      return;
    }

    if (file.size === 0) {
      setErrorMessage(
        `The selected file "${file.name}" is empty (0 bytes). Please select a valid conversation export.`
      );
      return;
    }

    setIsProcessing(true);
    setProcessingStatus(`Reading "${file.name}" (${formatBytes(file.size)})...`);

    try {
      clearAnalysisCaches();
      const fileContent = await readFileWithFileReader(file);
      setProcessingStatus('Computing SHA-256 evidence hash and parsing records...');

      const parsedCase = await parseEvidenceFile(
        fileContent,
        file.name,
        file.size,
        false,
        file.type
      );

      setProcessingStatus('Finalizing entity extraction and timeline index...');
      onCaseLoaded(parsedCase);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to parse messaging export. Please verify the file structure and timestamps.';
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const handleLoadDemo = async () => {
    if (onLoadDemo) {
      await onLoadDemo();
      return;
    }
    clearAnalysisCaches();
    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStatus('Loading fictional demonstration dataset...');
    try {
      const demoBlob = new Blob([FICTIONAL_DEMO_TEXT], { type: 'text/plain' });
      const parsedCase = await parseEvidenceFile(
        FICTIONAL_DEMO_TEXT,
        'fictional_case_FT-2024-8841.txt',
        demoBlob.size,
        true,
        'text/plain'
      );
      onCaseLoaded(parsedCase);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load demo dataset.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 overflow-y-auto bg-[#FAF9F6]">
      <div>
        <h2 className="text-lg font-bold text-[#18181B]">Evidence Ingestion &amp; Verification</h2>
        <p className="text-xs text-[#52525B] mt-1">
          Import an exported conversation file (<span className="font-mono">.txt</span>,{' '}
          <span className="font-mono">.csv</span>, <span className="font-mono">.json</span>, or{' '}
          <span className="font-mono">.html</span>). File parsing and SHA-256 verification run directly in your browser.
        </p>
      </div>

      {/* Current Dataset State Banner */}
      <div className="p-4 rounded-xl bg-white border border-[#E4E1EE] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#EDE9FE] text-[#6D28D9]">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#18181B]">Current Status:</span>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded border font-medium ${
                  !forensicCase
                    ? 'bg-[#F3F1F8] text-[#52525B] border-[#E4E1EE]'
                    : forensicCase.metadata.isDemo
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-sky-50 text-sky-800 border-sky-200'
                }`}
              >
                {!forensicCase
                  ? 'No Evidence Loaded'
                  : forensicCase.metadata.isDemo
                  ? 'Demo Case Active'
                  : 'Uploaded File Active'}
              </span>
            </div>
            <p className="text-xs text-[#52525B] mt-0.5">
              {!forensicCase
                ? 'Select a .txt, .csv, .json, or .html chat file below or load the demonstration case.'
                : forensicCase.metadata.isDemo
                ? 'Showing sample case (#FT-2024-8841). Upload your own file below to replace it.'
                : `Active file: "${forensicCase.metadata.filename}" (${forensicCase.messages.length} messages, ${formatBytes(forensicCase.metadata.fileSizeBytes)}).`}
            </p>
          </div>
        </div>

        {forensicCase && (
          <button
            onClick={onResetCase}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors shrink-0 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Unload</span>
          </button>
        )}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-xs">Evidence Parsing Warning</p>
            <p className="text-xs leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Drag & Drop File Upload */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#6D28D9]" />
            Option 1: Upload Chat Evidence (.txt, .csv, .json, .html)
          </h3>
        </div>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-10 rounded-xl border-2 border-dashed transition-colors flex flex-col items-center justify-center text-center cursor-pointer ${
            isDragging
              ? 'border-[#6D28D9] bg-[#F3F1F8]'
              : 'border-[#D4CFE2] bg-white hover:border-[#8B5CF6] hover:bg-[#FAF8FD]'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".txt,.csv,.json,.html,.htm,text/plain,text/csv,application/json,text/html"
            className="hidden"
          />

          <div className="w-14 h-14 rounded-xl bg-[#EDE9FE] border border-[#DDD6FE] flex items-center justify-center text-[#6D28D9] mb-4">
            {isProcessing ? (
              <RefreshCw className="w-7 h-7 animate-spin" />
            ) : (
              <UploadCloud className="w-7 h-7" />
            )}
          </div>

          <h4 className="text-sm font-semibold text-[#18181B] mb-1">
            {isProcessing ? processingStatus : 'Drag and drop your messaging export here'}
          </h4>

          <p className="text-xs text-[#64748B] max-w-md mb-5">
            Supports <span className="font-mono text-[#5B21B6]">.txt</span>,{' '}
            <span className="font-mono text-[#5B21B6]">.csv</span>,{' '}
            <span className="font-mono text-[#5B21B6]">.json</span>, and{' '}
            <span className="font-mono text-[#5B21B6]">.html</span> chat export files.
          </p>

          <button
            type="button"
            disabled={isProcessing}
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#6D28D9] hover:bg-[#5B21B6] transition-colors cursor-pointer disabled:opacity-50"
          >
            <FolderOpen className="w-4 h-4" />
            <span>Select Evidence File</span>
          </button>
        </div>
      </div>

      {/* Demo Dataset Option */}
      <div className="p-5 rounded-xl bg-white border border-[#E4E1EE] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-[#18181B] flex items-center gap-2">
            <Play className="w-4 h-4 text-[#6D28D9]" />
            Option 2: Load Fictional Demonstration Dataset
          </h3>
          <p className="text-xs text-[#52525B] max-w-2xl">
            Load the pre-configured fictional case (#FT-2024-8841) with sample vehicle plates,
            location references, benign false positives, and timeline activity.
          </p>
        </div>

        <button
          type="button"
          disabled={isProcessing || isLoadingDemo}
          onClick={handleLoadDemo}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-[#4C1D95] bg-[#EDE9FE] hover:bg-[#DDD6FE] disabled:opacity-60 border border-[#C4B5FD] transition-colors shrink-0 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{isLoadingDemo ? 'Loading Demo...' : 'Load Demo Case'}</span>
        </button>
      </div>

      {/* Active Evidence Summary Card */}
      {forensicCase && (
        <div className="p-5 rounded-xl bg-white border border-[#E4E1EE] space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-sm font-semibold text-[#18181B]">
                  Active Dataset: {forensicCase.metadata.filename}
                </h3>
                <span className="text-[11px] text-[#64748B]">
                  {forensicCase.metadata.isDemo ? 'Fictional demonstration case' : 'Uploaded chat export'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-[#4C1D95] bg-[#EDE9FE] hover:bg-[#DDD6FE] px-3 py-1.5 rounded-lg border border-[#C4B5FD] transition-colors cursor-pointer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Upload Another</span>
              </button>
              <button
                onClick={onResetCase}
                className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-[#FAF9F6] p-4 rounded-lg border border-[#E4E1EE]">
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#64748B]">File Name:</span>
                <span className="font-mono text-[#18181B] font-medium truncate max-w-[240px]">
                  {forensicCase.metadata.filename}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">File Size:</span>
                <span className="font-mono text-[#18181B]">
                  {formatBytes(forensicCase.metadata.fileSizeBytes)} ({forensicCase.metadata.fileSizeBytes} bytes)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Processed Messages:</span>
                <span className="font-mono text-[#6D28D9] font-semibold">
                  {forensicCase.metadata.totalMessages} records ({forensicCase.metadata.totalLines} lines)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">System Notices:</span>
                <span className="font-mono text-[#52525B]">
                  {forensicCase.metadata.systemMessages}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Senders:</span>
                <span className="font-medium text-[#18181B] truncate max-w-[240px]">
                  {forensicCase.metadata.senders.join(', ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Date Range:</span>
                <span className="font-mono text-[#18181B]">
                  {forensicCase.metadata.dateRange.start} → {forensicCase.metadata.dateRange.end}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Extracted Entities:</span>
                <span className="font-mono text-[#18181B] font-semibold">
                  {forensicCase.entities.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Flagged Findings:</span>
                <span className="font-mono text-rose-700 font-semibold">
                  {forensicCase.findings.length}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#F3F1F8] border border-[#DDD6FE] flex items-start gap-2.5">
            <Hash className="w-4 h-4 text-[#6D28D9] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-semibold text-[#4C1D95] uppercase tracking-wider block">
                SHA-256 Evidence Hash
              </span>
              <p className="font-mono text-xs text-[#18181B] break-all select-all mt-0.5">
                {forensicCase.metadata.sha256}
              </p>
            </div>
          </div>

          {forensicCase.metadata.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs space-y-1">
              <span className="font-semibold text-amber-900 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Parser Observations ({forensicCase.metadata.warnings.length})
              </span>
              <ul className="list-disc pl-4 space-y-0.5 text-amber-900">
                {forensicCase.metadata.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={onNavigateToAnalysis}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#6D28D9] hover:bg-[#5B21B6] transition-colors cursor-pointer"
            >
              <span>Open Message Explorer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Supported Formats */}
      <div className="p-5 rounded-xl bg-white border border-[#E4E1EE] space-y-3">
        <h4 className="text-xs font-semibold text-[#18181B] uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-[#6D28D9]" />
          Supported Messaging Evidence Formats
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#52525B]">
          <div className="space-y-1">
            <p className="font-medium text-[#18181B]">WhatsApp Text (.txt)</p>
            <p className="font-mono text-[11px] bg-[#FAF9F6] p-2 rounded border border-[#E4E1EE] text-[#4C1D95]">
              [12/05/2024, 11:30:15 PM] John Doe: Hello team
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-[#18181B]">Structured Table (.csv)</p>
            <p className="font-mono text-[11px] bg-[#FAF9F6] p-2 rounded border border-[#E4E1EE] text-[#4C1D95]">
              timestamp,sender,message
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-[#18181B]">Chat Archive (.json)</p>
            <p className="font-mono text-[11px] bg-[#FAF9F6] p-2 rounded border border-[#E4E1EE] text-[#4C1D95]">
              {`{"messages":[{"sender":"...","timestamp":"...","text":"..."}]}`}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-[#18181B]">HTML Transcript (.html)</p>
            <p className="font-mono text-[11px] bg-[#FAF9F6] p-2 rounded border border-[#E4E1EE] text-[#4C1D95]">
              &lt;div class=&quot;message&quot;&gt;...&lt;/div&gt; or &lt;table&gt; rows
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
