import { Download } from 'lucide-react';

interface HeaderBarProps {
  onDownloadPlugin: () => void;
  isExporting: boolean;
}

export function HeaderBar({ onDownloadPlugin, isExporting }: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#0B0F17]/95 backdrop-blur border-b border-slate-800/90">
      <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="text-lg font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-500 rounded"
        >
          ReplaySlice
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
          <a
            href="#settings"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Plugin Settings
          </a>
          <a
            href="#emulator"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Deck Emulator
          </a>
          <a
            href="#source"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Plugin Code
          </a>
          <a
            href="#install"
            className="hover:text-slate-100 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Install Guide
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onDownloadPlugin}
            disabled={isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-blue-400"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>{isExporting ? 'Packaging Plugin...' : 'Download .streamDeckPlugin'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
