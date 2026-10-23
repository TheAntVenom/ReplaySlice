import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { GlobalPluginSettings } from '../types/plugin';
import { getAllGeneratedPluginFiles } from '../pluginTemplates/generatePluginFiles';

interface PluginSourceViewerProps {
  settings: GlobalPluginSettings;
}

export function PluginSourceViewer({ settings }: PluginSourceViewerProps) {
  const files = useMemo(() => getAllGeneratedPluginFiles(settings), [settings]);
  const [activeIndex, setActiveIndex] = useState<number>(1); // Default to bin/plugin.mjs
  const [copied, setCopied] = useState<boolean>(false);

  const currentFile = files[activeIndex] ?? files[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentFile.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard ignored
    }
  };

  return (
    <section id="source" className="scroll-mt-20 space-y-6">
      {/* Architecture Upgrade Summary from AdditionalReplays_5_2.py */}
      <div className="bg-[#131924] border border-slate-800 rounded-xl p-6 md:p-8">
        <h2 className="text-xl md:text-2xl font-semibold text-slate-50 tracking-tight">
          How ReplaySlice Fixes Your Legacy OBS Script&apos;s Audio Sync &amp; Workflow
        </h2>
        <p className="mt-1.5 text-sm text-slate-400 max-w-3xl">
          Every improvement below is compiled directly into the standalone Node 20 Stream Deck plugin bundle above.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              01. Eliminates the 1.5s Tail &amp; Audio Length Mismatch
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              <code className="text-slate-300 font-mono">AdditionalReplays_5_2.py</code> started reading the replay file the instant{' '}
              <code className="text-slate-300 font-mono">os.path.isfile</code> returned true—while OBS was still flushing separate audio/video muxer packets—and cut mid-GOP without timestamp zeroing. ReplaySlice waits until the OS write handle unlocks, reads stream lengths via{' '}
              <code className="text-slate-300 font-mono">ffprobe</code>, snaps to the preceding I-frame, and trims with{' '}
              <code className="text-slate-300 font-mono">-c copy -avoid_negative_ts make_zero -shortest</code>.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              02. Recorder-Agnostic &amp; Short-Buffer Aware
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Instead of relying on <code className="text-slate-300 font-mono">obspython</code>, ReplaySlice injects hardware scan-code hotkeys compatible with OBS, Nvidia ShadowPlay, and AMD ReLive, recursively watches game subfolders, reads the real elapsed duration (e.g. 7:00 elapsed in a 20:00 buffer), and scales the fail counter automatically (10s minimum + 2s per 5 minutes).
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              03. Native Stream Deck Styling + .mp3 &amp; .wav Audio
            </h3>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              All 6 buttons respect Stream Deck&apos;s native icon, font, size, alignment, and color controls. Only{' '}
              <span className="text-slate-200 font-medium">Dynamic Length</span> dynamically updates its title text (<code className="text-slate-300 font-mono">1:00</code> → <code className="text-slate-300 font-mono">3:30</code>). Audio cues support both{' '}
              <code className="text-slate-300 font-mono">.mp3</code> and <code className="text-slate-300 font-mono">.wav</code> via{' '}
              <code className="text-slate-300 font-mono">ffplay</code> with built-in Windows/macOS fallbacks.
            </p>
          </div>
        </div>
      </div>

      {/* Generated Plugin Code Browser */}
      <div className="bg-[#131924] border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Generated Stream Deck Plugin Files
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{currentFile.description}</p>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied File' : 'Copy File Contents'}</span>
          </button>
        </div>

        {/* Interactive File Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 py-3 border-b border-slate-800">
          {files.map((file, idx) => (
            <button
              key={file.path}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                idx === activeIndex
                  ? 'bg-blue-600 text-white font-medium'
                  : 'bg-[#0B0F17] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {file.label}
            </button>
          ))}
        </div>

        <pre className="mt-4 p-4 rounded-lg bg-[#0B0F17] border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-[460px] overflow-y-auto leading-relaxed">
          <code>{currentFile.content}</code>
        </pre>
      </div>
    </section>
  );
}
