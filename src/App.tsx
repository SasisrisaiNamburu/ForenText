/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { OverviewView } from './components/OverviewView';
import { UploadView } from './components/UploadView';
import { MessageAnalysisView } from './components/MessageAnalysisView';
import { EntityExtractionView } from './components/EntityExtractionView';
import { TimelineAnalysisView } from './components/TimelineAnalysisView';
import { RelevantFindingsView } from './components/RelevantFindingsView';
import { MessageCorrelationView } from './components/MessageCorrelationView';
import { EventAnalysisView } from './components/EventAnalysisView';
import { RelationshipGraphsView } from './components/RelationshipGraphsView';
import { AdvancedSearchView } from './components/AdvancedSearchView';
import { ForensicReportView } from './components/ForensicReportView';
import { AboutView } from './components/AboutView';
import { MessageDetailModal } from './components/MessageDetailModal';
import {
  ForensicCase,
  ReviewStatus,
  CorrelationStatus,
} from './types/forensics';
import { parseWhatsAppExport } from './utils/whatsappParser';
import { FICTIONAL_DEMO_TEXT } from './utils/demoData';
import { clearAnalysisCaches } from './utils/aiAnalyzer';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [forensicCase, setForensicCase] = useState<ForensicCase | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [caseRevision, setCaseRevision] = useState(0);
  const loadSeqRef = useRef(0);

  const loadDemoDataset = useCallback(async (navigateToOverview: boolean) => {
    const seq = ++loadSeqRef.current;
    clearAnalysisCaches();
    setSelectedMessageId(null);
    setDemoError(null);
    setIsLoadingDemo(true);

    try {
      if (!FICTIONAL_DEMO_TEXT || !FICTIONAL_DEMO_TEXT.trim()) {
        throw new Error('Built-in demonstration dataset is empty or unavailable.');
      }
      const demoBlob = new Blob([FICTIONAL_DEMO_TEXT], { type: 'text/plain' });
      const parsed = await parseWhatsAppExport(
        FICTIONAL_DEMO_TEXT,
        'fictional_case_FT-2024-8841.txt',
        demoBlob.size,
        true
      );
      if (seq !== loadSeqRef.current) return;
      setForensicCase(parsed);
      setCaseRevision((r) => r + 1);
      if (navigateToOverview) {
        setActiveTab('overview');
      }
    } catch (err) {
      console.error('Failed to load demo:', err);
      if (seq !== loadSeqRef.current) return;
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Unable to load the demonstration dataset.';
      setDemoError(`Failed to load demo dataset: ${message}`);
    } finally {
      if (seq === loadSeqRef.current) {
        setIsLoadingDemo(false);
      }
    }
  }, []);

  // Initialize with fictional demo case on first visit so the examiner immediately experiences the working system
  useEffect(() => {
    void loadDemoDataset(false);
  }, [loadDemoDataset]);

  const handleCaseLoaded = (newCase: ForensicCase) => {
    loadSeqRef.current += 1;
    setIsLoadingDemo(false);
    setDemoError(null);
    setSelectedMessageId(null);
    setForensicCase(newCase);
    setCaseRevision((r) => r + 1);
    setActiveTab('overview');
  };

  const handleResetCase = () => {
    loadSeqRef.current += 1;
    clearAnalysisCaches();
    setIsLoadingDemo(false);
    setDemoError(null);
    setSelectedMessageId(null);
    setForensicCase(null);
    setCaseRevision((r) => r + 1);
    setActiveTab('upload');
  };

  const handleLoadDemo = async () => {
    await loadDemoDataset(true);
  };

  const handleUpdateStatus = (msgId: number, status: ReviewStatus, notes?: string) => {
    if (!forensicCase) return;
    setForensicCase((prev) => {
      if (!prev) return null;
      const updatedMessages = prev.messages.map((m) => {
        if (m.id === msgId) {
          return {
            ...m,
            investigatorStatus: status,
            investigatorNotes: notes !== undefined ? notes : m.investigatorNotes,
          };
        }
        return m;
      });
      return {
        ...prev,
        messages: updatedMessages,
      };
    });
  };

  const handleUpdateCorrelationStatus = (
    correlationId: string,
    status: CorrelationStatus,
    notes?: string
  ) => {
    if (!forensicCase) return;
    setForensicCase((prev) => {
      if (!prev) return null;
      const updatedCorrelations = prev.correlations.map((c) => {
        if (c.id === correlationId) {
          return {
            ...c,
            status,
            investigatorNotes: notes !== undefined ? notes : c.investigatorNotes,
          };
        }
        return c;
      });
      return {
        ...prev,
        correlations: updatedCorrelations,
      };
    });
  };

  const handleUpdateEventStatus = (
    eventId: string,
    status: 'suggested' | 'confirmed' | 'rejected'
  ) => {
    if (!forensicCase) return;
    setForensicCase((prev) => {
      if (!prev) return null;
      const updatedEvents = prev.events.map((ev) => {
        if (ev.id === eventId) {
          return {
            ...ev,
            status,
          };
        }
        return ev;
      });
      return {
        ...prev,
        events: updatedEvents,
      };
    });
  };

  const selectedMessage = forensicCase
    ? forensicCase.messages.find((m) => m.id === selectedMessageId) || null
    : null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#FAF9F6] text-[#18181B] font-['Plus_Jakarta_Sans']">
      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        forensicCase={forensicCase}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          activeTab={activeTab}
          forensicCase={forensicCase}
          isLoadingDemo={isLoadingDemo}
          onLoadDemo={handleLoadDemo}
          onNavigateToUpload={() => setActiveTab('upload')}
        />

        {demoError && (
          <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-900 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="truncate font-medium">{demoError}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleLoadDemo}
                disabled={isLoadingDemo}
                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer disabled:opacity-50"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setDemoError(null)}
                aria-label="Dismiss error"
                className="p-1 rounded hover:bg-rose-100 text-rose-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* View Router */}
        <main className="flex-1 overflow-hidden flex flex-col relative bg-[#FAF9F6]">
          {activeTab === 'overview' && (
            <OverviewView
              forensicCase={forensicCase}
              isLoadingDemo={isLoadingDemo}
              setActiveTab={setActiveTab}
              onOpenMessage={(id) => setSelectedMessageId(id)}
            />
          )}

          {activeTab === 'upload' && (
            <UploadView
              forensicCase={forensicCase}
              onCaseLoaded={handleCaseLoaded}
              onResetCase={handleResetCase}
              onNavigateToAnalysis={() => setActiveTab('analysis')}
              onLoadDemo={handleLoadDemo}
              isLoadingDemo={isLoadingDemo}
            />
          )}

          {activeTab === 'analysis' && forensicCase && (
            <MessageAnalysisView
              key={`analysis-${caseRevision}-${forensicCase.metadata.sha256}`}
              forensicCase={forensicCase}
              onOpenMessage={(id) => setSelectedMessageId(id)}
              onUpdateStatus={handleUpdateStatus}
            />
          )}

          {activeTab === 'entities' && forensicCase && (
            <EntityExtractionView
              key={`entities-${caseRevision}-${forensicCase.metadata.sha256}`}
              forensicCase={forensicCase}
              onOpenMessage={(id) => setSelectedMessageId(id)}
            />
          )}

          {activeTab === 'findings' && forensicCase && (
            <RelevantFindingsView
              key={`findings-${caseRevision}-${forensicCase.metadata.sha256}`}
              forensicCase={forensicCase}
              onOpenMessage={(id) => setSelectedMessageId(id)}
              onUpdateStatus={handleUpdateStatus}
            />
          )}

          {activeTab === 'correlation' && forensicCase && (
            <MessageCorrelationView
              key={`corr-${caseRevision}-${forensicCase.metadata.sha256}`}
              forensicCase={forensicCase}
              onOpenMessage={(id) => setSelectedMessageId(id)}
              onUpdateCorrelationStatus={handleUpdateCorrelationStatus}
            />
          )}

          {activeTab === 'events' && forensicCase && (
            <EventAnalysisView
              key={`events-${caseRevision}-${forensicCase.metadata.sha256}`}
              forensicCase={forensicCase}
              onOpenMessage={(id) => setSelectedMessageId(id)}
              onUpdateEventStatus={handleUpdateEventStatus}
            />
          )}

          {activeTab === 'timeline' && forensicCase && (
            <TimelineAnalysisView
              key={`timeline-${caseRevision}-${forensicCase.metadata.sha256}`}
              forensicCase={forensicCase}
              onOpenMessage={(id) => setSelectedMessageId(id)}
            />
          )}

          {activeTab === 'graphs' && forensicCase && (
            <RelationshipGraphsView
              key={`graphs-${caseRevision}-${forensicCase.metadata.sha256}`}
              forensicCase={forensicCase}
              onOpenMessage={(id) => setSelectedMessageId(id)}
            />
          )}

          {activeTab === 'search' && forensicCase && (
            <AdvancedSearchView
              key={`search-${caseRevision}-${forensicCase.metadata.sha256}`}
              forensicCase={forensicCase}
              onOpenMessage={(id) => setSelectedMessageId(id)}
            />
          )}

          {activeTab === 'report' && forensicCase && (
            <ForensicReportView
              key={`report-${caseRevision}-${forensicCase.metadata.sha256}`}
              forensicCase={forensicCase}
            />
          )}

          {/* Null case fallback for tabs requiring loaded evidence */}
          {!forensicCase &&
            activeTab !== 'overview' &&
            activeTab !== 'upload' &&
            activeTab !== 'about' && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#52525B]">
                <p className="text-sm">Please upload evidence or load the demo case first.</p>
                <button
                  onClick={() => setActiveTab('upload')}
                  className="mt-3 px-4 py-2 rounded-lg bg-[#6D28D9] hover:bg-[#5B21B6] text-white text-xs font-semibold cursor-pointer"
                >
                  Go to Upload Evidence
                </button>
              </div>
            )}

          {activeTab === 'about' && <AboutView />}
        </main>
      </div>

      {/* Message Detail Inspector Modal */}
      {selectedMessage && forensicCase && (
        <MessageDetailModal
          message={selectedMessage}
          hybridFindings={forensicCase.findings.filter((f) => f.messageId === selectedMessage.id)}
          hybridEntities={forensicCase.entities.filter((e) => e.messageId === selectedMessage.id)}
          totalMessages={forensicCase.messages.length}
          onClose={() => setSelectedMessageId(null)}
          onSelectMessage={(id) => setSelectedMessageId(id)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
}
