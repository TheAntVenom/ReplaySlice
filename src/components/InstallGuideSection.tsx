import { Download, FolderArchive } from 'lucide-react';
import { PLUGIN_UUID, SD_PLUGIN_FOLDER } from '../pluginTemplates/generatePluginFiles';

interface InstallGuideSectionProps {
  onDownloadInstaller: () => void;
  onDownloadZipBundle: () => void;
  isExporting: boolean;
}

export function InstallGuideSection({
  onDownloadInstaller,
  onDownloadZipBundle,
  isExporting,
}: InstallGuideSectionProps) {
  return (
    <section id="install" className="scroll-mt-20">
      <div className="bg-[#131924] border border-slate-800 rounded-xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-slate-50 tracking-tight">
              Installing ReplaySlice Into Elgato Stream Deck
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              Runs directly on Stream Deck&apos;s built-in Node.js 20 runtime (Stream Deck 6.5+) with zero extra packages to install.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onDownloadInstaller}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Download {PLUGIN_UUID}.streamDeckPlugin</span>
            </button>
            <button
              type="button"
              onClick={onDownloadZipBundle}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <FolderArchive className="w-3.5 h-3.5 shrink-0" />
              <span>Download .zip Bundle</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              01. Install the Plugin
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Double-click <code className="text-slate-200 font-mono">{PLUGIN_UUID}.streamDeckPlugin</code> and click{' '}
              <span className="text-slate-200 font-medium">Install</span> when Elgato Stream Deck prompts you. Alternatively, extract the{' '}
              <code className="text-slate-200 font-mono">.zip</code> bundle and run{' '}
              <code className="text-slate-200 font-mono">install-windows.bat</code> (which copies{' '}
              <code className="text-slate-200 font-mono">{SD_PLUGIN_FOLDER}</code> into{' '}
              <code className="text-slate-200 font-mono">%APPDATA%\Elgato\StreamDeck\Plugins</code>).
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              02. Drag Actions Onto Your Deck
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              In the right-hand sidebar of your Stream Deck software, expand the{' '}
              <span className="text-slate-200 font-medium">ReplaySlice</span> category to find all seven actions:{' '}
              <span className="text-slate-300">Fixed Length</span>,{' '}
              <span className="text-slate-300">Dynamic Length</span>,{' '}
              <span className="text-slate-300">Dynamic Increase</span>,{' '}
              <span className="text-slate-300">Dynamic Decrease</span>,{' '}
              <span className="text-slate-300">Reset Dynamic Length</span>,{' '}
              <span className="text-slate-300">Open Output Directory</span>, and{' '}
              <span className="text-slate-300">Open Captures Directory</span>.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              03. Customize Button Look in Stream Deck
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Assign any custom icons, fonts, sizes, and titles directly in Stream Deck. For{' '}
              <span className="text-slate-200 font-medium">Dynamic Length</span>, adjust font, size, color, and position in Stream Deck&apos;s Title bar while leaving the static Title text empty so the live{' '}
              <code className="text-slate-200 font-mono">1:00</code> → <code className="text-slate-200 font-mono">3:30</code> readout updates dynamically.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
