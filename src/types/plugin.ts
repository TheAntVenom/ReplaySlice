export enum StreamDeckActionType {
  FIXED_LENGTH = 'com.antvenom.replayslice.fixedlength',
  DYNAMIC_LENGTH = 'com.antvenom.replayslice.dynamiclength',
  DYNAMIC_INCREASE = 'com.antvenom.replayslice.dynamicincrease',
  DYNAMIC_DECREASE = 'com.antvenom.replayslice.dynamicdecrease',
  RESET_DYNAMIC_LENGTH = 'com.antvenom.replayslice.dynamicreset',
  OPEN_OUTPUT_DIRECTORY = 'com.antvenom.replayslice.openfolder',
  OPEN_CAPTURES_DIRECTORY = 'com.antvenom.replayslice.opencaptures',
}

export type OpenAfterSaveMode = 'global' | 'open' | 'never';
export type AudioTracksMode = 'all' | 'custom';

export interface GlobalPluginSettings {
  openAfterSave: boolean;
  deleteOriginal: boolean;
  masterHotkey: string;
  mainCapturesDir: string;
  recursiveSearchCaptures: boolean;
  outputDir: string;
  ffmpegPath: string;
  successSoundPath: string;
  errorSoundPath: string;
  repeatDelaySeconds: number;
  repeatRateHz: number;
}

export interface DeckKeySlot {
  slotIndex: number;
  actionType: StreamDeckActionType | null;
  userTitle: string; // Controlled by Stream Deck software (blank uses default + / - or live Dynamic timer)
  titleFontSize: number; // Native Stream Deck Title font size setting (max 16)
  titleAlignment: 'top' | 'middle' | 'bottom';
  titleColor: string;
  fixedDurationInput: string; // Used when actionType === FIXED_LENGTH (HH:MM:SS or MM:SS)
  stepDurationInput: string; // Per-button step for DYNAMIC_INCREASE & DYNAMIC_DECREASE (default 00:30)
  minFloorInput: string; // Optional per-button minimum floor for DYNAMIC_DECREASE (blank = auto)
  resetDurationInput: string; // Per-button target duration for RESET_DYNAMIC_LENGTH (default 00:30)
  openAfterSaveMode: OpenAfterSaveMode; // Per-button override on Fixed & Dynamic Length ('global' | 'open' | 'never')
  audioTracksMode: AudioTracksMode; // Per-button audio track filter ('all' default | 'custom' tracks 1-6)
  audioTracks: number[]; // Selected 1-based audio tracks (1..6) when audioTracksMode === 'custom'
  fontSizeBoost: number; // 0 = native Stream Deck text; +1..+56 = boosted SVG text using Stream Deck's font
  bgImagePath: string; // Optional PNG/JPG file path composited behind boosted text
  bgImagePreviewUrl: string | null; // Optional local object URL for previewing PNG background in web emulator
  customBoostText: string; // Optional custom text override when fontSizeBoost > 0
}

export interface CaptureLogEntry {
  id: string;
  timestamp: string;
  triggerLabel: string;
  status: 'success' | 'debounced' | 'failed';
  requestedSeconds: number;
  masterElapsedSeconds: number;
  trimStartSeconds: number;
  trimEndSeconds: number;
  outputDurationSeconds: number;
  wasClampedToBuffer: boolean;
  deletedOriginal: boolean;
  openedAfterSave: boolean;
  failTimeoutBudgetSeconds: number;
  outputFileName: string;
  ffmpegCommand: string;
  note: string;
}

export interface GeneratedPluginFile {
  path: string;
  label: string;
  language: 'json' | 'javascript' | 'html' | 'batch' | 'shell' | 'markdown';
  description: string;
  content: string;
}
