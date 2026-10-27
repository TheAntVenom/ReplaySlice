import React, { useEffect, useState } from 'react';
import { ChevronRight, Download, FolderArchive, Keyboard, Volume2 } from 'lucide-react';
import { GlobalPluginSettings } from '../types/plugin';
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

interface MenuOpenState {
  dirs: boolean;
  sounds: boolean;
  repeat: boolean;
}

const MENU_STORAGE_KEY = 'replayslice_web_menus_v1';

const DEFAULT_MENU_STATE: MenuOpenState = {
  dirs: true,
  sounds: true,
  repeat: false,
};

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
  const [menuOpen, setMenuOpen] = useState<MenuOpenState>(() => {
    try {
      const raw = localStorage.getItem(MENU_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          dirs: parsed.dirs !== false,
          sounds: parsed.sounds !== false,
          repeat: Boolean(parsed.repeat),
        };
      }
    } catch {
      // Ignore storage errors
    }
    return DEFAULT_MENU_STATE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(menuOpen));
    } catch {
      // Ignore storage errors
    }
  }, [menuOpen]);

  const toggleMenu = (key: keyof MenuOpenState) => {
    setMenuOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  const safeRepeatDelay =
    Number.isFinite(settings.repeatDelaySeconds) && settings.repeatDelaySeconds >= 0.05
      ? Math.min(10, settings.repeatDelaySeconds)
      : 0.5;
  const safeRepeatRate =
    Number.isFinite(settings.repeatRateHz) && settings.repeatRateHz >= 0.5
      ? Math.min(30, settings.repeatRateHz)
      : 5;
  const repeatIntervalMs = Math.max(33, Math.round(1000 / safeRepeatRate));

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
              Pre-fill your default paths, hotkeys, and repeat behavior below or configure them anytime directly inside
              the Stream Deck desktop app&apos;s Property Inspector after installing.
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

        {/* Top of Global Plugin Settings: Primary Toggles & Master Hotkey */}
        <div className="pt-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.openAfterSave}
                  onChange={(e) => updateField('openAfterSave', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-[#0B0F17] text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="block text-sm font-medium text-slate-200">
                    Open clip automatically after saving
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Global default for newly saved clips (individual Fixed &amp; Dynamic Length buttons can still override this per key).
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={settings.deleteOriginal}
                  onChange={(e) => updateField('deleteOriginal', e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-[#0B0F17] text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="block text-sm font-medium text-slate-200">
                    Delete original master capture after trim succeeds
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Enabled by default so full-length master captures don&apos;t pile up on disk after trimming.
                  </span>
                </div>
              </label>
            </div>

            {/* Master Replay Hotkey */}
            <div className="lg:col-span-5 flex flex-col gap-1.5">
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
          </div>

          {/* Collapsible Menus (mirroring Property Inspector layout & remembered open/closed state) */}
          <div className="space-y-3 pt-2">
            {/* 1. Directories & FFmpeg Path (open by default) */}
            <div className="border border-slate-800 rounded-lg bg-[#0E131D] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMenu('dirs')}
                aria-expanded={menuOpen.dirs}
                className="w-full flex items-center justify-between px-4 py-3 text-left bg-[#111723] hover:bg-[#151D2B] transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-200 tracking-wide">
                  Directories &amp; FFmpeg Path
                </span>
                <ChevronRight
                  className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
                    menuOpen.dirs ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {menuOpen.dirs && (
                <div className="p-4 sm:p-5 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-5">
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
                </div>
              )}
            </div>

            {/* 2. Sound Confirmations (open by default) */}
            <div className="border border-slate-800 rounded-lg bg-[#0E131D] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMenu('sounds')}
                aria-expanded={menuOpen.sounds}
                className="w-full flex items-center justify-between px-4 py-3 text-left bg-[#111723] hover:bg-[#151D2B] transition-colors cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-200 tracking-wide">
                  Sound Confirmations
                </span>
                <ChevronRight
                  className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
                    menuOpen.sounds ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {menuOpen.sounds && (
                <div className="p-4 sm:p-5 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-5">
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
              )}
            </div>

            {/* 3. Key Delay / Repeat (closed by default, sits directly above Diagnostics in Property Inspector) */}
            <div className="border border-slate-800 rounded-lg bg-[#0E131D] overflow-hidden">
              <button
                type="button"
                onClick={() => toggleMenu('repeat')}
                aria-expanded={menuOpen.repeat}
                className="w-full flex items-center justify-between px-4 py-3 text-left bg-[#111723] hover:bg-[#151D2B] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-200 tracking-wide">
                    Key Delay / Repeat
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {safeRepeatDelay}s delay · {safeRepeatRate}×/sec
                  </span>
                </div>
                <ChevronRight
                  className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
                    menuOpen.repeat ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {menuOpen.repeat && (
                <div className="p-4 sm:p-5 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="cfg-repeat-delay" className="text-xs font-medium text-slate-300">
                      Hold Delay Before Repeat (seconds)
                    </label>
                    <input
                      id="cfg-repeat-delay"
                      type="number"
                      step={0.05}
                      min={0.05}
                      max={10}
                      value={settings.repeatDelaySeconds}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateField('repeatDelaySeconds', Number.isFinite(val) ? val : 0.5);
                      }}
                      className="w-full bg-[#0B0F17] border border-slate-700/90 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-100 outline-none transition-colors"
                    />
                    <p className="text-xs text-slate-500">
                      How long to hold Dynamic Increase (+) or Decrease (-) before rapid key repeat begins (default 0.5s).
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="cfg-repeat-rate" className="text-xs font-medium text-slate-300">
                      Repeat Rate (times per second)
                    </label>
                    <input
                      id="cfg-repeat-rate"
                      type="number"
                      step={0.5}
                      min={0.5}
                      max={30}
                      value={settings.repeatRateHz}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        updateField('repeatRateHz', Number.isFinite(val) ? val : 5);
                      }}
                      className="w-full bg-[#0B0F17] border border-slate-700/90 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-100 outline-none transition-colors"
                    />
                    <p className="text-xs text-slate-500">
                      Holding + or - waits {safeRepeatDelay}s, then triggers {safeRepeatRate}×/sec (every {repeatIntervalMs}ms).
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
