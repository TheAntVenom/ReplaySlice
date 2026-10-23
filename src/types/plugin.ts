export enum StreamDeckActionType {
  FIXED_LENGTH = 'com.antvenom.replayslice.fixedlength',
  DYNAMIC_LENGTH = 'com.antvenom.replayslice.dynamiclength',
  DYNAMIC_INCREASE = 'com.antvenom.replayslice.dynamicincrease',
  DYNAMIC_DECREASE = 'com.antvenom.replayslice.dynamicdecrease',
  OPEN_OUTPUT_DIRECTORY = 'com.antvenom.replayslice.openfolder',
  OPEN_CAPTURES_DIRECTORY = 'com.antvenom.replayslice.opencaptures',
}

export interface GlobalPluginSettings {
  masterHotkey: string;
  mainCapturesDir: string;
  outputDir: string;
  deleteOriginal: boolean;
  dynamicStepLength: string; // HH:MM:SS, MM:SS, or seconds
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
  fixedDurationInput: string; // Only used when actionType === FIXED_LENGTH (HH:MM:SS or MM:SS)
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
