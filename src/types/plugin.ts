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
export type BoostLine2Position = 'above' | 'below';

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
  enableCustomText: boolean; // Off by default; activates fontSizeBoost (default +4) & Line 1 / Line 2 overrides
  fontSizeBoost: number; // Default 4 (+pt added to Stream Deck's font size when enableCustomText is on)
  enableTextShadow: boolean; // Off by default; sits right below Enable Custom Text Size & Text Override
  textShadowColor: string; // 6-character hex RGB value without '#' (default '000000')
  textShadowSize: number; // Drop shadow size / spread & offset (default 3)
  textShadowBlend: number; // Drop shadow feather / blend softness (default 4; 0 = sharp)
  bgImagePath: string; // Optional PNG/JPG file path composited behind boosted text
  bgImagePreviewUrl: string | null; // Optional local object URL for previewing PNG background in web emulator
  customBoostText: string; // Line 1 override: always overwrites timer / + / - when non-empty
  customBoostTextLine2: string; // Line 2 text: placed above or below Line 1 / timer and centered together
  customBoostLine2Pos: BoostLine2Position; // 'below' (default) | 'above'
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
