/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { HeaderBar } from './components/HeaderBar';
import { PluginSettingsPanel } from './components/PluginSettingsPanel';
import { StreamDeckEmulator } from './components/StreamDeckEmulator';
import { PluginSourceViewer } from './components/PluginSourceViewer';
import { InstallGuideSection } from './components/InstallGuideSection';
import { GlobalPluginSettings } from './types/plugin';
import {
  downloadFullPluginZipBundle,
  downloadStreamDeckPluginInstaller,
} from './utils/exportBundle';

const STORAGE_KEY = 'replayslice_plugin_defaults_v2';

const INITIAL_SETTINGS: GlobalPluginSettings = {
  openAfterSave: false,
  deleteOriginal: true,
  masterHotkey: 'Alt+F10',
  mainCapturesDir: '',
  outputDir: '',
  ffmpegPath: '',
  successSoundPath: '',
  errorSoundPath: '',
  repeatDelaySeconds: 0.5,
  repeatRateHz: 5,
};

export default function App() {
  const [settings, setSettings] = useState<GlobalPluginSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...INITIAL_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // Ignore storage errors
    }
    return INITIAL_SETTINGS;
  });

  const [isExporting, setIsExporting] = useState(false);
  const [customSuccessAudioUrl, setCustomSuccessAudioUrl] = useState<string | null>(null);
  const [customErrorAudioUrl, setCustomErrorAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  useEffect(() => {
    return () => {
      if (customSuccessAudioUrl) URL.revokeObjectURL(customSuccessAudioUrl);
      if (customErrorAudioUrl) URL.revokeObjectURL(customErrorAudioUrl);
    };
  }, [customSuccessAudioUrl, customErrorAudioUrl]);

  const handleUploadPreviewAudio = (kind: 'success' | 'error', file: File | null) => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    if (kind === 'success') {
      if (customSuccessAudioUrl) URL.revokeObjectURL(customSuccessAudioUrl);
      setCustomSuccessAudioUrl(objectUrl);
      if (!settings.successSoundPath.trim()) {
        setSettings((prev) => ({ ...prev, successSoundPath: file.name }));
      }
    } else {
      if (customErrorAudioUrl) URL.revokeObjectURL(customErrorAudioUrl);
      setCustomErrorAudioUrl(objectUrl);
      if (!settings.errorSoundPath.trim()) {
        setSettings((prev) => ({ ...prev, errorSoundPath: file.name }));
      }
    }
  };

  const handleDownloadInstaller = async () => {
    setIsExporting(true);
    try {
      await downloadStreamDeckPluginInstaller(settings);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadZip = async () => {
    setIsExporting(true);
    try {
      await downloadFullPluginZipBundle(settings);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#0B0F17] text-slate-100">
      <HeaderBar
        onDownloadPlugin={handleDownloadInstaller}
        isExporting={isExporting}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8 md:py-10 space-y-10">
        <PluginSettingsPanel
          settings={settings}
          onChange={setSettings}
          onDownloadInstaller={handleDownloadInstaller}
          onDownloadZipBundle={handleDownloadZip}
          isExporting={isExporting}
          customSuccessAudioUrl={customSuccessAudioUrl}
          customErrorAudioUrl={customErrorAudioUrl}
          onUploadPreviewAudio={handleUploadPreviewAudio}
        />

        <StreamDeckEmulator
          settings={settings}
          customSuccessAudioUrl={customSuccessAudioUrl}
          customErrorAudioUrl={customErrorAudioUrl}
        />

        <PluginSourceViewer settings={settings} />

        <InstallGuideSection
          onDownloadInstaller={handleDownloadInstaller}
          onDownloadZipBundle={handleDownloadZip}
          isExporting={isExporting}
        />
      </main>

      <footer className="border-t border-slate-800/80 py-6 mt-8">
        <div className="max-w-[1360px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>ReplaySlice · Multi-Length Instant Replay Plugin for Elgato Stream Deck</span>
          <button
            type="button"
            onClick={handleDownloadInstaller}
            className="text-slate-400 hover:text-slate-200 underline underline-offset-4 cursor-pointer whitespace-nowrap"
          >
            Download .streamDeckPlugin Installer
          </button>
        </div>
      </footer>
    </div>
  );
}
