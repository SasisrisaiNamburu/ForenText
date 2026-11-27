import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  MessageSquareText,
  Fingerprint,
  LineChart,
  ShieldAlert,
  FileCheck2,
  Info,
  Shield,
  Hash,
  GitMerge,
  Layers,
  Share2,
  Search,
} from 'lucide-react';
import { ForensicCase } from '../types/forensics';

export type ActiveTab =
  | 'overview'
  | 'upload'
  | 'analysis'
  | 'entities'
  | 'findings'
  | 'correlation'
  | 'events'
  | 'timeline'
  | 'graphs'
  | 'search'
  | 'report'
  | 'about';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  forensicCase: ForensicCase | null;
}

interface NavGroup {
  title: string;
  items: {
    id: ActiveTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    count?: number;
  }[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  forensicCase,
}) => {
  const navGroups: NavGroup[] = [
    {
      title: 'Workspace',
      items: [
        { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'upload', label: 'Upload Evidence', icon: UploadCloud },
      ],
    },
    {
      title: 'Analysis',
      items: [
        {
          id: 'analysis',
          label: 'Message Explorer',
          icon: MessageSquareText,
          count: forensicCase?.messages.length,
        },
        {
          id: 'entities',
          label: 'Entity Extraction',
          icon: Fingerprint,
          count: forensicCase?.entities.length,
        },
        {
          id: 'findings',
          label: 'Relevant Findings',
          icon: ShieldAlert,
          count: forensicCase?.findings.length,
        },
        {
          id: 'correlation',
          label: 'Related Messages',
          icon: GitMerge,
          count: forensicCase?.correlations?.length,
        },
        {
          id: 'events',
          label: 'Possible Events',
          icon: Layers,
          count: forensicCase?.events?.length,
        },
      ],
    },
    {
      title: 'Visualisation',
      items: [
        { id: 'timeline', label: 'Timeline', icon: LineChart },
        { id: 'graphs', label: 'Relationship Graph', icon: Share2 },
      ],
    },
    {
      title: 'Investigation',
      items: [
        { id: 'search', label: 'Search & Filter', icon: Search },
        { id: 'report', label: 'Forensic Report', icon: FileCheck2 },
        { id: 'about', label: 'About ForenText', icon: Info },
      ],
    },
  ];

  return (
    <aside className="w-60 bg-[#F3F1F8] border-r border-[#E4E1EE] flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="px-4 py-4 border-b border-[#E4E1EE] flex items-center gap-2.5 bg-white/70">
        <div className="w-8 h-8 rounded-lg bg-[#6D28D9] flex items-center justify-center text-white shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <span className="font-bold text-base tracking-tight text-[#18181B] block leading-tight">
            Foren<span className="text-[#6D28D9]">Text</span>
          </span>
          <p className="text-[11px] text-[#64748B] truncate">Messaging Forensics</p>
        </div>
      </div>

      {/* Grouped Navigation */}
      <nav className="flex-1 py-3 px-2.5 space-y-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.title} className="space-y-0.5">
            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
              {group.title}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#EDE9FE] text-[#4C1D95] border border-[#DDD6FE]'
                      : 'text-[#3F3F46] hover:text-[#18181B] hover:bg-white/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-[#6D28D9]' : 'text-[#64748B]'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-[11px] px-1.5 py-0.5 rounded font-mono tabular-nums shrink-0 ${
                        isActive
                          ? 'bg-white text-[#5B21B6] border border-[#DDD6FE]'
                          : 'bg-[#E9E6F2] text-[#475569]'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Active Case Integrity Badge */}
      <div className="p-3 border-t border-[#E4E1EE] bg-[#FAF9F6]">
        {forensicCase ? (
          <div
            onClick={() => setActiveTab('upload')}
            className="p-2.5 rounded-lg bg-white border border-[#E4E1EE] hover:border-[#C4B5FD] cursor-pointer transition-colors space-y-1.5"
            title="Click to view or replace active evidence"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#5B21B6] flex items-center gap-1">
                <Hash className="w-3 h-3 text-[#6D28D9]" /> Evidence Active
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                  forensicCase.metadata.isDemo
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-sky-50 text-sky-800 border border-sky-200'
                }`}
              >
                {forensicCase.metadata.isDemo ? 'Demo' : 'File'}
              </span>
            </div>
            <p className="text-[11px] text-[#18181B] truncate font-mono">
              {forensicCase.metadata.filename}
            </p>
            <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono">
              <span>{forensicCase.messages.length} msgs</span>
              <span className="truncate max-w-[105px]" title={forensicCase.metadata.sha256}>
                SHA: {forensicCase.metadata.sha256.substring(0, 8)}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded-lg bg-white border border-[#E4E1EE] text-center">
            <p className="text-xs font-medium text-[#3F3F46]">No evidence loaded</p>
            <p className="text-[11px] text-[#64748B]">Upload file or load demo</p>
          </div>
        )}
      </div>
    </aside>
  );
};
