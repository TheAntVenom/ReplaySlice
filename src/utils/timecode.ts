/**
 * Parses HH:MM:SS, MM:SS, or plain seconds ("30", "30s") into integer/float seconds.
 */
export function parseTimecodeToSeconds(raw: string | number | undefined | null, fallbackSeconds = 0): number {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? raw : fallbackSeconds;
  }
  if (!raw || typeof raw !== 'string') {
    return fallbackSeconds;
  }
  const cleaned = raw.trim().replace(/s$/i, '');
  if (!cleaned) {
    return fallbackSeconds;
  }

  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map((p) => Number(p.trim()));
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) {
      return fallbackSeconds;
    }
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
  }

  const numeric = Number(cleaned);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallbackSeconds;
}

/**
 * Formats seconds for the Stream Deck "Dynamic Length" button title:
 * e.g. 60 -> "1:00", 210 -> "3:30", 30 -> "0:30", 3600 -> "1:00:00".
 */
export function formatDynamicButtonTitle(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    const mm = String(minutes).padStart(2, '0');
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

/**
 * Formats seconds as HH:MM:SS or MM:SS for display in settings helpers.
 */
export function formatTimecodeVerbose(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Formats precise fractional seconds for FFmpeg commands and timeline logs.
 */
export function formatPreciseTimestamp(seconds: number): string {
  const safe = Math.max(0, seconds);
  const whole = Math.floor(safe);
  const centis = Math.round((safe - whole) * 100);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const secs = whole % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(Math.min(99, centis)).padStart(2, '0')}`;
}

/**
 * Formats duration tag appended to output filenames:
 * e.g. 30 -> "30s", 210 -> "3m30s", 3600 -> "1h00m00s"
 */
export function formatFilenameDurationTag(totalSeconds: number): string {
  const safe = Math.max(1, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
  }
  if (minutes > 0 && seconds === 0) {
    return `${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

/**
 * Fail timer rule:
 * Minimum fail counter is 10 seconds, plus 2 seconds for every 5 minutes (300s) of master buffer length.
 */
export function calculateFailTimeoutSeconds(masterBufferSeconds: number): number {
  const safeSeconds = Math.max(0, masterBufferSeconds);
  const fiveMinuteBlocks = Math.floor(safeSeconds / 300);
  return Math.max(10, 10 + fiveMinuteBlocks * 2);
}

export interface TrimCalculationResult {
  alignedEndSeconds: number;
  idealStartSeconds: number;
  keyframeStartSeconds: number;
  outputDurationSeconds: number;
  wasClampedToBuffer: boolean;
  outputFileName: string;
  ffmpegCommand: string;
}

export function computeReplayTrimPlan(params: {
  requestedSeconds: number;
  masterElapsedSeconds: number;
  ffmpegPath: string;
  mainCapturesDir: string;
  outputDir: string;
  masterFileBaseName?: string;
  keyframeGopSeconds?: number;
  audioTracksMode?: 'all' | 'custom';
  audioTracks?: number[];
}): TrimCalculationResult {
  const {
    requestedSeconds,
    masterElapsedSeconds,
    ffmpegPath,
    mainCapturesDir,
    outputDir,
    masterFileBaseName = 'Replay_2026-10-23_19-42-18',
    keyframeGopSeconds = 2,
    audioTracksMode = 'all',
    audioTracks = [],
  } = params;

  const alignedEndSeconds = Math.max(0.5, masterElapsedSeconds);
  const req = Math.max(1, requestedSeconds);

  let wasClampedToBuffer = false;
  let idealStartSeconds = 0;
  let keyframeStartSeconds = 0;

  if (alignedEndSeconds <= req) {
    wasClampedToBuffer = true;
    idealStartSeconds = 0;
    keyframeStartSeconds = 0;
  } else {
    idealStartSeconds = alignedEndSeconds - req;
    // Simulate ffprobe nearest preceding I-frame lookup
    keyframeStartSeconds =
      keyframeGopSeconds > 0
        ? Math.floor(idealStartSeconds / keyframeGopSeconds) * keyframeGopSeconds
        : idealStartSeconds;
  }

  const outputDurationSeconds = Math.max(0.1, Number((alignedEndSeconds - keyframeStartSeconds).toFixed(2)));
  const tag = formatFilenameDurationTag(req);
  const outputFileName = `${masterFileBaseName}_${tag}.mp4`;

  const resolvedFfmpeg = ffmpegPath.trim() ? `"${ffmpegPath.trim()}"` : 'ffmpeg';
  const cleanSourceDir = (mainCapturesDir.trim() || 'C:\\Videos\\Captures').replace(/[\\/]+$/, '');
  const cleanOutDir = (outputDir.trim() || cleanSourceDir).replace(/[\\/]+$/, '');
  const sep = cleanSourceDir.includes('/') ? '/' : '\\';

  const masterFullPath = `${cleanSourceDir}${sep}${masterFileBaseName}.mp4`;
  const outputFullPath = `${cleanOutDir}${sep}${outputFileName}`;

  const validCustomTracks = Array.from(
    new Set(audioTracks.filter((n) => Number.isInteger(n) && n >= 1 && n <= 6))
  ).sort((a, b) => a - b);

  let audioMapClause = '-map 0:a?';
  let shortestFlag = ' -shortest';
  if (audioTracksMode === 'custom') {
    if (validCustomTracks.length === 0) {
      audioMapClause = '-an';
      shortestFlag = '';
    } else {
      audioMapClause = validCustomTracks.map((t) => `-map 0:a:${t - 1}?`).join(' ');
    }
  }

  const ffmpegCommand = `${resolvedFfmpeg} -hide_banner -loglevel error -y -ss ${keyframeStartSeconds.toFixed(3)} -to ${alignedEndSeconds.toFixed(3)} -i "${masterFullPath}" -map 0:v ${audioMapClause} -c copy -avoid_negative_ts make_zero${shortestFlag} "${outputFullPath}"`;

  return {
    alignedEndSeconds,
    idealStartSeconds,
    keyframeStartSeconds,
    outputDurationSeconds,
    wasClampedToBuffer,
    outputFileName,
    ffmpegCommand,
  };
}
