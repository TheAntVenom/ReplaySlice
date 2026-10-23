import React, { useState } from 'react';
import { Download, FolderArchive, Keyboard, Volume2 } from 'lucide-react';
import { GlobalPluginSettings } from '../types/plugin';
import { parseTimecodeToSeconds } from '../utils/timecode';
import { playEmulatorCue } from '../utils/soundCue';
import { PLUGIN_VERSION } from '../pluginTemplates/generatePluginFiles';

interface PluginSettingsPanelProps {
  settings: GlobalPluginSettings;
  onChange: (updated: GlobalPluginSettings) => void;
  onDownloadInstaller: () => void;
  onDownloadZipBundle: () => void;
  isExporting: boolean;
  customSuccessAudioUrl: string | null;
  customErrorAudioUrl: string | null;
  onUploadPreviewAudio: (kind: 'success' | 'error', file: File | null) => void;
}

export function PluginSettingsPanel({
  settings,
  onChange,
  onDownloadInstaller,
  onDownloadZipBundle,
  isExporting,
  customSuccessAudioUrl,
  customErrorAudioUrl,
  onUploadPreviewAudio,
}: PluginSettingsPanelProps) {
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);

  const dynamicStepSec = Math.max(1, parseTimecodeToSeconds(settings.dynamicStepLength, 30));

  const updateField = <K extends keyof GlobalPluginSettings>(key: K, value: GlobalPluginSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const handleHotkeyKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isRecordingHotkey) return;
    e.preventDefault();
    e.stopPropagation();

    const modifierNames = ['Control', 'Shift', 'Alt', 'Meta'];
    if (modifierNames.includes(e.key)) return;

    const combo: string[] = [];
    if (e.ctrlKey) combo.push('Ctrl');
    if (e.altKey) combo.push('Alt');
    if (e.shiftKey) combo.push('Shift');
    if (e.metaKey) combo.push('Win');

    let keyToken = e.key;
    if (e.code && e.code.startsWith('Numpad')) {
      keyToken = e.code.replace('Numpad', 'Num');
    } else if (keyToken === ' ') {
      keyToken = 'Space';
    } else if (keyToken.length === 1) {
      keyToken = keyToken.toUpperCase();
    }

    combo.push(keyToken);
    updateField('masterHotkey', combo.join('+'));
    setIsRecordingHotkey(false);
  };

  const hasSuccessSound = Boolean(customSuccessAudioUrl || settings.successSoundPath.trim());
  const hasErrorSound = Boolean(customErrorAudioUrl || settings.errorSoundPath.trim());

  return (
    <section id="settings" className="scroll-mt-20">
      <div className="bg-[#131924] border border-slate-800 rounded-xl p-6 md:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-6 border-b border-slate-800">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-slate-400 mb-2">
              ReplaySlice v{PLUGIN_VERSION} · Elgato Stream Deck SDK v2 · Windows 10/11 &amp; macOS
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-50 tracking-tight">
              Configure &amp; Export Your Stream Deck Plugin
            </h1>
            <p className="mt-2 text-sm text-slate-400 leading-relaxed">
              Pre-fill your default paths and hotkeys below or configure them anytime directly inside the Stream Deck
              desktop app&apos;s Property Inspector after installing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onDownloadInstaller}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Download .streamDeckPlugin</span>
            </button>
            <button
              type="button"
              onClick={onDownloadZipBundle}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FolderArchive className="w-4 h-4 shrink-0" />
              <span>Download .zip + Install Scripts</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
          {/* 1. Master Replay Hotkey */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cfg-hotkey" className="text-xs font-medium text-slate-300">
              Master Instant Replay Hotkey
            </label>
            <div className="flex items-center gap-2">
              <input
                id="cfg-hotkey"
                type="text"
                value={settings.masterHotkey}
                onChange={(e) => updateField('masterHotkey', e.target.value)}
                placeholder="Alt+F10 or Ctrl+Shift+R"
                className="flex-1 min-w-0 bg-[#0B0F17] border border-slate-700/90 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setIsRecordingHotkey((prev) => !prev)}
                onKeyDown={handleHotkeyKeyDown}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  isRecordingHotkey
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Keyboard className="w-3.5 h-3.5 shrink-0" />
                <span>{isRecordingHotkey ? 'Press Keys...' : 'Record'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Sent to OBS, Nvidia ShadowPlay, or your capture app to save the master clip.
            </p>
          </div>

          {/* 2. Dynamic Step Length */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cfg-dyn-step" className="text-xs font-medium text-slate-300">
              Dynamic Step Length (HH:MM:SS, MM:SS, or sec)
            </label>
            <input
              id="cfg-dyn-step"
              type="text"
              value={settings.dynamicStepLength}
              onChange={(e) => updateField('dynamicStepLength', e.target.value)}
              placeholder="00:30"
              className="w-full bg-[#0B0F17] border border-slate-700/90 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-100 outline-none transition-colors"
            />
            <p className="text-xs text-slate-500 tabular-nums">
              Adds or subtracts {dynamicStepSec}s per press of Dynamic Increase / Decrease.
            </p>
          </div>

          {/* 3. FFmpeg Path (Optional) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cfg-ffmpeg" className="text-xs font-medium text-slate-300">
              FFmpeg Path (Optional)
            </label>
            <input
              id="cfg-ffmpeg"
              type="text"
              value={settings.ffmpegPath}
              onChange={(e) => updateField('ffmpegPath', e.target.value)}
              placeholder="Leave blank to use system PATH"
              className="w-full bg-[#0B0F17] border border-slate-700/90 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 outline-none transition-colors"
            />
            <p className="text-xs text-slate-500">
              Auto-detects FFmpeg &amp; FFprobe in PATH; throws an error if missing.
            </p>
          </div>

          {/* 4. Main Captures Directory */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cfg-main-dir" className="text-xs font-medium text-slate-300">
              Main Captures Directory
            </label>
            <input
              id="cfg-main-dir"
              type="text"
              value={settings.mainCapturesDir}
              onChange={(e) => updateField('mainCapturesDir', e.target.value)}
              placeholder="C:\Users\You\Videos\Captures"
              className="w-full bg-[#0B0F17] border border-slate-700/90 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 outline-none transition-colors"
            />
            <p className="text-xs text-slate-500">
              Watched recursively for master clips and opened by Open Captures Directory.
            </p>
          </div>

          {/* 5. Output Directory */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cfg-out-dir" className="text-xs font-medium text-slate-300">
              Output Directory
            </label>
            <input
              id="cfg-out-dir"
              type="text"
              value={settings.outputDir}
              onChange={(e) => updateField('outputDir', e.target.value)}
              placeholder="C:\Users\You\Videos\Trimmed Replays"
              className="w-full bg-[#0B0F17] border border-slate-700/90 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 outline-none transition-colors"
            />
            <p className="text-xs text-slate-500">
              Where trimmed clips are written and opened by Open Output Directory.
            </p>
          </div>

          {/* 6. Delete Original Capture Checkbox (ON by default) */}
          <div className="flex flex-col justify-center gap-2 pt-1">
            <label className="inline-flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={settings.deleteOriginal}
                onChange={(e) => updateField('deleteOriginal', e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-[#0B0F17] text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="block text-sm font-medium text-slate-200">
                  Delete original capture after trimming
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Enabled by default so full-length master captures don&apos;t pile up on disk after trimming.
                </span>
              </div>
            </label>
          </div>

          {/* 7. Success Sound (.wav / .mp3) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cfg-success-snd" className="text-xs font-medium text-slate-300">
              Success Sound Path (.wav or .mp3)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="cfg-success-snd"
                type="text"
                value={settings.successSoundPath}
                onChange={(e) => updateField('successSoundPath', e.target.value)}
                placeholder="Optional path to .wav or .mp3"
                className="flex-1 min-w-0 bg-[#0B0F17] border border-slate-700/90 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 outline-none transition-colors"
              />
              <button
                type="button"
                disabled={!hasSuccessSound}
                onClick={() => {
                  if (hasSuccessSound) playEmulatorCue('success', customSuccessAudioUrl);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                <span>Test</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Silent when left empty.</span>
              <label className="text-blue-400 hover:text-blue-300 cursor-pointer underline underline-offset-2 whitespace-nowrap">
                <span>{customSuccessAudioUrl ? 'Custom audio loaded' : 'Load .mp3/.wav for demo'}</span>
                <input
                  type="file"
                  accept=".wav,.mp3,.ogg,.m4a,audio/*"
                  className="hidden"
                  onChange={(e) => onUploadPreviewAudio('success', e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>

          {/* 8. Failure Sound (.wav / .mp3) */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cfg-error-snd" className="text-xs font-medium text-slate-300">
              Failure / Exception Sound Path (.wav or .mp3)
            </label>
            <div className="flex items-center gap-2">
              <input
                id="cfg-error-snd"
                type="text"
                value={settings.errorSoundPath}
                onChange={(e) => updateField('errorSoundPath', e.target.value)}
                placeholder="Optional path to .wav or .mp3"
                className="flex-1 min-w-0 bg-[#0B0F17] border border-slate-700/90 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 outline-none transition-colors"
              />
              <button
                type="button"
                disabled={!hasErrorSound}
                onClick={() => {
                  if (hasErrorSound) playEmulatorCue('error', customErrorAudioUrl);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                <span>Test</span>
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Silent when left empty.</span>
              <label className="text-blue-400 hover:text-blue-300 cursor-pointer underline underline-offset-2 whitespace-nowrap">
                <span>{customErrorAudioUrl ? 'Custom audio loaded' : 'Load .mp3/.wav for demo'}</span>
                <input
                  type="file"
                  accept=".wav,.mp3,.ogg,.m4a,audio/*"
                  className="hidden"
                  onChange={(e) => onUploadPreviewAudio('error', e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
