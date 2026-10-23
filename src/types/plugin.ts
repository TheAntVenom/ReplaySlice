export enum StreamDeckActionType {
  FIXED_LENGTH = 'com.antvenom.replayslice.fixedlength',
  DYNAMIC_LENGTH = 'com.antvenom.replayslice.dynamiclength',
  DYNAMIC_INCREASE = 'com.antvenom.replayslice.dynamicincrease',
  DYNAMIC_DECREASE = 'com.antvenom.replayslice.dynamicdecrease',
  RESET_DYNAMIC_LENGTH = 'com.antvenom.replayslice.dynamicreset',
  OPEN_OUTPUT_DIRECTORY = 'com.antvenom.replayslice.openfolder',
  OPEN_CAPTURES_DIRECTORY = 'com.antvenom.replayslice.opencaptures',
}

export interface GlobalPluginSettings {
  masterHotkey: string;
  mainCapturesDir: string;
  outputDir: string;
  deleteOriginal: boolean;
  ffmpegPath: string;
  successSoundPath: string;
  errorSoundPath: string;
}

export interface DeckKeySlot {
  slotIndex: number;
  actionType: StreamDeckActionType | null;
  userTitle: string; // Controlled by Stream Deck software (blank on Dynamic Length so plugin updates title)
  titleFontSize: number; // Native Stream Deck Title font size setting
  titleAlignment: 'top' | 'middle' | 'bottom';
  titleColor: string;
  fixedDurationInput: string; // Used when actionType === FIXED_LENGTH (HH:MM:SS or MM:SS)
  stepDurationInput: string; // Per-button step for DYNAMIC_INCREASE & DYNAMIC_DECREASE (default 00:30)
  minFloorInput: string; // Optional per-button minimum floor for DYNAMIC_DECREASE (blank = auto)
  resetDurationInput: string; // Per-button target duration for RESET_DYNAMIC_LENGTH (default 00:30)
  openAfterSave: boolean; // Per-button setting on Fixed Length & Dynamic Length
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
