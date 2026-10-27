import { GeneratedPluginFile, GlobalPluginSettings } from '../types/plugin';

export const PLUGIN_UUID = 'com.antvenom.replayslice';
export const PLUGIN_VERSION = '1.0.3';
export const SD_PLUGIN_FOLDER = `${PLUGIN_UUID}.sdPlugin`;

export function generateManifestJson(): string {
  const manifest = {
    $schema: 'https://schemas.elgato.com/streamdeck/plugins/manifest.json',
    UUID: PLUGIN_UUID,
    Name: 'ReplaySlice',
    Version: PLUGIN_VERSION,
    Author: 'ReplaySlice',
    Description:
      'Multi-length Instant Replay trimmer for OBS, ShadowPlay, and any capture software using FFmpeg stream copy.',
    Category: 'ReplaySlice',
    CategoryIcon: 'imgs/category',
    Icon: 'imgs/plugin',
    SDKVersion: 2,
    Software: {
      MinimumVersion: '6.5',
    },
    OS: [
      {
        Platform: 'windows',
        MinimumVersion: '10',
      },
      {
        Platform: 'mac',
        MinimumVersion: '12',
      },
    ],
    Nodejs: {
      Version: '20',
      Debug: 'enabled',
    },
    CodePath: 'bin/plugin.mjs',
    PropertyInspectorPath: 'ui/property-inspector.html',
    Actions: [
      {
        UUID: `${PLUGIN_UUID}.fixedlength`,
        Name: 'Fixed Length',
        Tooltip: 'Capture and trim an instant replay to a fixed length',
        Icon: 'imgs/action-fixed',
        Controllers: ['Keypad'],
        States: [
          {
            Image: 'imgs/key-default',
            TitleAlignment: 'middle',
          },
        ],
      },
      {
        UUID: `${PLUGIN_UUID}.dynamiclength`,
        Name: 'Dynamic Length',
        Tooltip: 'Capture an instant replay using the live dynamic duration (default 1:00)',
        Icon: 'imgs/action-dynamic',
        Controllers: ['Keypad'],
        States: [
          {
            Image: 'imgs/key-dynamic',
            TitleAlignment: 'middle',
            FontSize: '16',
          },
        ],
      },
      {
        UUID: `${PLUGIN_UUID}.dynamicincrease`,
        Name: 'Dynamic Increase',
        Tooltip: 'Increase Dynamic Length by a step duration configured on this button (hold to repeat)',
        Icon: 'imgs/action-plus',
        Controllers: ['Keypad'],
        States: [
          {
            Image: 'imgs/key-default',
            TitleAlignment: 'middle',
            FontSize: '16',
          },
        ],
      },
      {
        UUID: `${PLUGIN_UUID}.dynamicdecrease`,
        Name: 'Dynamic Decrease',
        Tooltip: 'Decrease Dynamic Length by a step duration configured on this button (hold to repeat)',
        Icon: 'imgs/action-minus',
        Controllers: ['Keypad'],
        States: [
          {
            Image: 'imgs/key-default',
            TitleAlignment: 'middle',
            FontSize: '16',
          },
        ],
      },
      {
        UUID: `${PLUGIN_UUID}.dynamicreset`,
        Name: 'Reset Dynamic Length',
        Tooltip: 'Set or reset Dynamic Length to a specific duration configured on this button (default 0:30)',
        Icon: 'imgs/action-reset',
        Controllers: ['Keypad'],
        States: [
          {
            Image: 'imgs/key-default',
            TitleAlignment: 'middle',
          },
        ],
      },
      {
        UUID: `${PLUGIN_UUID}.openfolder`,
        Name: 'Open Output Directory',
        Tooltip: 'Open the configured Output Directory where trimmed clips are saved',
        Icon: 'imgs/action-folder',
        Controllers: ['Keypad'],
        States: [
          {
            Image: 'imgs/key-default',
            TitleAlignment: 'middle',
          },
        ],
      },
      {
        UUID: `${PLUGIN_UUID}.opencaptures`,
        Name: 'Open Captures Directory',
        Tooltip: 'Open the configured Main Captures Directory where master replays are saved',
        Icon: 'imgs/action-captures',
        Controllers: ['Keypad'],
        States: [
          {
            Image: 'imgs/key-default',
            TitleAlignment: 'middle',
          },
        ],
      },
    ],
  };

  return JSON.stringify(manifest, null, 2);
}

export function generatePluginNodeBackend(defaults: GlobalPluginSettings): string {
  const serializedDefaults = JSON.stringify(
    {
      openAfterSave: defaults.openAfterSave ?? false,
      deleteOriginal: defaults.deleteOriginal ?? true,
      masterHotkey: defaults.masterHotkey || 'Alt+F10',
      mainCapturesDir: defaults.mainCapturesDir || '',
      outputDir: defaults.outputDir || '',
      ffmpegPath: defaults.ffmpegPath || '',
      successSoundPath: defaults.successSoundPath || '',
      errorSoundPath: defaults.errorSoundPath || '',
      repeatDelaySeconds: Number.isFinite(defaults.repeatDelaySeconds) ? defaults.repeatDelaySeconds : 0.5,
      repeatRateHz: Number.isFinite(defaults.repeatRateHz) ? defaults.repeatRateHz : 5,
      dynamicCurrentSeconds: 60,
      enableDebugLog: false,
      uiMenuOpen: {
        appearance: false,
        dirs: true,
        sounds: true,
        repeat: false,
        diagnostics: false,
      },
    },
    null,
    2
  );

  const lines = [
    '#!/usr/bin/env node',
    '/**',
    ' * ReplaySlice — Elgato Stream Deck Node.js 20 Plugin Backend',
    ' * Standalone zero-dependency ESM module (uses only built-in Node 20 APIs).',
    ' * Supports OBS, Nvidia ShadowPlay, AMD ReLive, or any hotkey-triggered replay buffer.',
    ' */',
    '',
    "import http from 'node:http';",
    "import crypto from 'node:crypto';",
    "import fs from 'node:fs';",
    "import path from 'node:path';",
    "import os from 'node:os';",
    "import { spawn, execFile } from 'node:child_process';",
    "import { fileURLToPath } from 'node:url';",
    '',
    'const __filename = fileURLToPath(import.meta.url);',
    'const __dirname = path.dirname(__filename);',
    'const PLUGIN_ROOT = path.resolve(__dirname, "..");',
    'const LOG_DIR = path.join(PLUGIN_ROOT, "logs");',
    'const LOG_FILE = path.join(LOG_DIR, "replayslice.log");',
    'const FORCE_DEBUG_LOG = false; // Developer override: set true or toggle Diagnostics in Property Inspector',
    '',
    'const ACTION_FIXED = "com.antvenom.replayslice.fixedlength";',
    'const ACTION_DYNAMIC = "com.antvenom.replayslice.dynamiclength";',
    'const ACTION_INCREASE = "com.antvenom.replayslice.dynamicincrease";',
    'const ACTION_DECREASE = "com.antvenom.replayslice.dynamicdecrease";',
    'const ACTION_RESET = "com.antvenom.replayslice.dynamicreset";',
    'const ACTION_OPEN_OUTPUT = "com.antvenom.replayslice.openfolder";',
    'const ACTION_OPEN_CAPTURES = "com.antvenom.replayslice.opencaptures";',
    '',
    'const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".mov", ".avi", ".flv", ".ts", ".m4v", ".webm"]);',
    'const DEBOUNCE_MS = 2000;',
    '',
    `const DEFAULT_GLOBAL_SETTINGS = ${serializedDefaults};`,
    'let globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };',
    '',
    'function writeLog(level, message, extra = "") {',
    '  if (!FORCE_DEBUG_LOG && (!globalSettings || !globalSettings.enableDebugLog)) return;',
    '  try {',
    '    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });',
    '    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 512 * 1024) {',
    '      fs.renameSync(LOG_FILE, LOG_FILE + ".old");',
    '    }',
    '    const stamp = new Date().toISOString();',
    '    const suffix = extra ? " | " + (typeof extra === "string" ? extra : JSON.stringify(extra)) : "";',
    '    fs.appendFileSync(LOG_FILE, `[${stamp}] [${level}] ${message}${suffix}\\n`, "utf8");',
    '  } catch {',
    '    // Ignore logging errors',
    '  }',
    '}',
    '',
    '// ---------------------------------------------------------------------------',
    '// 1. Minimal RFC-6455 Loopback WebSocket Client (Zero External Dependencies)',
    '// ---------------------------------------------------------------------------',
    'class LocalStreamDeckSocket {',
    '  constructor(port, onOpen, onMessage, onClose) {',
    '    this.port = Number(port);',
    '    this.onOpen = onOpen;',
    '    this.onMessage = onMessage;',
    '    this.onClose = onClose;',
    '    this.socket = null;',
    '    this.rxBuffer = Buffer.alloc(0);',
    '    this.fragments = [];',
    '    this.connect();',
    '  }',
    '',
    '  connect() {',
    '    const key = crypto.randomBytes(16).toString("base64");',
    '    const req = http.request({',
    '      host: "127.0.0.1",',
    '      port: this.port,',
    '      path: "/",',
    '      headers: {',
    '        Connection: "Upgrade",',
    '        Upgrade: "websocket",',
    '        "Sec-WebSocket-Version": "13",',
    '        "Sec-WebSocket-Key": key,',
    '      },',
    '    });',
    '',
    '    req.on("upgrade", (_res, socket, head) => {',
    '      this.socket = socket;',
    '      socket.setNoDelay(true);',
    '      if (head && head.length > 0) {',
    '        this.rxBuffer = Buffer.concat([this.rxBuffer, head]);',
    '        this.drainFrames();',
    '      }',
    '      socket.on("data", (chunk) => {',
    '        this.rxBuffer = Buffer.concat([this.rxBuffer, chunk]);',
    '        this.drainFrames();',
    '      });',
    '      socket.on("close", () => {',
    '        if (this.onClose) this.onClose();',
    '      });',
    '      socket.on("error", (err) => {',
    '        writeLog("ERROR", "WebSocket socket error", err.message);',
    '      });',
    '      if (this.onOpen) this.onOpen();',
    '    });',
    '',
    '    req.on("error", (err) => {',
    '      writeLog("ERROR", "WebSocket handshake error", err.message);',
    '    });',
    '',
    '    req.end();',
    '  }',
    '',
    '  drainFrames() {',
    '    while (this.rxBuffer.length >= 2) {',
    '      const firstByte = this.rxBuffer[0];',
    '      const secondByte = this.rxBuffer[1];',
    '      const fin = (firstByte & 0x80) !== 0;',
    '      const opcode = firstByte & 0x0f;',
    '      const masked = (secondByte & 0x80) !== 0;',
    '      let payloadLen = secondByte & 0x7f;',
    '      let offset = 2;',
    '',
    '      if (payloadLen === 126) {',
    '        if (this.rxBuffer.length < 4) return;',
    '        payloadLen = this.rxBuffer.readUInt16BE(2);',
    '        offset = 4;',
    '      } else if (payloadLen === 127) {',
    '        if (this.rxBuffer.length < 10) return;',
    '        payloadLen = Number(this.rxBuffer.readBigUInt64BE(2));',
    '        offset = 10;',
    '      }',
    '',
    '      const maskBytes = masked ? 4 : 0;',
    '      const totalFrameLen = offset + maskBytes + payloadLen;',
    '      if (this.rxBuffer.length < totalFrameLen) return;',
    '',
    '      let payload = Buffer.from(this.rxBuffer.subarray(offset + maskBytes, totalFrameLen));',
    '      if (masked) {',
    '        const mask = this.rxBuffer.subarray(offset, offset + 4);',
    '        for (let i = 0; i < payload.length; i++) {',
    '          payload[i] ^= mask[i & 3];',
    '        }',
    '      }',
    '      this.rxBuffer = this.rxBuffer.subarray(totalFrameLen);',
    '',
    '      if (opcode === 0x8) {',
    '        // Close frame',
    '        if (this.socket) this.socket.end();',
    '        return;',
    '      } else if (opcode === 0x9) {',
    '        // Ping -> Pong',
    '        this.sendRawFrame(0x8a, payload);',
    '      } else if (opcode === 0x1 || opcode === 0x0) {',
    '        this.fragments.push(payload);',
    '        if (fin) {',
    '          const fullBuf = Buffer.concat(this.fragments);',
    '          this.fragments = [];',
    '          try {',
    '            const parsed = JSON.parse(fullBuf.toString("utf8"));',
    '            if (this.onMessage) this.onMessage(parsed);',
    '          } catch (err) {',
    '            writeLog("ERROR", "Failed to parse Stream Deck JSON", err.message);',
    '          }',
    '        }',
    '      }',
    '    }',
    '  }',
    '',
    '  sendRawFrame(firstByte, payloadBuffer) {',
    '    if (!this.socket || this.socket.destroyed) return;',
    '    const len = payloadBuffer.length;',
    '    let header;',
    '    if (len < 126) {',
    '      header = Buffer.alloc(2);',
    '      header[0] = firstByte;',
    '      header[1] = 0x80 | len;',
    '    } else if (len < 65536) {',
    '      header = Buffer.alloc(4);',
    '      header[0] = firstByte;',
    '      header[1] = 0x80 | 126;',
    '      header.writeUInt16BE(len, 2);',
    '    } else {',
    '      header = Buffer.alloc(10);',
    '      header[0] = firstByte;',
    '      header[1] = 0x80 | 127;',
    '      header.writeBigUInt64BE(BigInt(len), 2);',
    '    }',
    '    const mask = crypto.randomBytes(4);',
    '    const maskedPayload = Buffer.alloc(len);',
    '    for (let i = 0; i < len; i++) {',
    '      maskedPayload[i] = payloadBuffer[i] ^ mask[i & 3];',
    '    }',
    '    this.socket.write(Buffer.concat([header, mask, maskedPayload]));',
    '  }',
    '',
    '  sendJSON(obj) {',
    '    const buf = Buffer.from(JSON.stringify(obj), "utf8");',
    '    this.sendRawFrame(0x81, buf);',
    '  }',
    '}',
    '',
    '// ---------------------------------------------------------------------------',
    '// 2. Timecode, Fail Timer & Filename Formatting Helpers',
    '// ---------------------------------------------------------------------------',
    'function parseTimecodeToSeconds(raw, fallback = 30) {',
    '  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : fallback;',
    '  if (!raw || typeof raw !== "string") return fallback;',
    '  const cleaned = raw.trim().replace(/s$/i, "");',
    '  if (!cleaned) return fallback;',
    '  if (cleaned.includes(":")) {',
    '    const parts = cleaned.split(":").map((p) => Number(p.trim()));',
    '    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return fallback;',
    '    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];',
    '    if (parts.length === 2) return parts[0] * 60 + parts[1];',
    '  }',
    '  const num = Number(cleaned);',
    '  return Number.isFinite(num) && num >= 0 ? num : fallback;',
    '}',
    '',
    'function formatDynamicTitle(totalSeconds) {',
    '  const safe = Math.max(0, Math.round(totalSeconds));',
    '  const h = Math.floor(safe / 3600);',
    '  const m = Math.floor((safe % 3600) / 60);',
    '  const s = safe % 60;',
    '  const ss = String(s).padStart(2, "0");',
    '  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;',
    '  return `${m}:${ss}`;',
    '}',
    '',
    'function formatDurationTag(totalSeconds) {',
    '  const safe = Math.max(1, Math.round(totalSeconds));',
    '  const h = Math.floor(safe / 3600);',
    '  const m = Math.floor((safe % 3600) / 60);',
    '  const s = safe % 60;',
    '  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;',
    '  if (m > 0 && s === 0) return `${m}m`;',
    '  if (m > 0) return `${m}m${String(s).padStart(2, "0")}s`;',
    '  return `${s}s`;',
    '}',
    '',
    '// Lowest fail timer is 10 seconds, +2 seconds for every 5 minutes (300s) of master video length.',
    'function calculateFailTimeoutSeconds(masterBufferSeconds) {',
    '  const safe = Math.max(0, masterBufferSeconds);',
    '  return Math.max(10, 10 + Math.floor(safe / 300) * 2);',
    '}',
    '',
    '// ---------------------------------------------------------------------------',
    '// 3. FFmpeg / FFprobe / FFplay Discovery & Process Runner',
    '// ---------------------------------------------------------------------------',
    'function execFilePromise(cmd, args, timeoutMs = 15000) {',
    '  return new Promise((resolve, reject) => {',
    '    const child = execFile(',
    '      cmd,',
    '      args,',
    '      { windowsHide: true, timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },',
    '      (err, stdout, stderr) => {',
    '        if (err) {',
    '          err.stdout = stdout;',
    '          err.stderr = stderr;',
    '          reject(err);',
    '        } else {',
    '          resolve({ stdout, stderr });',
    '        }',
    '      }',
    '    );',
    '    child.on("error", reject);',
    '  });',
    '}',
    '',
    'async function resolveFfmpegSuite(customFfmpegPath) {',
    '  const isWin = process.platform === "win32";',
    '  const exeSuffix = isWin ? ".exe" : "";',
    '  let ffmpegBin = "";',
    '',
    '  if (customFfmpegPath && customFfmpegPath.trim()) {',
    '    let candidate = customFfmpegPath.trim().replace(/^"+|"+$/g, "");',
    '    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {',
    '      candidate = path.join(candidate, "ffmpeg" + exeSuffix);',
    '    }',
    '    if (!fs.existsSync(candidate)) {',
    '      throw new Error(`Configured FFmpeg path does not exist: ${candidate}`);',
    '    }',
    '    ffmpegBin = candidate;',
    '  } else {',
    '    const lookupCmd = isWin ? "where" : "which";',
    '    try {',
    '      const { stdout } = await execFilePromise(lookupCmd, ["ffmpeg"], 5000);',
    '      const firstLine = stdout.split(/\\r?\\n/).map((l) => l.trim()).find(Boolean);',
    '      if (firstLine && fs.existsSync(firstLine)) {',
    '        ffmpegBin = firstLine;',
    '      }',
    '    } catch {',
    '      // Fallback common macOS Homebrew / MacPorts paths (GUI apps on macOS often omit /opt/homebrew/bin from PATH)',
    '      if (!isWin) {',
    '        for (const fallback of ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {',
    '          if (fs.existsSync(fallback)) {',
    '            ffmpegBin = fallback;',
    '            break;',
    '          }',
    '        }',
    '      }',
    '    }',
    '  }',
    '',
    '  if (!ffmpegBin) {',
    '    throw new Error("FFmpeg was not detected in PATH or configured FFmpeg Path.");',
    '  }',
    '',
    '  // Verify ffmpeg actually runs',
    '  await execFilePromise(ffmpegBin, ["-version"], 5000);',
    '',
    '  const binDir = path.dirname(ffmpegBin);',
    '  const siblingProbe = path.join(binDir, "ffprobe" + exeSuffix);',
    '  const siblingPlay = path.join(binDir, "ffplay" + exeSuffix);',
    '',
    '  let ffprobeBin = fs.existsSync(siblingProbe) ? siblingProbe : "";',
    '  let ffplayBin = fs.existsSync(siblingPlay) ? siblingPlay : "";',
    '',
    '  if (!ffprobeBin) {',
    '    try {',
    '      const { stdout } = await execFilePromise(isWin ? "where" : "which", ["ffprobe"], 4000);',
    '      const first = stdout.split(/\\r?\\n/).map((l) => l.trim()).find(Boolean);',
    '      if (first && fs.existsSync(first)) ffprobeBin = first;',
    '    } catch {}',
    '  }',
    '  if (!ffplayBin) {',
    '    try {',
    '      const { stdout } = await execFilePromise(isWin ? "where" : "which", ["ffplay"], 4000);',
    '      const first = stdout.split(/\\r?\\n/).map((l) => l.trim()).find(Boolean);',
    '      if (first && fs.existsSync(first)) ffplayBin = first;',
    '    } catch {}',
    '  }',
    '',
    '  return { ffmpegBin, ffprobeBin, ffplayBin };',
    '}',
    '',
    '// ---------------------------------------------------------------------------',
    '// 4. Sound Playback (.wav, .mp3, .ogg, .m4a — Cross-Platform Async)',
    '// ---------------------------------------------------------------------------',
    'async function playSoundFile(soundPath, ffplayHint = "") {',
    '  if (!soundPath || !soundPath.trim()) return;',
    '  const cleanPath = soundPath.trim().replace(/^"+|"+$/g, "");',
    '  if (!fs.existsSync(cleanPath)) {',
    '    writeLog("WARN", "Sound file not found", cleanPath);',
    '    return;',
    '  }',
    '',
    '  // 1) Prefer ffplay if available (plays .mp3, .wav, .ogg, .flac, .m4a silently in background)',
    '  if (ffplayHint && fs.existsSync(ffplayHint)) {',
    '    const child = spawn(ffplayHint, ["-nodisp", "-autoexit", "-loglevel", "quiet", cleanPath], {',
    '      windowsHide: true,',
    '      detached: true,',
    '      stdio: "ignore",',
    '    });',
    '    child.unref();',
    '    return;',
    '  }',
    '',
    '  // 2) Native OS fallback (works even if FFmpeg is missing when playing Failure Sound!)',
    '  if (process.platform === "darwin") {',
    '    const child = spawn("afplay", [cleanPath], { detached: true, stdio: "ignore" });',
    '    child.unref();',
    '    return;',
    '  }',
    '',
    '  if (process.platform === "win32") {',
    '    const escaped = cleanPath.replace(/\'/g, "\'\'");',
    '    const ext = path.extname(cleanPath).toLowerCase();',
    '    let psScript;',
    '    if (ext === ".wav") {',
    '      psScript = `(New-Object System.Media.SoundPlayer \'${escaped}\').PlaySync()`;',
    '    } else {',
    '      // WPF MediaPlayer natively plays .mp3, .wav, .m4a, .wma on Windows 10/11',
    '      psScript = [',
    '        "Add-Type -AssemblyName PresentationCore;",',
    '        "$p = New-Object System.Windows.Media.MediaPlayer;",',
    '        `$p.Open([Uri]::new(\'${escaped}\'));`,',
    '        "$p.Volume = 1.0;",',
    '        "$p.Play();",',
    '        "Start-Sleep -Milliseconds 400;",',
    '        "$waited = 0;",',
    '        "while ($p.NaturalDuration.HasTimeSpan -eq $false -and $waited -lt 20) { Start-Sleep -Milliseconds 100; $waited++ }",',
    '        "if ($p.NaturalDuration.HasTimeSpan) { Start-Sleep -Milliseconds ([int]$p.NaturalDuration.TimeSpan.TotalMilliseconds + 150) } else { Start-Sleep -Seconds 3 }",',
    '        "$p.Close();"',
    '      ].join(" ");',
    '    }',
    '    const child = spawn(',
    '      "powershell.exe",',
    '      ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Sta", "-Command", psScript],',
    '      { windowsHide: true, detached: true, stdio: "ignore" }',
    '    );',
    '    child.unref();',
    '  }',
    '}',
    '',
    '// ---------------------------------------------------------------------------',
    '// 5. OS Hardware Hotkey Injection (OBS + Nvidia ShadowPlay Compatible)',
    '// ---------------------------------------------------------------------------',
    'const WIN_VK_MAP = {',
    '  BACKSPACE: 0x08, TAB: 0x09, ENTER: 0x0D, RETURN: 0x0D, PAUSE: 0x13, CAPSLOCK: 0x14, ESC: 0x1B, ESCAPE: 0x1B,',
    '  SPACE: 0x20, PAGEUP: 0x21, PAGEDOWN: 0x22, END: 0x23, HOME: 0x24, LEFT: 0x25, UP: 0x26, RIGHT: 0x27, DOWN: 0x28,',
    '  PRINTSCREEN: 0x2C, INSERT: 0x2D, DELETE: 0x2E,',
    '  NUM0: 0x60, NUM1: 0x61, NUM2: 0x62, NUM3: 0x63, NUM4: 0x64, NUM5: 0x65, NUM6: 0x66, NUM7: 0x67, NUM8: 0x68, NUM9: 0x69,',
    '  NUMPAD0: 0x60, NUMPAD1: 0x61, NUMPAD2: 0x62, NUMPAD3: 0x63, NUMPAD4: 0x64, NUMPAD5: 0x65, NUMPAD6: 0x66, NUMPAD7: 0x67, NUMPAD8: 0x68, NUMPAD9: 0x69,',
    '  MULTIPLY: 0x6A, ADD: 0x6B, SUBTRACT: 0x6D, DECIMAL: 0x6E, DIVIDE: 0x6F,',
    '  F1: 0x70, F2: 0x71, F3: 0x72, F4: 0x73, F5: 0x74, F6: 0x75, F7: 0x76, F8: 0x77, F9: 0x78, F10: 0x79, F11: 0x7A, F12: 0x7B,',
    '  F13: 0x7C, F14: 0x7D, F15: 0x7E, F16: 0x7F, F17: 0x80, F18: 0x81, F19: 0x82, F20: 0x83, F21: 0x84, F22: 0x85, F23: 0x86, F24: 0x87,',
    '  NUMLOCK: 0x90, SCROLLLOCK: 0x91,',
    '  ";": 0xBA, "=": 0xBB, ",": 0xBC, "-": 0xBD, ".": 0xBE, "/": 0xBF, "`": 0xC0, "[": 0xDB, "\\\\": 0xDC, "]": 0xDD, "\'": 0xDE,',
    '};',
    '',
    'const MAC_KEYCODE_MAP = {',
    '  A: 0, S: 1, D: 2, F: 3, H: 4, G: 5, Z: 6, X: 7, C: 8, V: 9, B: 11, Q: 12, W: 13, E: 14, R: 15, Y: 16, T: 17,',
    '  "1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23, "=": 24, "9": 25, "7": 26, "-": 27, "8": 28, "0": 29,',
    '  "]": 30, O: 31, U: 32, "[": 33, I: 34, P: 35, ENTER: 36, RETURN: 36, L: 37, J: 38, "\'": 39, K: 40, ";": 41,',
    '  "\\\\": 42, ",": 43, "/": 44, N: 45, M: 46, ".": 47, TAB: 48, SPACE: 49, "`": 50, BACKSPACE: 51, ESC: 53, ESCAPE: 53,',
    '  F1: 122, F2: 120, F3: 99, F4: 118, F5: 96, F6: 97, F7: 98, F8: 100, F9: 101, F10: 109, F11: 103, F12: 111,',
    '  HOME: 115, PAGEUP: 116, DELETE: 117, END: 119, PAGEDOWN: 121, LEFT: 123, RIGHT: 124, DOWN: 125, UP: 126,',
    '};',
    '',
    'function parseShortcutTokens(hotkeyStr) {',
    '  if (!hotkeyStr || !hotkeyStr.trim()) throw new Error("Master Replay Hotkey is empty.");',
    '  const rawTokens = hotkeyStr.split("+").map((t) => t.trim()).filter(Boolean);',
    '  const mods = { ctrl: false, alt: false, shift: false, meta: false };',
    '  let mainKey = "";',
    '',
    '  for (const tok of rawTokens) {',
    '    const upper = tok.toUpperCase();',
    '    if (upper === "CTRL" || upper === "CONTROL") mods.ctrl = true;',
    '    else if (upper === "ALT" || upper === "OPTION" || upper === "OPT") mods.alt = true;',
    '    else if (upper === "SHIFT") mods.shift = true;',
    '    else if (upper === "WIN" || upper === "WINDOWS" || upper === "CMD" || upper === "COMMAND" || upper === "META") mods.meta = true;',
    '    else mainKey = upper;',
    '  }',
    '  if (!mainKey) throw new Error(`Hotkey "${hotkeyStr}" must include a non-modifier key (e.g. Alt+F10).`);',
    '  return { mods, mainKey };',
    '}',
    '',
    'function resolveWinVirtualKey(mainKey) {',
    '  if (WIN_VK_MAP[mainKey] !== undefined) return WIN_VK_MAP[mainKey];',
    '  if (mainKey.length === 1) {',
    '    const code = mainKey.charCodeAt(0);',
    '    if ((code >= 0x30 && code <= 0x39) || (code >= 0x41 && code <= 0x5A)) return code;',
    '  }',
    '  throw new Error(`Unsupported Windows hotkey token: ${mainKey}`);',
    '}',
    '',
    'async function injectMasterHotkey(hotkeyStr) {',
    '  const { mods, mainKey } = parseShortcutTokens(hotkeyStr);',
    '',
    '  if (process.platform === "win32") {',
    '    const vkList = [];',
    '    if (mods.ctrl) vkList.push(0x11);',
    '    if (mods.alt) vkList.push(0x12);',
    '    if (mods.shift) vkList.push(0x10);',
    '    if (mods.meta) vkList.push(0x5B);',
    '    const mainVk = resolveWinVirtualKey(mainKey);',
    '',
    '    const downCalls = [...vkList, mainVk].map((vk) => `[ReplaySliceKey]::PressDown(${vk});`).join(" ");',
    '    const upCalls = [mainVk, ...vkList.slice().reverse()].map((vk) => `[ReplaySliceKey]::ReleaseUp(${vk});`).join(" ");',
    '',
    '    const ps = [',
    '      "Add-Type -TypeDefinition \'",',
    '      "using System;",',
    '      "using System.Runtime.InteropServices;",',
    '      "public static class ReplaySliceKey {",',
    '      "  [DllImport(\\"user32.dll\\")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);",',
    '      "  [DllImport(\\"user32.dll\\")] public static extern uint MapVirtualKey(uint uCode, uint uMapType);",',
    '      "  public static void PressDown(byte vk) { byte sc = (byte)MapVirtualKey(vk, 0); keybd_event(vk, sc, 0, UIntPtr.Zero); }",',
    '      "  public static void ReleaseUp(byte vk) { byte sc = (byte)MapVirtualKey(vk, 0); keybd_event(vk, sc, 2, UIntPtr.Zero); }",',
    '      "}\';",',
    '      downCalls,',
    '      "Start-Sleep -Milliseconds 50;",',
    '      upCalls,',
    '    ].join(" ");',
    '',
    '    await execFilePromise("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", ps], 6000);',
    '    return;',
    '  }',
    '',
    '  if (process.platform === "darwin") {',
    '    const keyCode = MAC_KEYCODE_MAP[mainKey];',
    '    if (keyCode === undefined) throw new Error(`Unsupported macOS key token: ${mainKey}`);',
    '    const usingMods = [];',
    '    if (mods.meta) usingMods.push("command down");',
    '    if (mods.alt) usingMods.push("option down");',
    '    if (mods.ctrl) usingMods.push("control down");',
    '    if (mods.shift) usingMods.push("shift down");',
    '    const modClause = usingMods.length > 0 ? ` using {${usingMods.join(", ")}}` : "";',
    '    const osa = `tell application "System Events" to key code ${keyCode}${modClause}`;',
    '    await execFilePromise("osascript", ["-e", osa], 6000);',
    '    return;',
    '  }',
    '',
    '  throw new Error(`Unsupported platform: ${process.platform}`);',
    '}',
    '',
    '// ---------------------------------------------------------------------------',
    '// 6. Recursive Directory Snapshot & Write-Lock Readiness Poll',
    '// ---------------------------------------------------------------------------',
    'function scanVideoFilesRecursive(rootDir, excludedDirResolved) {',
    '  const found = new Map();',
    '  function walk(dir) {',
    '    let entries;',
    '    try {',
    '      entries = fs.readdirSync(dir, { withFileTypes: true });',
    '    } catch {',
    '      return;',
    '    }',
    '    for (const entry of entries) {',
    '      if (entry.name.startsWith(".")) continue;',
    '      const fullPath = path.join(dir, entry.name);',
    '      const resolved = path.resolve(fullPath);',
    '      if (entry.isDirectory()) {',
    '        if (excludedDirResolved && resolved.toLowerCase() === excludedDirResolved.toLowerCase()) continue;',
    '        walk(fullPath);',
    '      } else if (entry.isFile()) {',
    '        const ext = path.extname(entry.name).toLowerCase();',
    '        if (!VIDEO_EXTENSIONS.has(ext)) continue;',
    '        try {',
    '          const st = fs.statSync(fullPath);',
    '          found.set(resolved, { path: fullPath, mtimeMs: st.mtimeMs, size: st.size });',
    '        } catch {}',
    '      }',
    '    }',
    '  }',
    '  walk(rootDir);',
    '  return found;',
    '}',
    '',
    'function isFileUnlockedForReadWrite(filePath) {',
    '  let fd = null;',
    '  try {',
    '    fd = fs.openSync(filePath, "r+");',
    '    return true;',
    '  } catch {',
    '    return false;',
    '  } finally {',
    '    if (fd !== null) {',
    '      try { fs.closeSync(fd); } catch {}',
    '    }',
    '  }',
    '}',
    '',
    'function sleep(ms) {',
    '  return new Promise((r) => setTimeout(r, ms));',
    '}',
    '',
    'async function waitForReadyMasterClip(mainCapturesDir, excludedOutDir, baselineMap, triggerEpochMs, deadlineEpochMs) {',
    '  let trackedPath = "";',
    '  let lastSize = -1;',
    '  let stableTicks = 0;',
    '',
    '  while (Date.now() < deadlineEpochMs) {',
    '    const currentMap = scanVideoFilesRecursive(mainCapturesDir, excludedOutDir);',
    '    let newestCandidate = null;',
    '',
    '    for (const [resolvedPath, info] of currentMap.entries()) {',
    '      const prev = baselineMap.get(resolvedPath);',
    '      const isNewOrUpdated = !prev || info.mtimeMs > prev.mtimeMs + 50 || info.size !== prev.size;',
    '      if (isNewOrUpdated && info.mtimeMs >= triggerEpochMs - 1500) {',
    '        if (!newestCandidate || info.mtimeMs > newestCandidate.mtimeMs) {',
    '          newestCandidate = info;',
    '        }',
    '      }',
    '    }',
    '',
    '    if (newestCandidate && newestCandidate.size > 0) {',
    '      if (newestCandidate.path !== trackedPath) {',
    '        trackedPath = newestCandidate.path;',
    '        lastSize = newestCandidate.size;',
    '        stableTicks = 0;',
    '      } else if (newestCandidate.size === lastSize) {',
    '        if (isFileUnlockedForReadWrite(trackedPath)) {',
    '          stableTicks += 1;',
    '          if (stableTicks >= 2) {',
    '            return trackedPath;',
    '          }',
    '        } else {',
    '          stableTicks = 0;',
    '        }',
    '      } else {',
    '        lastSize = newestCandidate.size;',
    '        stableTicks = 0;',
    '      }',
    '    }',
    '',
    '    await sleep(250);',
    '  }',
    '',
    '  throw new Error("Timed out waiting for master instant replay clip to finish writing to disk.");',
    '}',
    '',
    '// ---------------------------------------------------------------------------',
    '// 7. FFprobe Stream-Length Inspection & Keyframe-Aligned Stream Copy',
    '// ---------------------------------------------------------------------------',
    'async function probeAlignedDurationAndKeyframe(ffmpegBin, ffprobeBin, masterFile, requestedSeconds) {',
    '  let formatDur = 0;',
    '  const videoDurs = [];',
    '  const audioDurs = [];',
    '',
    '  if (ffprobeBin) {',
    '    const { stdout } = await execFilePromise(',
    '      ffprobeBin,',
    '      ["-v", "error", "-show_entries", "format=duration:stream=codec_type,duration", "-of", "json", masterFile],',
    '      10000',
    '    );',
    '    const meta = JSON.parse(stdout);',
    '    if (meta.format && meta.format.duration) {',
    '      const d = Number(meta.format.duration);',
    '      if (Number.isFinite(d) && d > 0) formatDur = d;',
    '    }',
    '    for (const s of meta.streams || []) {',
    '      const sd = Number(s.duration);',
    '      if (!Number.isFinite(sd) || sd <= 0) continue;',
    '      if (s.codec_type === "video") videoDurs.push(sd);',
    '      if (s.codec_type === "audio") audioDurs.push(sd);',
    '    }',
    '  } else {',
    '    // Fallback: parse Duration: HH:MM:SS.xx from ffmpeg -i stderr',
    '    try {',
    '      await execFilePromise(ffmpegBin, ["-i", masterFile], 8000);',
    '    } catch (err) {',
    '      const match = String(err.stderr || "").match(/Duration:\\s*(\\d+):(\\d+):(\\d+(?:\\.\\d+)?)/);',
    '      if (match) {',
    '        formatDur = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);',
    '      }',
    '    }',
    '  }',
    '',
    '  let alignedEnd = formatDur;',
    '  if (videoDurs.length > 0 && audioDurs.length > 0) {',
    '    alignedEnd = Math.min(Math.max(...videoDurs), Math.min(...audioDurs));',
    '  } else if (videoDurs.length > 0) {',
    '    alignedEnd = Math.max(...videoDurs);',
    '  }',
    '',
    '  if (!Number.isFinite(alignedEnd) || alignedEnd <= 0) {',
    '    throw new Error("Could not determine valid media duration from master replay file.");',
    '  }',
    '',
    '  // Short-buffer check: if requested clip is >= actual master buffer duration, clamp start to 0',
    '  if (alignedEnd <= requestedSeconds) {',
    '    return { alignedEnd, trimStart: 0, wasClamped: true };',
    '  }',
    '',
    '  const idealStart = alignedEnd - requestedSeconds;',
    '  let keyframeStart = idealStart;',
    '',
    '  // Snap to exact preceding I-frame via ffprobe so video & audio start together at PTS 0.000',
    '  if (ffprobeBin) {',
    '    try {',
    '      const searchFrom = Math.max(0, idealStart - 8).toFixed(3);',
    '      const searchTo = (idealStart + 0.25).toFixed(3);',
    '      const { stdout } = await execFilePromise(',
    '        ffprobeBin,',
    '        [',
    '          "-v", "error",',
    '          "-read_intervals", `${searchFrom}%${searchTo}`,',
    '          "-select_streams", "v:0",',
    '          "-skip_frame", "nokey",',
    '          "-show_entries", "frame=best_effort_timestamp_time,pkt_pts_time",',
    '          "-of", "json",',
    '          masterFile,',
    '        ],',
    '        8000',
    '      );',
    '      const framesData = JSON.parse(stdout);',
    '      const ptsValues = (framesData.frames || [])',
    '        .map((f) => Number(f.best_effort_timestamp_time ?? f.pkt_pts_time))',
    '        .filter((v) => Number.isFinite(v) && v >= 0 && v <= idealStart + 0.15)',
    '        .sort((a, b) => a - b);',
    '      if (ptsValues.length > 0) {',
    '        keyframeStart = ptsValues[ptsValues.length - 1];',
    '      }',
    '    } catch (err) {',
    '      writeLog("WARN", "Keyframe lookup fell back to idealStart", err.message);',
    '    }',
    '  }',
    '',
    '  return { alignedEnd, trimStart: keyframeStart, wasClamped: false };',
    '}',
    '',
    'function buildUniqueOutputPath(outputDir, masterFile, requestedSeconds) {',
    '  const parsed = path.parse(masterFile);',
    '  const tag = formatDurationTag(requestedSeconds);',
    '  let candidate = path.join(outputDir, `${parsed.name}_${tag}${parsed.ext}`);',
    '  let counter = 1;',
    '  while (fs.existsSync(candidate) && path.resolve(candidate) === path.resolve(masterFile)) {',
    '    candidate = path.join(outputDir, `${parsed.name}_${tag}_${counter}${parsed.ext}`);',
    '    counter++;',
    '  }',
    '  while (fs.existsSync(candidate)) {',
    '    candidate = path.join(outputDir, `${parsed.name}_${tag}_${counter}${parsed.ext}`);',
    '    counter++;',
    '  }',
    '  return candidate;',
    '}',
    '',
    '// ---------------------------------------------------------------------------',
    '// 8. Native OS Folder & File Picker Helpers for Property Inspector',
    '// ---------------------------------------------------------------------------',
    'async function pickNativeFolder(promptTitle) {',
    '  if (process.platform === "win32") {',
    '    const ps = [',
    '      "Add-Type -AssemblyName System.Windows.Forms;",',
    '      "$f = New-Object System.Windows.Forms.FolderBrowserDialog;",',
    '      `$f.Description = \'${promptTitle.replace(/\'/g, "\'\'")}\';`,',
    '      "$f.ShowNewFolderButton = $true;",',
    '      "if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }"',
    '    ].join(" ");',
    '    const { stdout } = await execFilePromise("powershell.exe", ["-NoProfile", "-Sta", "-WindowStyle", "Hidden", "-Command", ps], 120000);',
    '    return stdout.trim();',
    '  }',
    '  if (process.platform === "darwin") {',
    '    const { stdout } = await execFilePromise("osascript", ["-e", `POSIX path of (choose folder with prompt "${promptTitle.replace(/"/g, "")}")`], 120000);',
    '    return stdout.trim();',
    '  }',
    '  return "";',
    '}',
    '',
    'async function pickNativeFile(promptTitle, filterKind) {',
    '  if (process.platform === "win32") {',
    '    const filterStr = filterKind === "audio"',
    '      ? "Audio Files (*.wav;*.mp3;*.ogg;*.m4a)|*.wav;*.mp3;*.ogg;*.m4a|All Files (*.*)|*.*"',
    '      : filterKind === "image"',
    '        ? "Image Files (*.png;*.jpg;*.jpeg;*.webp;*.bmp;*.svg)|*.png;*.jpg;*.jpeg;*.webp;*.bmp;*.svg|All Files (*.*)|*.*"',
    '        : "Executable Files (*.exe)|*.exe|All Files (*.*)|*.*";',
    '    const ps = [',
    '      "Add-Type -AssemblyName System.Windows.Forms;",',
    '      "$d = New-Object System.Windows.Forms.OpenFileDialog;",',
    '      `$d.Title = \'${promptTitle.replace(/\'/g, "\'\'")}\';`,',
    '      `$d.Filter = \'${filterStr}\';`,',
    '      "if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.FileName }"',
    '    ].join(" ");',
    '    const { stdout } = await execFilePromise("powershell.exe", ["-NoProfile", "-Sta", "-WindowStyle", "Hidden", "-Command", ps], 120000);',
    '    return stdout.trim();',
    '  }',
    '  if (process.platform === "darwin") {',
    '    const { stdout } = await execFilePromise("osascript", ["-e", `POSIX path of (choose file with prompt "${promptTitle.replace(/"/g, "")}")`], 120000);',
    '    return stdout.trim();',
    '  }',
    '  return "";',
    '}',
    '',
    '// ---------------------------------------------------------------------------',
    '// 9. Main Stream Deck Runtime Controller',
    '// ---------------------------------------------------------------------------',
    'function parseCliArgs(argv) {',
    '  const out = {};',
    '  for (let i = 2; i < argv.length; i++) {',
    '    const flag = argv[i];',
    '    if (flag.startsWith("-") && i + 1 < argv.length) {',
    '      out[flag.slice(1)] = argv[i + 1];',
    '      i++;',
    '    }',
    '  }',
    '  return out;',
    '}',
    '',
    'const cli = parseCliArgs(process.argv);',
    'if (!cli.port || !cli.pluginUUID || !cli.registerEvent) {',
    '  writeLog("ERROR", "Missing Stream Deck launch flags", process.argv);',
    '  process.exit(1);',
    '}',
    '',
    'const DEFAULT_TITLE_PARAMS = {',
    '  fontFamily: "",',
    '  fontSize: 16,',
    '  fontStyle: "Bold",',
    '  fontUnderline: false,',
    '  showTitle: true,',
    '  titleAlignment: "middle",',
    '  titleColor: "#FFFFFF",',
    '};',
    '',
    'const visibleContexts = new Map(); // context -> { action, settings, userTitle, titleParams, hasCustomImage, lastSentImage, lastSentTitle }',
    'const activeHoldTimers = new Map(); // context -> { delayTimer, intervalTimer, ticked }',
    'const bgImageCache = new Map(); // resolvedPath -> { mtimeMs, size, dataUri }',
    'let lastCaptureTriggerAt = 0;',
    'let captureInFlight = false;',
    '',
    'const sd = new LocalStreamDeckSocket(',
    '  cli.port,',
    '  () => {',
    '    writeLog("INFO", "Connected to Elgato Stream Deck host", { port: cli.port });',
    '    sd.sendJSON({ event: cli.registerEvent, uuid: cli.pluginUUID });',
    '    sd.sendJSON({ event: "getGlobalSettings", context: cli.pluginUUID });',
    '  },',
    '  (msg) => handleStreamDeckMessage(msg),',
    '  () => {',
    '    for (const ctx of activeHoldTimers.keys()) stopHoldRepeat(ctx, false);',
    '    writeLog("INFO", "Stream Deck socket closed. Exiting.");',
    '    process.exit(0);',
    '  }',
    ');',
    '',
    'function escapeXml(str) {',
    '  return String(str)',
    '    .replace(/&/g, "&amp;")',
    '    .replace(/</g, "&lt;")',
    '    .replace(/>/g, "&gt;")',
    '    .replace(/"/g, "&quot;")',
    '    .replace(/\'/g, "&apos;");',
    '}',
    '',
    'function loadBackgroundImageDataUri(rawPath) {',
    '  const cleanPath = String(rawPath || "").trim().replace(/^"(.*)"$/, "$1");',
    '  if (!cleanPath || !fs.existsSync(cleanPath)) return "";',
    '  try {',
    '    const resolved = path.resolve(cleanPath);',
    '    const st = fs.statSync(resolved);',
    '    if (!st.isFile() || st.size <= 0) return "";',
    '    const cached = bgImageCache.get(resolved);',
    '    if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {',
    '      return cached.dataUri;',
    '    }',
    '    const ext = path.extname(resolved).toLowerCase();',
    '    const mime = ext === ".jpg" || ext === ".jpeg"',
    '      ? "image/jpeg"',
    '      : ext === ".webp"',
    '        ? "image/webp"',
    '        : ext === ".bmp"',
    '          ? "image/bmp"',
    '          : ext === ".gif"',
    '            ? "image/gif"',
    '            : ext === ".svg"',
    '              ? "image/svg+xml"',
    '              : "image/png";',
    '    const buf = fs.readFileSync(resolved);',
    '    const dataUri = `data:${mime};base64,${buf.toString("base64")}`;',
    '    if (bgImageCache.size >= 32) {',
    '      const oldestKey = bgImageCache.keys().next().value;',
    '      if (oldestKey) bgImageCache.delete(oldestKey);',
    '    }',
    '    bgImageCache.set(resolved, { mtimeMs: st.mtimeMs, size: st.size, dataUri });',
    '    return dataUri;',
    '  } catch (err) {',
    '    writeLog("WARN", "Failed to load key background image", err.message);',
    '    return "";',
    '  }',
    '}',
    '',
    'function resolveBoostedDisplayText(action, meta, btnSettings) {',
    '  const override = String(btnSettings.customBoostText || "");',
    '  if (override.trim().length > 0) {',
    '    return override.replace(/\\\\n/g, "\\n");',
    '  }',
    '  if (action === ACTION_DYNAMIC) {',
    '    return formatDynamicTitle(globalSettings.dynamicCurrentSeconds ?? 60);',
    '  }',
    '  const typedTitle = String(meta.userTitle || "");',
    '  if (typedTitle.trim().length > 0) {',
    '    return typedTitle;',
    '  }',
    '  if (action === ACTION_INCREASE) return "+";',
    '  if (action === ACTION_DECREASE) return "-";',
    '  if (action === ACTION_FIXED) {',
    '    const sec = Math.max(1, parseTimecodeToSeconds(btnSettings.fixedDuration || "00:30", 30));',
    '    return formatDynamicTitle(sec);',
    '  }',
    '  if (action === ACTION_RESET) {',
    '    const sec = Math.max(1, parseTimecodeToSeconds(btnSettings.resetDuration || "00:30", 30));',
    '    return formatDynamicTitle(sec);',
    '  }',
    '  return "";',
    '}',
    '',
    'function buildKeySvg({ bgDataUri, text, titleParams, effectiveSize }) {',
    '  const tp = titleParams || DEFAULT_TITLE_PARAMS;',
    '  const rawFamily = String(tp.fontFamily || "").trim();',
    '  const family = rawFamily || (process.platform === "darwin" ? "Helvetica Neue, Arial, sans-serif" : "Arial, Segoe UI, sans-serif");',
    '  const styleStr = String(tp.fontStyle || "");',
    '  const isBold = styleStr === "" || styleStr.toLowerCase().includes("bold");',
    '  const isItalic = styleStr.toLowerCase().includes("italic");',
    '  const weightAttr = isBold ? "bold" : "normal";',
    '  const styleAttr = isItalic ? "italic" : "normal";',
    '  const underlineAttr = tp.fontUnderline ? \' text-decoration="underline"\' : "";',
    '  const fill = escapeXml(String(tp.titleColor || "#FFFFFF").trim() || "#FFFFFF");',
    '  const familyAttr = escapeXml(family);',
    '',
    '  const bgLayer = bgDataUri',
    '    ? `<rect x="0" y="0" width="72" height="72" fill="#141820"/><image x="0" y="0" width="72" height="72" preserveAspectRatio="xMidYMid slice" href="${bgDataUri}" xlink:href="${bgDataUri}"/>`',
    '    : \'<rect x="0" y="0" width="72" height="72" fill="#141820"/>\';',
    '',
    '  if (!text || String(text).length === 0) {',
    '    return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="144" viewBox="0 0 72 72">${bgLayer}</svg>`;',
    '  }',
    '',
    '  const linesArr = String(text).split(/\\r?\\n/);',
    '  const size = Math.max(6, Math.min(72, Number(effectiveSize) || 16));',
    '  const lineHeight = size * 1.12;',
    '  const align = String(tp.titleAlignment || "middle").toLowerCase();',
    '',
    '  let startY;',
    '  if (align === "top") {',
    '    startY = Math.max(size * 0.82, 6 + size * 0.75);',
    '  } else if (align === "bottom") {',
    '    startY = 66 - (linesArr.length - 1) * lineHeight;',
    '  } else {',
    '    startY = 36 + size * 0.35 - ((linesArr.length - 1) * lineHeight) / 2;',
    '  }',
    '',
    '  const textNodes = linesArr.map((line, idx) => {',
    '    const y = (startY + idx * lineHeight).toFixed(2);',
    '    return `<text x="36" y="${y}" text-anchor="middle" font-family="${familyAttr}" font-size="${size.toFixed(1)}" font-weight="${weightAttr}" font-style="${styleAttr}"${underlineAttr} fill="${fill}">${escapeXml(line)}</text>`;',
    '  }).join("");',
    '',
    '  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="144" height="144" viewBox="0 0 72 72">${bgLayer}${textNodes}</svg>`;',
    '}',
    '',
    'function renderKeyVisual(context) {',
    '  const meta = visibleContexts.get(context);',
    '  if (!meta) return;',
    '  const btnSettings = meta.settings || {};',
    '  const titleParams = meta.titleParams || DEFAULT_TITLE_PARAMS;',
    '  const userTitle = String(meta.userTitle || "");',
    '  const rawBoost = Number(btnSettings.fontSizeBoost);',
    '  const boost = Number.isFinite(rawBoost) && rawBoost > 0 ? Math.min(56, Math.round(rawBoost)) : 0;',
    '  const bgDataUri = btnSettings.bgImagePath ? loadBackgroundImageDataUri(btnSettings.bgImagePath) : "";',
    '',
    '  if (boost <= 0 && !bgDataUri) {',
    '    if (meta.hasCustomImage) {',
    '      sd.sendJSON({ event: "setImage", context, payload: { target: 0 } });',
    '      meta.hasCustomImage = false;',
    '      meta.lastSentImage = "";',
    '    }',
    '    if (meta.lastSentTitle === "") {',
    '      sd.sendJSON({ event: "setTitle", context, payload: { target: 0 } });',
    '      meta.lastSentTitle = null;',
    '    }',
    '    if (meta.action === ACTION_DYNAMIC) {',
    '      const dynText = formatDynamicTitle(globalSettings.dynamicCurrentSeconds ?? 60);',
    '      if (meta.lastSentTitle !== dynText) {',
    '        sd.sendJSON({ event: "setTitle", context, payload: { title: dynText, target: 0 } });',
    '        meta.lastSentTitle = dynText;',
    '      }',
    '    } else if (meta.action === ACTION_INCREASE || meta.action === ACTION_DECREASE) {',
    '      const sym = meta.action === ACTION_INCREASE ? "+" : "-";',
    '      if (!userTitle && meta.lastSentTitle !== sym) {',
    '        sd.sendJSON({ event: "setTitle", context, payload: { title: sym, target: 0 } });',
    '        meta.lastSentTitle = sym;',
    '      }',
    '    }',
    '    return;',
    '  }',
    '',
    '  if (boost <= 0 && bgDataUri) {',
    '    const svg = buildKeySvg({ bgDataUri, text: "", titleParams, effectiveSize: 16 });',
    '    const svgUri = "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");',
    '    if (meta.lastSentImage !== svgUri) {',
    '      sd.sendJSON({ event: "setImage", context, payload: { image: svgUri, target: 0 } });',
    '      meta.lastSentImage = svgUri;',
    '      meta.hasCustomImage = true;',
    '    }',
    '    if (meta.lastSentTitle === "") {',
    '      sd.sendJSON({ event: "setTitle", context, payload: { target: 0 } });',
    '      meta.lastSentTitle = null;',
    '    }',
    '    if (meta.action === ACTION_DYNAMIC) {',
    '      const dynText = formatDynamicTitle(globalSettings.dynamicCurrentSeconds ?? 60);',
    '      if (meta.lastSentTitle !== dynText) {',
    '        sd.sendJSON({ event: "setTitle", context, payload: { title: dynText, target: 0 } });',
    '        meta.lastSentTitle = dynText;',
    '      }',
    '    } else if (meta.action === ACTION_INCREASE || meta.action === ACTION_DECREASE) {',
    '      const sym = meta.action === ACTION_INCREASE ? "+" : "-";',
    '      if (!userTitle && meta.lastSentTitle !== sym) {',
    '        sd.sendJSON({ event: "setTitle", context, payload: { title: sym, target: 0 } });',
    '        meta.lastSentTitle = sym;',
    '      }',
    '    }',
    '    return;',
    '  }',
    '',
    '  // Boost > 0: clear plugin-driven native title so text never doubles up, then render boosted SVG text + optional PNG background',
    '  if (meta.lastSentTitle !== "") {',
    '    sd.sendJSON({ event: "setTitle", context, payload: { title: "", target: 0 } });',
    '    meta.lastSentTitle = "";',
    '  }',
    '',
    '  const baseSize = Number(titleParams.fontSize) > 0 ? Number(titleParams.fontSize) : 16;',
    '  const effectiveSize = Math.min(72, baseSize + boost);',
    '  const displayText = resolveBoostedDisplayText(meta.action, meta, btnSettings);',
    '  const svg = buildKeySvg({ bgDataUri, text: displayText, titleParams, effectiveSize });',
    '  const svgUri = "data:image/svg+xml;base64," + Buffer.from(svg, "utf8").toString("base64");',
    '  if (meta.lastSentImage !== svgUri) {',
    '    sd.sendJSON({ event: "setImage", context, payload: { image: svgUri, target: 0 } });',
    '    meta.lastSentImage = svgUri;',
    '    meta.hasCustomImage = true;',
    '  }',
    '}',
    '',
    'function refreshAllDynamicButtons() {',
    '  for (const [context, meta] of visibleContexts.entries()) {',
    '    if (meta.action === ACTION_DYNAMIC) {',
    '      renderKeyVisual(context);',
    '    }',
    '  }',
    '}',
    '',

    'function resolveShouldOpenAfterSave(btnSettings) {',
    '  const mode = btnSettings && btnSettings.openAfterSaveMode;',
    '  if (mode === "open") return true;',
    '  if (mode === "never") return false;',
    '  if (!mode && btnSettings && btnSettings.openAfterSave === true) return true;',
    '  return Boolean(globalSettings.openAfterSave);',
    '}',
    '',
    'function applyDynamicStepOnce(action, context, incomingSettings, persistNow) {',
    '  const cached = (visibleContexts.get(context) || {}).settings || {};',
    '  const btnSettings = { ...cached, ...(incomingSettings || {}) };',
    '  const step = Math.max(1, parseTimecodeToSeconds(btnSettings.stepDuration || "00:30", 30));',
    '  const current = Number(globalSettings.dynamicCurrentSeconds) || 60;',
    '',
    '  if (action === ACTION_INCREASE) {',
    '    globalSettings.dynamicCurrentSeconds = Math.max(1, current + step);',
    '  } else if (action === ACTION_DECREASE) {',
    '    const autoFloor = Math.max(1, Math.min(30, step));',
    '    const rawFloor = (btnSettings.minFloor || "").trim();',
    '    const floorSec = rawFloor ? Math.max(1, parseTimecodeToSeconds(rawFloor, autoFloor)) : autoFloor;',
    '    const clamped = Math.max(floorSec, current - step);',
    '    globalSettings.dynamicCurrentSeconds = Math.max(1, Math.min(current, clamped));',
    '  }',
    '',
    '  refreshAllDynamicButtons();',
    '  if (persistNow) saveGlobalSettings();',
    '}',
    '',
    'function stopHoldRepeat(context, persistIfTicked = true) {',
    '  const entry = activeHoldTimers.get(context);',
    '  if (!entry) return;',
    '  if (entry.delayTimer) clearTimeout(entry.delayTimer);',
    '  if (entry.intervalTimer) clearInterval(entry.intervalTimer);',
    '  activeHoldTimers.delete(context);',
    '  if (persistIfTicked && entry.ticked) {',
    '    saveGlobalSettings();',
    '  }',
    '}',
    '',
    'function startHoldRepeat(action, context, incomingSettings) {',
    '  stopHoldRepeat(context, false);',
    '  applyDynamicStepOnce(action, context, incomingSettings, true);',
    '',
    '  const rawDelay = Number(globalSettings.repeatDelaySeconds);',
    '  const delaySec = Number.isFinite(rawDelay) && rawDelay >= 0.05 ? Math.min(10, rawDelay) : 0.5;',
    '  const rawRate = Number(globalSettings.repeatRateHz);',
    '  const rateHz = Number.isFinite(rawRate) && rawRate >= 0.5 ? Math.min(30, rawRate) : 5;',
    '  const delayMs = Math.round(delaySec * 1000);',
    '  const intervalMs = Math.max(33, Math.round(1000 / rateHz));',
    '',
    '  const timerRecord = { delayTimer: null, intervalTimer: null, ticked: false };',
    '  timerRecord.delayTimer = setTimeout(() => {',
    '    timerRecord.delayTimer = null;',
    '    if (!activeHoldTimers.has(context)) return;',
    '    timerRecord.ticked = true;',
    '    applyDynamicStepOnce(action, context, null, false);',
    '    timerRecord.intervalTimer = setInterval(() => {',
    '      if (!activeHoldTimers.has(context)) {',
    '        stopHoldRepeat(context, false);',
    '        return;',
    '      }',
    '      timerRecord.ticked = true;',
    '      applyDynamicStepOnce(action, context, null, false);',
    '    }, intervalMs);',
    '  }, delayMs);',
    '',
    '  activeHoldTimers.set(context, timerRecord);',
    '}',
    '',
    'function saveGlobalSettings() {',
    '  sd.sendJSON({',
    '    event: "setGlobalSettings",',
    '    context: cli.pluginUUID,',
    '    payload: globalSettings,',
    '  });',
    '}',
    '',
    'async function openSpecificDirectory(context, rawDir, dirLabel) {',
    '  const targetDir = (rawDir || "").trim();',
    '  if (!targetDir || !fs.existsSync(targetDir)) {',
    '    writeLog("ERROR", `${dirLabel} failed: directory not configured or missing`, targetDir);',
    '    sd.sendJSON({ event: "showAlert", context });',
    '    await playSoundFile(globalSettings.errorSoundPath);',
    '    return;',
    '  }',
    '  if (process.platform === "win32") {',
    '    const child = spawn("explorer.exe", [path.resolve(targetDir)], { detached: true, stdio: "ignore" });',
    '    child.unref();',
    '  } else if (process.platform === "darwin") {',
    '    const child = spawn("open", [path.resolve(targetDir)], { detached: true, stdio: "ignore" });',
    '    child.unref();',
    '  }',
    '}',
    'async function openFileInDefaultPlayer(filePath) {',
    '  const resolved = path.resolve(filePath);',
    '  try {',
    '    if (process.platform === "win32") {',
    '      // cmd.exe built-in `start` initializes COM in STA, passes SEE_MASK_NOASYNC (waits for',
    '      // async UWP/DDE activation like Windows 11 Media Player, Movies & TV, or VLC before exiting),',
    '      // and explicitly sets SW_SHOWNORMAL so the player window opens visible in the foreground.',
    '      const safeCmdPath = resolved.replace(/"/g, "").replace(/%/g, "%%");',
    '      await new Promise((resolve, reject) => {',
    '        const child = execFile(',
    '          "cmd.exe",',
    '          ["/d", "/s", "/c", `"start "" "${safeCmdPath}""`],',
    '          { windowsVerbatimArguments: true, windowsHide: true, timeout: 8000 },',
    '          (err) => (err ? reject(err) : resolve())',
    '        );',
    '        child.on("error", reject);',
    '      });',
    '    } else if (process.platform === "darwin") {',
    '      const child = spawn("open", [resolved], { detached: true, stdio: "ignore" });',
    '      child.unref();',
    '    }',
    '    writeLog("INFO", "Opened saved clip in default media player", resolved);',
    '  } catch (err) {',
    '    writeLog("WARN", "Primary auto-open failed, attempting explorer fallback", err.message);',
    '    if (process.platform === "win32") {',
    '      try {',
    '        const fallback = spawn("explorer.exe", [resolved], { detached: true, stdio: "ignore" });',
    '        fallback.unref();',
    '      } catch {}',
    '    }',
    '  }',
    '}',
    '',
    'async function executeCaptureFlow(context, requestedSeconds, openAfterSave = false) {',
    '  const now = Date.now();',
    '  // 2-second debounce strictly on capture buttons',
    '  if (now - lastCaptureTriggerAt < DEBOUNCE_MS || captureInFlight) {',
    '    writeLog("INFO", "Ignored capture press (within 2s debounce or capture already running)");',
    '    return;',
    '  }',
    '  lastCaptureTriggerAt = now;',
    '  captureInFlight = true;',
    '',
    '  let ffplayHint = "";',
    '  let outputFileCreated = "";',
    '',
    '  const failTimeoutSec = calculateFailTimeoutSeconds(requestedSeconds);',
    '  const overallDeadline = Date.now() + failTimeoutSec * 1000;',
    '',
    '  try {',
    '    // 1) Verify FFmpeg first (throws if missing)',
    '    const { ffmpegBin, ffprobeBin, ffplayBin } = await resolveFfmpegSuite(globalSettings.ffmpegPath);',
    '    ffplayHint = ffplayBin;',
    '',
    '    // 2) Verify directories',
    '    const mainDir = (globalSettings.mainCapturesDir || "").trim();',
    '    if (!mainDir || !fs.existsSync(mainDir)) {',
    '      throw new Error(`Main captures directory does not exist: "${mainDir}"`);',
    '    }',
    '    const outDir = (globalSettings.outputDir || "").trim() || mainDir;',
    '    if (!fs.existsSync(outDir)) {',
    '      fs.mkdirSync(outDir, { recursive: true });',
    '    }',
    '',
    '    const resolvedMain = path.resolve(mainDir);',
    '    const resolvedOut = path.resolve(outDir);',
    '    const excludeOut = resolvedOut !== resolvedMain ? resolvedOut : "";',
    '',
    '    // 3) Snapshot pre-existing files & send Master Instant Replay hotkey',
    '    const baseline = scanVideoFilesRecursive(mainDir, excludeOut);',
    '    const triggerEpoch = Date.now();',
    '    writeLog("INFO", "Sending master replay hotkey", { hotkey: globalSettings.masterHotkey, requestedSeconds, failTimeoutSec });',
    '    await injectMasterHotkey(globalSettings.masterHotkey);',
    '',
    '    // 4) Wait for master clip to be written AND fully flushed/unlocked',
    '    const masterFile = await waitForReadyMasterClip(mainDir, excludeOut, baseline, triggerEpoch, overallDeadline);',
    '    writeLog("INFO", "Master replay clip ready", masterFile);',
    '',
    '    // 5) Probe actual elapsed master duration & keyframe start',
    '    const { alignedEnd, trimStart, wasClamped } = await probeAlignedDurationAndKeyframe(',
    '      ffmpegBin,',
    '      ffprobeBin,',
    '      masterFile,',
    '      requestedSeconds',
    '    );',
    '',
    '    // 6) Trim with FFmpeg (-c copy, zero re-encoding, aligned audio/video streams)',
    '    outputFileCreated = buildUniqueOutputPath(outDir, masterFile, requestedSeconds);',
    '    const remainingMs = Math.max(15000, overallDeadline - Date.now());',
    '',
    '    const ffmpegArgs = [',
    '      "-hide_banner",',
    '      "-loglevel", "error",',
    '      "-y",',
    '      "-ss", trimStart.toFixed(3),',
    '      "-to", alignedEnd.toFixed(3),',
    '      "-i", masterFile,',
    '      "-map", "0:v",',
    '      "-map", "0:a?",',
    '      "-c", "copy",',
    '      "-avoid_negative_ts", "make_zero",',
    '      "-shortest",',
    '      outputFileCreated,',
    '    ];',
    '',
    '    writeLog("INFO", "Running FFmpeg stream-copy trim", { trimStart, alignedEnd, wasClamped, outputFileCreated });',
    '    await execFilePromise(ffmpegBin, ffmpegArgs, remainingMs);',
    '',
    '    // 7) Verify trimmed clip actually exists and is non-empty on disk',
    '    if (!fs.existsSync(outputFileCreated) || fs.statSync(outputFileCreated).size === 0) {',
    '      throw new Error("Trimmed output file was not written or is 0 bytes.");',
    '    }',
    '',
    '    // 8) Optionally delete original master capture',
    '    if (globalSettings.deleteOriginal && path.resolve(outputFileCreated) !== path.resolve(masterFile)) {',
    '      try {',
    '        fs.unlinkSync(masterFile);',
    '        writeLog("INFO", "Deleted original master capture", masterFile);',
    '      } catch (delErr) {',
    '        writeLog("WARN", "Could not delete original master capture", delErr.message);',
    '      }',
    '    }',
    '    // 9) Optionally open the newly created clip in the default OS media player (per-button setting)',
    '    if (openAfterSave) {',
    '      await openFileInDefaultPlayer(outputFileCreated);',
    '    }',
    '',
    '    sd.sendJSON({ event: "showOk", context });',
    '    await playSoundFile(globalSettings.successSoundPath, ffplayHint);',
    '  } catch (err) {',
    '    writeLog("ERROR", "Replay capture failed", err.message);',
    '    if (outputFileCreated && fs.existsSync(outputFileCreated)) {',
    '      try {',
    '        if (fs.statSync(outputFileCreated).size === 0) fs.unlinkSync(outputFileCreated);',
    '      } catch {}',
    '    }',
    '    sd.sendJSON({ event: "showAlert", context });',
    '    await playSoundFile(globalSettings.errorSoundPath, ffplayHint);',
    '  } finally {',
    '    captureInFlight = false;',
    '  }',
    '}',
    '',
    'async function handleSendToPlugin(msg) {',
    '  const { context, action, payload } = msg;',
    '  if (!payload || !payload.cmd) return;',
    '',
    '  if (payload.cmd === "verifyFfmpeg") {',
    '    try {',
    '      const suite = await resolveFfmpegSuite(payload.ffmpegPath ?? globalSettings.ffmpegPath);',
    '      sd.sendJSON({',
    '        event: "sendToPropertyInspector",',
    '        action,',
    '        context,',
    '        payload: { event: "ffmpegStatus", ok: true, detail: `Ready: ${suite.ffmpegBin}` },',
    '      });',
    '    } catch (err) {',
    '      sd.sendJSON({',
    '        event: "sendToPropertyInspector",',
    '        action,',
    '        context,',
    '        payload: { event: "ffmpegStatus", ok: false, detail: err.message },',
    '      });',
    '    }',
    '  } else if (payload.cmd === "testSound") {',
    '    let ffplayHint = "";',
    '    try {',
    '      const suite = await resolveFfmpegSuite(globalSettings.ffmpegPath);',
    '      ffplayHint = suite.ffplayBin;',
    '    } catch {}',
    '    await playSoundFile(payload.soundPath, ffplayHint);',
    '  } else if (payload.cmd === "browseFolder") {',
    '    try {',
    '      const picked = await pickNativeFolder(payload.title || "Select Directory");',
    '      if (picked) {',
    '        sd.sendJSON({',
    '          event: "sendToPropertyInspector",',
    '          action,',
    '          context,',
    '          payload: { event: "pickedPath", field: payload.field, path: picked },',
    '        });',
    '      }',
    '    } catch {}',
    '  } else if (payload.cmd === "browseFile") {',
    '    try {',
    '      const picked = await pickNativeFile(payload.title || "Select File", payload.filterKind || "audio");',
    '      if (picked) {',
    '        sd.sendJSON({',
    '          event: "sendToPropertyInspector",',
    '          action,',
    '          context,',
    '          payload: { event: "pickedPath", field: payload.field, path: picked },',
    '        });',
    '      }',
    '    } catch {}',
    '  } else if (payload.cmd === "resetDynamicLength") {',
    '    globalSettings.dynamicCurrentSeconds = 60;',
    '    saveGlobalSettings();',
    '    refreshAllDynamicButtons();',
    '  } else if (payload.cmd === "syncActionSettings" && payload.actionContext && payload.settings) {',
    '    const existing = visibleContexts.get(payload.actionContext) || {',
    '      action,',
    '      settings: {},',
    '      userTitle: "",',
    '      titleParams: { ...DEFAULT_TITLE_PARAMS },',
    '      hasCustomImage: false,',
    '      lastSentImage: "",',
    '      lastSentTitle: null,',
    '    };',
    '    existing.settings = { ...existing.settings, ...payload.settings };',
    '    visibleContexts.set(payload.actionContext, existing);',
    '    sd.sendJSON({',
    '      event: "setSettings",',
    '      context: payload.actionContext,',
    '      payload: existing.settings,',
    '    });',
    '    renderKeyVisual(payload.actionContext);',
    '    writeLog("INFO", "Synced per-button settings", { actionContext: payload.actionContext, settings: existing.settings });',
    '  }',
    '}',
    '',
    'function handleStreamDeckMessage(msg) {',
    '  const { event, action, context, payload } = msg;',
    '',
    '  if (event === "didReceiveGlobalSettings") {',
    '    const incoming = (payload && payload.settings) || {};',
    '    const isFirstSeed = Object.keys(incoming).length === 0;',
    '    const liveDynamicWhileHeld = activeHoldTimers.size > 0 ? globalSettings.dynamicCurrentSeconds : null;',
    '    globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...incoming };',
    '    if (liveDynamicWhileHeld !== null) {',
    '      globalSettings.dynamicCurrentSeconds = liveDynamicWhileHeld;',
    '    }',
    '    if (!Number.isFinite(globalSettings.dynamicCurrentSeconds) || globalSettings.dynamicCurrentSeconds <= 0) {',
    '      globalSettings.dynamicCurrentSeconds = 60;',
    '    }',
    '    if (isFirstSeed) saveGlobalSettings();',
    '    refreshAllDynamicButtons();',
    '    return;',
    '  }',
    '',
    '  if (event === "willAppear") {',
    '    const existing = visibleContexts.get(context) || {',
    '      action,',
    '      settings: {},',
    '      userTitle: "",',
    '      titleParams: { ...DEFAULT_TITLE_PARAMS },',
    '      hasCustomImage: false,',
    '      lastSentImage: "",',
    '      lastSentTitle: null,',
    '    };',
    '    existing.action = action;',
    '    existing.settings = (payload && payload.settings) || existing.settings || {};',
    '    visibleContexts.set(context, existing);',
    '    renderKeyVisual(context);',
    '    return;',
    '  }',
    '',
    '  if (event === "titleParametersDidChange") {',
    '    const existing = visibleContexts.get(context) || {',
    '      action,',
    '      settings: {},',
    '      userTitle: "",',
    '      titleParams: { ...DEFAULT_TITLE_PARAMS },',
    '      hasCustomImage: false,',
    '      lastSentImage: "",',
    '      lastSentTitle: null,',
    '    };',
    '    existing.action = action || existing.action;',
    '    if (payload && payload.settings) {',
    '      existing.settings = { ...existing.settings, ...payload.settings };',
    '    }',
    '    const incomingTitle = (payload && typeof payload.title === "string") ? payload.title : "";',
    '    existing.userTitle = (existing.lastSentTitle !== null && incomingTitle === existing.lastSentTitle) ? "" : incomingTitle;',
    '    if (payload && payload.titleParameters) {',
    '      existing.titleParams = { ...DEFAULT_TITLE_PARAMS, ...payload.titleParameters };',
    '    }',
    '    visibleContexts.set(context, existing);',
    '    renderKeyVisual(context);',
    '    return;',
    '  }',
    '',
    '  if (event === "willDisappear") {',
    '    stopHoldRepeat(context, true);',
    '    visibleContexts.delete(context);',
    '    return;',
    '  }',
    '',
    '  if (event === "keyUp") {',
    '    if (action === ACTION_INCREASE || action === ACTION_DECREASE) {',
    '      stopHoldRepeat(context, true);',
    '    }',
    '    return;',
    '  }',
    '',
    '  if (event === "didReceiveSettings") {',
    '    const existing = visibleContexts.get(context) || {',
    '      action,',
    '      settings: {},',
    '      userTitle: "",',
    '      titleParams: { ...DEFAULT_TITLE_PARAMS },',
    '      hasCustomImage: false,',
    '      lastSentImage: "",',
    '      lastSentTitle: null,',
    '    };',
    '    existing.settings = (payload && payload.settings) || {};',
    '    visibleContexts.set(context, existing);',
    '    renderKeyVisual(context);',
    '    return;',
    '  }',
    '',
    '  if (event === "sendToPlugin") {',
    '    handleSendToPlugin(msg);',
    '    return;',
    '  }',
    '',
    '  if (event === "keyDown") {',
    '    if (action === ACTION_FIXED) {',
    '      const cached = (visibleContexts.get(context) || {}).settings || {};',
    '      const incoming = (payload && payload.settings) || {};',
    '      const btnSettings = { ...cached, ...incoming };',
    '      const fixedSec = Math.max(1, parseTimecodeToSeconds(btnSettings.fixedDuration || "00:30", 30));',
    '      const openAfterSave = resolveShouldOpenAfterSave(btnSettings);',
    '      writeLog("INFO", "Fixed Length button pressed", { context, fixedSec, openAfterSave });',
    '      executeCaptureFlow(context, fixedSec, openAfterSave);',
    '    } else if (action === ACTION_DYNAMIC) {',
    '      const cached = (visibleContexts.get(context) || {}).settings || {};',
    '      const incoming = (payload && payload.settings) || {};',
    '      const btnSettings = { ...cached, ...incoming };',
    '      const dynSec = Math.max(1, Number(globalSettings.dynamicCurrentSeconds) || 60);',
    '      const openAfterSave = resolveShouldOpenAfterSave(btnSettings);',
    '      writeLog("INFO", "Dynamic Length button pressed", { context, dynSec, openAfterSave });',
    '      executeCaptureFlow(context, dynSec, openAfterSave);',
    '    } else if (action === ACTION_INCREASE || action === ACTION_DECREASE) {',
    '      startHoldRepeat(action, context, payload && payload.settings);',
    '    } else if (action === ACTION_RESET) {',
    '      const cached = (visibleContexts.get(context) || {}).settings || {};',
    '      const incoming = (payload && payload.settings) || {};',
    '      const btnSettings = { ...cached, ...incoming };',
    '      const targetSec = Math.max(1, parseTimecodeToSeconds(btnSettings.resetDuration || "00:30", 30));',
    '      globalSettings.dynamicCurrentSeconds = targetSec;',
    '      writeLog("INFO", "Reset Dynamic Length button pressed", { context, targetSec });',
    '      saveGlobalSettings();',
    '      refreshAllDynamicButtons();',
    '    } else if (action === ACTION_OPEN_OUTPUT) {',
    '      const outTarget = (globalSettings.outputDir && globalSettings.outputDir.trim()) || (globalSettings.mainCapturesDir && globalSettings.mainCapturesDir.trim()) || "";',
    '      openSpecificDirectory(context, outTarget, "Open Output Directory");',
    '    } else if (action === ACTION_OPEN_CAPTURES) {',
    '      openSpecificDirectory(context, globalSettings.mainCapturesDir, "Open Captures Directory");',
    '    }',
    '  }',
    '}',
  ];

  return lines.join('\n');
}

export function generatePropertyInspectorHtml(defaults: GlobalPluginSettings): string {
  const serializedDefaults = JSON.stringify({
    openAfterSave: defaults.openAfterSave ?? false,
    deleteOriginal: defaults.deleteOriginal ?? true,
    masterHotkey: defaults.masterHotkey || 'Alt+F10',
    mainCapturesDir: defaults.mainCapturesDir || '',
    outputDir: defaults.outputDir || '',
    ffmpegPath: defaults.ffmpegPath || '',
    successSoundPath: defaults.successSoundPath || '',
    errorSoundPath: defaults.errorSoundPath || '',
    repeatDelaySeconds: Number.isFinite(defaults.repeatDelaySeconds) ? defaults.repeatDelaySeconds : 0.5,
    repeatRateHz: Number.isFinite(defaults.repeatRateHz) ? defaults.repeatRateHz : 5,
    enableDebugLog: false,
    uiMenuOpen: {
      appearance: false,
      dirs: true,
      sounds: true,
      repeat: false,
      diagnostics: false,
    },
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>ReplaySlice Property Inspector</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px 14px 20px;
      background: #2D2D2D;
      color: #D8D8D8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.4;
    }
    .section-heading {
      font-size: 11px;
      font-weight: 600;
      color: #9A9A9A;
      margin: 14px 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #3D3D3D;
    }
    .section-heading:first-child { margin-top: 2px; }
    .row {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 10px;
    }
    .row:last-child { margin-bottom: 2px; }
    .row label {
      color: #BDBDBD;
      font-weight: 500;
    }
    .inline-group {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    input[type="text"], input[type="number"], select {
      flex: 1;
      width: 100%;
      background: #3B3B3B;
      border: 1px solid #4A4A4A;
      border-radius: 4px;
      color: #F0F0F0;
      padding: 5px 8px;
      font-size: 12px;
      outline: none;
    }
    input[type="text"]:focus, input[type="number"]:focus, select:focus {
      border-color: #3B82F6;
    }
    button {
      background: #444444;
      border: 1px solid #555555;
      border-radius: 4px;
      color: #EAEAEA;
      padding: 5px 9px;
      font-size: 11px;
      cursor: pointer;
      white-space: nowrap;
    }
    button:hover { background: #505050; }
    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
      cursor: pointer;
    }
    .hint {
      font-size: 11px;
      color: #8E8E8E;
    }
    .status-ok { color: #4ADE80; }
    .status-err { color: #F87171; }
    .hidden { display: none !important; }
    details.menu-group {
      margin-top: 10px;
      border: 1px solid #3D3D3D;
      border-radius: 5px;
      background: #272727;
      overflow: hidden;
    }
    details.menu-group > summary {
      cursor: pointer;
      padding: 7px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #CFCFCF;
      background: #333333;
      user-select: none;
      list-style: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    details.menu-group > summary::-webkit-details-marker { display: none; }
    details.menu-group > summary::after {
      content: "▸";
      font-size: 11px;
      color: #9A9A9A;
      transition: transform 0.12s ease;
    }
    details.menu-group[open] > summary::after {
      transform: rotate(90deg);
    }
    details.menu-group > summary:hover {
      background: #3A3A3A;
    }
    .menu-body {
      padding: 10px 10px 8px;
      border-top: 1px solid #3D3D3D;
    }
  </style>
</head>
<body>
  <!-- Per-Button Settings -->
  <div id="actionSettingsSection" class="hidden">
    <div class="section-heading">Button Action Settings</div>

    <div id="fixedOnlyRow" class="row hidden">
      <label for="fixedDuration">Fixed Replay Length (HH:MM:SS or MM:SS)</label>
      <input id="fixedDuration" type="text" placeholder="00:30" value="00:30" />
      <div id="fixedDurationHint" class="hint">Saves the last 30s · Fail timer: 10s</div>
    </div>

    <div id="dynamicOnlyRow" class="row hidden">
      <div id="dynamicDurationHint" class="hint">Current Dynamic Length: 60s · Fail timer: 10s</div>
      <div class="hint">
        Use Stream Deck's native Title bar above to choose your preferred font, size, color, and position. Leave the Title text box empty so ReplaySlice can update the live duration automatically.
      </div>
      <div>
        <button id="resetDynamicBtn" type="button">Reset Dynamic Length to 1:00</button>
      </div>
    </div>

    <div id="openAfterSaveWrap" class="row hidden">
      <label for="openAfterSaveMode">After Saving Clip (This Button)</label>
      <select id="openAfterSaveMode">
        <option value="global">Follow Global Setting</option>
        <option value="open">Always open clip on this button</option>
        <option value="never">Never open clip on this button</option>
      </select>
    </div>

    <div id="stepOnlyRow" class="row hidden">
      <label id="stepDurationLabel" for="stepDuration">Step Length (HH:MM:SS, MM:SS, or sec)</label>
      <input id="stepDuration" type="text" placeholder="00:30" value="00:30" />
      <div id="stepDurationHint" class="hint">Changes Dynamic Length by 30s per press · Hold key to auto-repeat</div>
    </div>

    <div id="minFloorRow" class="row hidden">
      <label for="minFloor">Minimum Dynamic Length Floor (Optional)</label>
      <input id="minFloor" type="text" placeholder="Auto (00:30, or step if smaller)" value="" />
      <div class="hint">Prevents large minus buttons from dropping Dynamic Length below this value</div>
    </div>

    <div id="resetOnlyRow" class="row hidden">
      <label for="resetDuration">Reset Target Length (HH:MM:SS, MM:SS, or sec)</label>
      <input id="resetDuration" type="text" placeholder="00:30" value="00:30" />
      <div id="resetDurationHint" class="hint">Sets Dynamic Length to 30s (0:30) when pressed · Independent to this button</div>
    </div>

    <!-- Collapsible Per-Button Custom Text Size & Key Background (kept together in one menu) -->
    <details id="menu-appearance" class="menu-group">
      <summary>Custom Text Size &amp; Key Background</summary>
      <div class="menu-body">
        <div class="row">
          <label for="fontSizeBoost">Font Size Boost (+pt above Stream Deck size)</label>
          <div class="inline-group">
            <button id="boostMinusBtn" type="button" title="Decrease font boost">-1</button>
            <input id="fontSizeBoost" type="number" step="1" min="0" max="56" placeholder="0" value="0" />
            <button id="boostPlusBtn" type="button" title="Increase font boost">+1</button>
            <button id="boostResetBtn" type="button">Reset (0)</button>
          </div>
          <div id="fontSizeBoostHint" class="hint">0 = Default Stream Deck text. Increase (+1, +2, …) to scale past 16/18pt using Stream Deck's selected font &amp; color.</div>
        </div>

        <div class="row">
          <label for="bgImagePath">Key Background Image (Optional — .png / .jpg)</label>
          <div class="inline-group">
            <input id="bgImagePath" type="text" placeholder="Optional PNG/JPG behind boosted text" />
            <button type="button" data-browse-file="bgImagePath" data-kind="image" data-title="Select Key Background Image">Browse</button>
            <button id="clearBgImageBtn" type="button">Clear</button>
          </div>
          <div class="hint">Renders your PNG/JPG right behind boosted dynamic text (use this instead of Stream Deck's top-left icon box when Boost &gt; 0).</div>
        </div>

        <div class="row">
          <label for="customBoostText">Boosted Text Override (Optional)</label>
          <input id="customBoostText" type="text" placeholder="Leave blank for automatic timer / + / -" />
          <div class="hint">Keep Stream Deck's main Title box blank so text doesn't double up.</div>
        </div>
      </div>
    </details>
  </div>

  <!-- Shared Global Plugin Settings -->
  <div class="section-heading">Global Plugin Settings</div>

  <label class="checkbox-row">
    <input id="globalOpenAfterSave" type="checkbox" />
    <span>Open clip automatically after saving</span>
  </label>

  <label class="checkbox-row" style="margin-bottom: 12px;">
    <input id="deleteOriginal" type="checkbox" />
    <span>Delete original master capture after trim succeeds</span>
  </label>

  <div class="row">
    <label for="masterHotkey">Master Replay Hotkey (OBS / ShadowPlay)</label>
    <div class="inline-group">
      <input id="masterHotkey" type="text" placeholder="Alt+F10" />
      <button id="recordHotkeyBtn" type="button">Record</button>
    </div>
    <div class="hint">Shortcut sent to save the master instant replay buffer</div>
  </div>

  <!-- Collapsible 1: Directories & FFmpeg Path (open by default) -->
  <details id="menu-dirs" class="menu-group" open>
    <summary>Directories &amp; FFmpeg Path</summary>
    <div class="menu-body">
      <div class="row">
        <label for="mainCapturesDir">Main Captures Directory</label>
        <div class="inline-group">
          <input id="mainCapturesDir" type="text" placeholder="C:\\Users\\You\\Videos\\Captures" />
          <button type="button" data-browse-folder="mainCapturesDir" data-title="Select Main Captures Directory">Browse</button>
        </div>
        <div class="hint">Watches root folder and game subfolders automatically</div>
      </div>

      <div class="row">
        <label for="outputDir">Output Directory</label>
        <div class="inline-group">
          <input id="outputDir" type="text" placeholder="C:\\Users\\You\\Videos\\Replays" />
          <button type="button" data-browse-folder="outputDir" data-title="Select Trimmed Output Directory">Browse</button>
        </div>
      </div>

      <div class="row">
        <label for="ffmpegPath">FFmpeg Path (Optional)</label>
        <div class="inline-group">
          <input id="ffmpegPath" type="text" placeholder="Auto-detect from system PATH" />
          <button type="button" data-browse-file="ffmpegPath" data-kind="exe" data-title="Select ffmpeg executable">Browse</button>
          <button id="verifyFfmpegBtn" type="button">Verify</button>
        </div>
        <div id="ffmpegStatus" class="hint">Leave blank if FFmpeg is installed in PATH</div>
      </div>
    </div>
  </details>

  <!-- Collapsible 2: Sound Confirmations (open by default) -->
  <details id="menu-sounds" class="menu-group" open>
    <summary>Sound Confirmations</summary>
    <div class="menu-body">
      <div class="row">
        <label for="successSoundPath">Success Sound (.wav / .mp3)</label>
        <div class="inline-group">
          <input id="successSoundPath" type="text" placeholder="Optional path to .wav or .mp3" />
          <button type="button" data-browse-file="successSoundPath" data-kind="audio" data-title="Select Success Sound">Browse</button>
          <button type="button" data-test-sound="successSoundPath">Test</button>
        </div>
      </div>

      <div class="row">
        <label for="errorSoundPath">Failure / Exception Sound (.wav / .mp3)</label>
        <div class="inline-group">
          <input id="errorSoundPath" type="text" placeholder="Optional path to .wav or .mp3" />
          <button type="button" data-browse-file="errorSoundPath" data-kind="audio" data-title="Select Failure Sound">Browse</button>
          <button type="button" data-test-sound="errorSoundPath">Test</button>
        </div>
      </div>
    </div>
  </details>

  <!-- Collapsible 3: Key Delay / Repeat (closed by default, just above Diagnostics) -->
  <details id="menu-repeat" class="menu-group">
    <summary>Key Delay / Repeat</summary>
    <div class="menu-body">
      <div class="row">
        <label for="repeatDelaySeconds">Hold Delay Before Repeat (seconds)</label>
        <input id="repeatDelaySeconds" type="number" step="0.05" min="0.05" max="10" placeholder="0.5" value="0.5" />
      </div>

      <div class="row">
        <label for="repeatRateHz">Repeat Rate (times per second)</label>
        <input id="repeatRateHz" type="number" step="0.5" min="0.5" max="30" placeholder="5" value="5" />
        <div id="repeatSummaryHint" class="hint">Holding + or - waits 0.5s, then triggers 5×/sec (every 200ms)</div>
      </div>
    </div>
  </details>

  <!-- Collapsible 4: Diagnostics (closed by default) -->
  <details id="menu-diagnostics" class="menu-group">
    <summary>Diagnostics</summary>
    <div class="menu-body">
      <label class="checkbox-row" style="margin: 2px 0 6px;">
        <input id="enableDebugLog" type="checkbox" />
        <span>Enable debug log file</span>
      </label>
      <div class="hint">Off by default. Writes capped logs to logs/replayslice.log only while enabled.</div>
    </div>
  </details>

  <script>
    const DEFAULTS = ${serializedDefaults};
    const MENU_STORAGE_KEY = "replayslice_pi_menus_v1";
    const DEFAULT_MENU_OPEN = {
      appearance: false,
      dirs: true,
      sounds: true,
      repeat: false,
      diagnostics: false
    };

    let websocket = null;
    let piUUID = "";
    let actionInfo = null;
    let globalState = Object.assign({}, DEFAULTS);
    let actionState = {
      fixedDuration: "00:30",
      stepDuration: "00:30",
      minFloor: "",
      resetDuration: "00:30",
      openAfterSaveMode: "global",
      fontSizeBoost: 0,
      bgImagePath: "",
      customBoostText: ""
    };
    let recordingHotkey = false;
    let isApplyingMenuState = false;

    function loadRememberedMenuState(fromGlobal) {
      let local = null;
      try {
        const raw = localStorage.getItem(MENU_STORAGE_KEY);
        if (raw) local = JSON.parse(raw);
      } catch {}
      const source = (fromGlobal && typeof fromGlobal === "object")
        ? Object.assign({}, DEFAULT_MENU_OPEN, local || {}, fromGlobal)
        : Object.assign({}, DEFAULT_MENU_OPEN, local || {});
      return {
        appearance: Boolean(source.appearance),
        dirs: source.dirs !== false,
        sounds: source.sounds !== false,
        repeat: Boolean(source.repeat),
        diagnostics: Boolean(source.diagnostics)
      };
    }

    function applyMenuOpenState(menuState) {
      isApplyingMenuState = true;
      try {
        document.getElementById("menu-appearance").open = Boolean(menuState.appearance);
        document.getElementById("menu-dirs").open = menuState.dirs !== false;
        document.getElementById("menu-sounds").open = menuState.sounds !== false;
        document.getElementById("menu-repeat").open = Boolean(menuState.repeat);
        document.getElementById("menu-diagnostics").open = Boolean(menuState.diagnostics);
        try {
          localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(menuState));
        } catch {}
      } finally {
        isApplyingMenuState = false;
      }
    }

    function readCurrentMenuOpenState() {
      return {
        appearance: document.getElementById("menu-appearance").open,
        dirs: document.getElementById("menu-dirs").open,
        sounds: document.getElementById("menu-sounds").open,
        repeat: document.getElementById("menu-repeat").open,
        diagnostics: document.getElementById("menu-diagnostics").open
      };
    }

    // Apply remembered collapsible menu state immediately before first paint
    applyMenuOpenState(loadRememberedMenuState(null));

    function parseTimecode(raw, fallback) {
      if (!raw) return fallback;
      const cleaned = String(raw).trim().replace(/s$/i, "");
      if (cleaned.includes(":")) {
        const parts = cleaned.split(":").map(Number);
        if (parts.some((n) => Number.isNaN(n) || n < 0)) return fallback;
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
      }
      const n = Number(cleaned);
      return Number.isFinite(n) && n >= 0 ? n : fallback;
    }

    function formatDisplayDuration(sec) {
      const safe = Math.max(0, Math.round(sec));
      const h = Math.floor(safe / 3600);
      const m = Math.floor((safe % 3600) / 60);
      const s = safe % 60;
      const ss = String(s).padStart(2, "0");
      if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + ss;
      return m + ":" + ss;
    }

    function computeFailSeconds(captureSec) {
      return Math.max(10, 10 + Math.floor(Math.max(0, captureSec) / 300) * 2);
    }

    function updateHints() {
      const fixedSec = Math.max(1, parseTimecode(document.getElementById("fixedDuration").value, 30));
      const fixedFail = computeFailSeconds(fixedSec);
      document.getElementById("fixedDurationHint").textContent =
        "Saves the last " + fixedSec + "s (" + formatDisplayDuration(fixedSec) + ") · Fail timer: " + fixedFail + "s (10s + 2s per 5m)";

      const dynSec = Math.max(1, Number(globalState.dynamicCurrentSeconds) || 60);
      const dynFail = computeFailSeconds(dynSec);
      const dynHint = document.getElementById("dynamicDurationHint");
      if (dynHint) {
        dynHint.textContent =
          "Current Dynamic Length: " + dynSec + "s (" + formatDisplayDuration(dynSec) + ") · Fail timer: " + dynFail + "s (10s + 2s per 5m)";
      }

      const stepSec = Math.max(1, parseTimecode(document.getElementById("stepDuration").value, 30));
      const stepHint = document.getElementById("stepDurationHint");
      if (stepHint && actionInfo) {
        if (actionInfo.action === "${PLUGIN_UUID}.dynamicdecrease") {
          const autoFloor = Math.max(1, Math.min(30, stepSec));
          const rawFloor = document.getElementById("minFloor").value.trim();
          const effFloor = rawFloor ? Math.max(1, parseTimecode(rawFloor, autoFloor)) : autoFloor;
          stepHint.textContent =
            "Subtracts " + stepSec + "s (" + formatDisplayDuration(stepSec) + ") per press · Bottoms out at " + formatDisplayDuration(effFloor) + " · Hold to repeat";
        } else {
          stepHint.textContent =
            "Adds +" + stepSec + "s (" + formatDisplayDuration(stepSec) + ") per press · Hold to repeat";
        }
      }

      const resetSec = Math.max(1, parseTimecode(document.getElementById("resetDuration").value, 30));
      const resetHint = document.getElementById("resetDurationHint");
      if (resetHint) {
        resetHint.textContent =
          "Sets Dynamic Length to " + resetSec + "s (" + formatDisplayDuration(resetSec) + ") when pressed · Independent to this button";
      }

      const rawBoost = Number(document.getElementById("fontSizeBoost").value);
      const boostVal = Number.isFinite(rawBoost) && rawBoost > 0 ? Math.min(56, Math.round(rawBoost)) : 0;
      const boostHint = document.getElementById("fontSizeBoostHint");
      if (boostHint) {
        if (boostVal <= 0) {
          boostHint.textContent = "0 (Off) — Uses Stream Deck's native text size & icon layer.";
        } else {
          boostHint.textContent =
            "Boost +" + boostVal + "pt (e.g. 16 → " + (16 + boostVal) + "pt) using Stream Deck's selected Font, Style & Color. Leave Stream Deck's Title box blank so text doesn't double up.";
        }
      }

      const rawDelay = Number(document.getElementById("repeatDelaySeconds").value);
      const delayVal = Number.isFinite(rawDelay) && rawDelay >= 0.05 ? Math.min(10, rawDelay) : 0.5;
      const rawRate = Number(document.getElementById("repeatRateHz").value);
      const rateVal = Number.isFinite(rawRate) && rawRate >= 0.5 ? Math.min(30, rawRate) : 5;
      const intervalMs = Math.max(33, Math.round(1000 / rateVal));
      const repeatHint = document.getElementById("repeatSummaryHint");
      if (repeatHint) {
        repeatHint.textContent =
          "Holding + or - waits " + delayVal + "s, then triggers " + rateVal + "×/sec (every " + intervalMs + "ms)";
      }
    }

    function renderGlobalFields() {
      const fields = [
        "masterHotkey",
        "mainCapturesDir",
        "outputDir",
        "ffmpegPath",
        "successSoundPath",
        "errorSoundPath"
      ];
      fields.forEach((id) => {
        const el = document.getElementById(id);
        if (el && globalState[id] !== undefined) el.value = globalState[id];
      });
      document.getElementById("globalOpenAfterSave").checked = Boolean(globalState.openAfterSave);
      document.getElementById("deleteOriginal").checked = globalState.deleteOriginal !== false;
      document.getElementById("repeatDelaySeconds").value =
        Number.isFinite(Number(globalState.repeatDelaySeconds)) ? globalState.repeatDelaySeconds : 0.5;
      document.getElementById("repeatRateHz").value =
        Number.isFinite(Number(globalState.repeatRateHz)) ? globalState.repeatRateHz : 5;
      document.getElementById("enableDebugLog").checked = Boolean(globalState.enableDebugLog);

      if (globalState.uiMenuOpen && typeof globalState.uiMenuOpen === "object") {
        applyMenuOpenState(loadRememberedMenuState(globalState.uiMenuOpen));
      }
      updateHints();
    }

    function persistGlobal() {
      const rawDelay = Number(document.getElementById("repeatDelaySeconds").value);
      const rawRate = Number(document.getElementById("repeatRateHz").value);
      const menuState = readCurrentMenuOpenState();
      try {
        localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(menuState));
      } catch {}

      globalState = Object.assign({}, globalState, {
        openAfterSave: document.getElementById("globalOpenAfterSave").checked,
        deleteOriginal: document.getElementById("deleteOriginal").checked,
        masterHotkey: document.getElementById("masterHotkey").value.trim(),
        mainCapturesDir: document.getElementById("mainCapturesDir").value.trim(),
        outputDir: document.getElementById("outputDir").value.trim(),
        ffmpegPath: document.getElementById("ffmpegPath").value.trim(),
        successSoundPath: document.getElementById("successSoundPath").value.trim(),
        errorSoundPath: document.getElementById("errorSoundPath").value.trim(),
        repeatDelaySeconds: Number.isFinite(rawDelay) && rawDelay >= 0.05 ? Math.min(10, rawDelay) : 0.5,
        repeatRateHz: Number.isFinite(rawRate) && rawRate >= 0.5 ? Math.min(30, rawRate) : 5,
        enableDebugLog: document.getElementById("enableDebugLog").checked,
        uiMenuOpen: menuState
      });
      updateHints();
      if (websocket && websocket.readyState === 1) {
        websocket.send(JSON.stringify({
          event: "setGlobalSettings",
          context: piUUID,
          payload: globalState
        }));
      }
    }

    function normalizeOpenMode(saved) {
      if (saved && (saved.openAfterSaveMode === "global" || saved.openAfterSaveMode === "open" || saved.openAfterSaveMode === "never")) {
        return saved.openAfterSaveMode;
      }
      if (saved && saved.openAfterSave === true) return "open";
      return "global";
    }

    function persistAction() {
      const modeVal = document.getElementById("openAfterSaveMode").value || "global";
      const rawBoost = Number(document.getElementById("fontSizeBoost").value);
      const safeBoost = Number.isFinite(rawBoost) && rawBoost > 0 ? Math.min(56, Math.round(rawBoost)) : 0;

      actionState = Object.assign({}, actionState, {
        fixedDuration: document.getElementById("fixedDuration").value.trim() || "00:30",
        stepDuration: document.getElementById("stepDuration").value.trim() || "00:30",
        minFloor: document.getElementById("minFloor").value.trim(),
        resetDuration: document.getElementById("resetDuration").value.trim() || "00:30",
        openAfterSaveMode: modeVal,
        openAfterSave: modeVal === "open",
        fontSizeBoost: safeBoost,
        bgImagePath: document.getElementById("bgImagePath").value.trim(),
        customBoostText: document.getElementById("customBoostText").value
      });
      updateHints();
      if (websocket && websocket.readyState === 1) {
        websocket.send(JSON.stringify({
          event: "setSettings",
          context: piUUID,
          payload: actionState
        }));
        if (actionInfo && actionInfo.context) {
          sendPluginCmd({
            cmd: "syncActionSettings",
            actionContext: actionInfo.context,
            settings: actionState
          });
        }
      }
    }

    function sendPluginCmd(payload) {
      if (!websocket || websocket.readyState !== 1 || !actionInfo) return;
      websocket.send(JSON.stringify({
        event: "sendToPlugin",
        action: actionInfo.action,
        context: piUUID,
        payload
      }));
    }

    window.connectElgatoStreamDeckSocket = function(inPort, inUUID, inRegisterEvent, _inInfo, inActionInfo) {
      piUUID = inUUID;
      actionInfo = JSON.parse(inActionInfo);

      const isFixed = actionInfo.action === "${PLUGIN_UUID}.fixedlength";
      const isDynamic = actionInfo.action === "${PLUGIN_UUID}.dynamiclength";
      const isIncrease = actionInfo.action === "${PLUGIN_UUID}.dynamicincrease";
      const isDecrease = actionInfo.action === "${PLUGIN_UUID}.dynamicdecrease";
      const isReset = actionInfo.action === "${PLUGIN_UUID}.dynamicreset";

      // Show Button Action Settings on all ReplaySlice buttons (every button supports Custom Text Size & Key Background)
      document.getElementById("actionSettingsSection").classList.remove("hidden");
      const saved = (actionInfo.payload && actionInfo.payload.settings) || {};
      const initBoost = Number(saved.fontSizeBoost);
      actionState = Object.assign({}, saved, {
        fixedDuration: saved.fixedDuration || "00:30",
        stepDuration: saved.stepDuration || "00:30",
        minFloor: saved.minFloor || "",
        resetDuration: saved.resetDuration || "00:30",
        openAfterSaveMode: normalizeOpenMode(saved),
        fontSizeBoost: Number.isFinite(initBoost) && initBoost > 0 ? Math.min(56, Math.round(initBoost)) : 0,
        bgImagePath: saved.bgImagePath || "",
        customBoostText: saved.customBoostText || ""
      });

      document.getElementById("fontSizeBoost").value = actionState.fontSizeBoost;
      document.getElementById("bgImagePath").value = actionState.bgImagePath;
      document.getElementById("customBoostText").value = actionState.customBoostText;

      if (isFixed || isDynamic) {
        document.getElementById("openAfterSaveWrap").classList.remove("hidden");
        document.getElementById("openAfterSaveMode").value = actionState.openAfterSaveMode;
      }
      if (isFixed) {
        document.getElementById("fixedOnlyRow").classList.remove("hidden");
        document.getElementById("fixedDuration").value = actionState.fixedDuration;
      }
      if (isDynamic) {
        document.getElementById("dynamicOnlyRow").classList.remove("hidden");
      }
      if (isIncrease || isDecrease) {
        document.getElementById("stepOnlyRow").classList.remove("hidden");
        document.getElementById("stepDurationLabel").textContent = isIncrease
          ? "Increase Step Length (HH:MM:SS, MM:SS, or sec)"
          : "Decrease Step Length (HH:MM:SS, MM:SS, or sec)";
        document.getElementById("stepDuration").value = actionState.stepDuration;
      }
      if (isDecrease) {
        document.getElementById("minFloorRow").classList.remove("hidden");
        document.getElementById("minFloor").value = actionState.minFloor;
      }
      if (isReset) {
        document.getElementById("resetOnlyRow").classList.remove("hidden");
        document.getElementById("resetDuration").value = actionState.resetDuration;
      }

      websocket = new WebSocket("ws://127.0.0.1:" + inPort);
      websocket.onopen = function() {
        websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
        websocket.send(JSON.stringify({ event: "getGlobalSettings", context: inUUID }));
        websocket.send(JSON.stringify({ event: "getSettings", context: inUUID }));
        sendPluginCmd({ cmd: "verifyFfmpeg" });
      };

      websocket.onmessage = function(evt) {
        const msg = JSON.parse(evt.data);
        if (msg.event === "didReceiveGlobalSettings") {
          const incoming = (msg.payload && msg.payload.settings) || {};
          globalState = Object.assign({}, DEFAULTS, incoming);
          renderGlobalFields();
        } else if (msg.event === "didReceiveSettings") {
          const incoming = (msg.payload && msg.payload.settings) || {};
          const incBoost = Number(incoming.fontSizeBoost !== undefined ? incoming.fontSizeBoost : actionState.fontSizeBoost);
          actionState = Object.assign({}, actionState, incoming, {
            fixedDuration: incoming.fixedDuration || actionState.fixedDuration || "00:30",
            stepDuration: incoming.stepDuration || actionState.stepDuration || "00:30",
            minFloor: incoming.minFloor !== undefined ? incoming.minFloor : (actionState.minFloor || ""),
            resetDuration: incoming.resetDuration || actionState.resetDuration || "00:30",
            openAfterSaveMode: normalizeOpenMode(incoming),
            fontSizeBoost: Number.isFinite(incBoost) && incBoost > 0 ? Math.min(56, Math.round(incBoost)) : 0,
            bgImagePath: incoming.bgImagePath !== undefined ? incoming.bgImagePath : (actionState.bgImagePath || ""),
            customBoostText: incoming.customBoostText !== undefined ? incoming.customBoostText : (actionState.customBoostText || "")
          });
          document.getElementById("openAfterSaveMode").value = actionState.openAfterSaveMode;
          document.getElementById("fontSizeBoost").value = actionState.fontSizeBoost;
          document.getElementById("bgImagePath").value = actionState.bgImagePath;
          document.getElementById("customBoostText").value = actionState.customBoostText;
          if (isFixed) document.getElementById("fixedDuration").value = actionState.fixedDuration;
          if (isIncrease || isDecrease) document.getElementById("stepDuration").value = actionState.stepDuration;
          if (isDecrease) document.getElementById("minFloor").value = actionState.minFloor;
          if (isReset) document.getElementById("resetDuration").value = actionState.resetDuration;
          updateHints();
        } else if (msg.event === "sendToPropertyInspector" && msg.payload) {
          if (msg.payload.event === "ffmpegStatus") {
            const st = document.getElementById("ffmpegStatus");
            st.textContent = msg.payload.detail;
            st.className = "hint " + (msg.payload.ok ? "status-ok" : "status-err");
          } else if (msg.payload.event === "pickedPath" && msg.payload.field) {
            const input = document.getElementById(msg.payload.field);
            if (input) {
              input.value = msg.payload.path;
              if (msg.payload.field === "bgImagePath") {
                persistAction();
              } else {
                persistGlobal();
              }
            }
          }
        }
      };
    };

    document.querySelectorAll("#masterHotkey, #mainCapturesDir, #outputDir, #ffmpegPath, #successSoundPath, #errorSoundPath, #repeatDelaySeconds, #repeatRateHz")
      .forEach((el) => el.addEventListener("input", persistGlobal));
    document.getElementById("globalOpenAfterSave").addEventListener("change", persistGlobal);
    document.getElementById("deleteOriginal").addEventListener("change", persistGlobal);
    document.getElementById("enableDebugLog").addEventListener("change", persistGlobal);

    ["menu-appearance", "menu-dirs", "menu-sounds", "menu-repeat", "menu-diagnostics"].forEach((id) => {
      document.getElementById(id).addEventListener("toggle", () => {
        if (!isApplyingMenuState) persistGlobal();
      });
    });

    document.querySelectorAll("#fixedDuration, #stepDuration, #minFloor, #resetDuration, #fontSizeBoost, #bgImagePath, #customBoostText")
      .forEach((el) => el.addEventListener("input", persistAction));
    document.getElementById("openAfterSaveMode").addEventListener("change", persistAction);

    document.getElementById("boostMinusBtn").addEventListener("click", () => {
      const el = document.getElementById("fontSizeBoost");
      const cur = Math.max(0, Number(el.value) || 0);
      el.value = Math.max(0, cur - 1);
      persistAction();
    });
    document.getElementById("boostPlusBtn").addEventListener("click", () => {
      const el = document.getElementById("fontSizeBoost");
      const cur = Math.max(0, Number(el.value) || 0);
      el.value = Math.min(56, cur + 1);
      persistAction();
    });
    document.getElementById("boostResetBtn").addEventListener("click", () => {
      document.getElementById("fontSizeBoost").value = 0;
      persistAction();
    });
    document.getElementById("clearBgImageBtn").addEventListener("click", () => {
      document.getElementById("bgImagePath").value = "";
      persistAction();
    });

    document.getElementById("verifyFfmpegBtn").addEventListener("click", () => {
      sendPluginCmd({ cmd: "verifyFfmpeg", ffmpegPath: document.getElementById("ffmpegPath").value.trim() });
    });

    const resetBtn = document.getElementById("resetDynamicBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => sendPluginCmd({ cmd: "resetDynamicLength" }));
    }

    document.querySelectorAll("[data-browse-folder]").forEach((btn) => {
      btn.addEventListener("click", () => {
        sendPluginCmd({
          cmd: "browseFolder",
          field: btn.getAttribute("data-browse-folder"),
          title: btn.getAttribute("data-title")
        });
      });
    });

    document.querySelectorAll("[data-browse-file]").forEach((btn) => {
      btn.addEventListener("click", () => {
        sendPluginCmd({
          cmd: "browseFile",
          field: btn.getAttribute("data-browse-file"),
          filterKind: btn.getAttribute("data-kind"),
          title: btn.getAttribute("data-title")
        });
      });
    });

    document.querySelectorAll("[data-test-sound]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const fieldId = btn.getAttribute("data-test-sound");
        sendPluginCmd({ cmd: "testSound", soundPath: document.getElementById(fieldId).value.trim() });
      });
    });

    // Interactive Hotkey Recorder
    const recordBtn = document.getElementById("recordHotkeyBtn");
    recordBtn.addEventListener("click", () => {
      recordingHotkey = !recordingHotkey;
      recordBtn.textContent = recordingHotkey ? "Press Keys..." : "Record";
    });

    window.addEventListener("keydown", (e) => {
      if (!recordingHotkey) return;
      e.preventDefault();
      e.stopPropagation();
      const ignore = ["Control", "Shift", "Alt", "Meta"];
      if (ignore.includes(e.key)) return;

      const parts = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Win");

      let keyName = e.key;
      if (e.code && e.code.startsWith("Numpad")) {
        keyName = e.code.replace("Numpad", "Num");
      } else if (keyName === " ") {
        keyName = "Space";
      } else if (keyName.length === 1) {
        keyName = keyName.toUpperCase();
      }
      parts.push(keyName);

      document.getElementById("masterHotkey").value = parts.join("+");
      recordingHotkey = false;
      recordBtn.textContent = "Record";
      persistGlobal();
    }, true);

    renderGlobalFields();
  </script>
</body>
</html>
`;
}

export function generateWindowsInstallScript(): string {
  return `@echo off
setlocal
echo ========================================================
echo   ReplaySlice - Elgato Stream Deck Plugin Installer
echo ========================================================
echo.

set "DEST=%APPDATA%\\Elgato\\StreamDeck\\Plugins\\${SD_PLUGIN_FOLDER}"
set "SRC=%~dp0${SD_PLUGIN_FOLDER}"

if not exist "%SRC%\\manifest.json" (
  echo [ERROR] Could not find ${SD_PLUGIN_FOLDER} next to this script.
  echo Please extract the entire ZIP folder before running install-windows.bat.
  pause
  exit /b 1
)

echo Closing Stream Deck software so plugin files can update cleanly...
taskkill /IM "StreamDeck.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo Installing ReplaySlice to:
echo   %DEST%
if not exist "%DEST%" mkdir "%DEST%"
xcopy "%SRC%\\*" "%DEST%\\" /E /I /Y >nul

echo.
echo Relaunching Elgato Stream Deck...
if exist "%ProgramFiles%\\Elgato\\StreamDeck\\StreamDeck.exe" (
  start "" "%ProgramFiles%\\Elgato\\StreamDeck\\StreamDeck.exe"
)

echo.
echo [SUCCESS] ReplaySlice is installed! Look for "ReplaySlice" in the right sidebar of Stream Deck.
pause
`;
}

export function generateMacInstallScript(): string {
  return `#!/bin/bash
set -e

echo "========================================================"
echo "  ReplaySlice - Elgato Stream Deck Plugin Installer"
echo "========================================================"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SRC="$SCRIPT_DIR/${SD_PLUGIN_FOLDER}"
DEST="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/${SD_PLUGIN_FOLDER}"

if [ ! -f "$SRC/manifest.json" ]; then
  echo "[ERROR] Could not find ${SD_PLUGIN_FOLDER} next to this script."
  exit 1
fi

echo "Quit Elgato Stream Deck briefly if running..."
osascript -e 'quit app "Elgato Stream Deck"' >/dev/null 2>&1 || true
sleep 2

mkdir -p "$DEST"
cp -R "$SRC/"* "$DEST/"
chmod +x "$DEST/bin/plugin.mjs"

echo "Launching Elgato Stream Deck..."
open -a "Elgato Stream Deck" || true

echo "[SUCCESS] ReplaySlice installed! Look under ReplaySlice in the Stream Deck sidebar."
`;
}

export function generateReadmeMarkdown(): string {
  return `# ReplaySlice — Multi-Length Instant Replay Stream Deck Plugin

## Quick Installation

### Option A: Double-Click Installer (\`.streamDeckPlugin\`)
1. Double-click \`${PLUGIN_UUID}.streamDeckPlugin\`.
2. Elgato Stream Deck (v6.5+) will prompt to install **ReplaySlice** automatically.

### Option B: Manual / Script Install (from ZIP)
- **Windows**: Extract the ZIP anywhere and double-click \`install-windows.bat\` (copies \`${SD_PLUGIN_FOLDER}\` to \`%APPDATA%\\Elgato\\StreamDeck\\Plugins\\\`).
- **macOS**: Extract the ZIP and run \`install-mac.command\` (copies \`${SD_PLUGIN_FOLDER}\` to \`~/Library/Application Support/com.elgato.StreamDeck/Plugins/\`).

## Included Stream Deck Actions
Look under **ReplaySlice** in the right-hand Actions list of your Stream Deck software:
1. **Fixed Length** — Saves a clip of a specific duration (\`HH:MM:SS\` or \`MM:SS\`) set on that button, with a per-button override to follow the global auto-open setting, always open, or never open.
2. **Dynamic Length** — Defaults to \`1:00\`. Updates its displayed duration automatically when you press or hold Dynamic Increase / Decrease or press Reset Dynamic Length, and supports per-button auto-open overrides independently on each placed Dynamic Length button. Style the font, size, color, and icon directly in Stream Deck's Title bar (leave the static Title text empty so the dynamic timer displays).
3. **Dynamic Increase** — Defaults to \`+\` text and adds a button-specific step duration (default \`00:30\`) to the Dynamic Length timer. Hold the key down to auto-repeat after a short delay (configurable under **Key Delay / Repeat**).
4. **Dynamic Decrease** — Defaults to \`-\` text and subtracts a button-specific step duration (default \`00:30\`) from the Dynamic Length timer, with an optional minimum floor. Hold the key down to auto-repeat.
5. **Reset Dynamic Length** — Sets Dynamic Length directly to a button-specific target duration (default \`00:30\`). Place multiple reset/preset buttons for instant jumps to any duration.
6. **Open Output Directory** — Opens your configured Output Directory in Explorer / Finder.
7. **Open Captures Directory** — Opens your configured Main Captures Directory in Explorer / Finder.

## Key Behaviors
- **Custom Text Size Boost & Key Background**: Every ReplaySlice button includes a collapsible **Custom Text Size & Key Background** menu in *Button Action Settings*. Leave **Font Size Boost** at \`0\` for native Stream Deck text, or dial \`+1\`, \`+2\`, … up to \`36pt+\` using the exact font, style, color, and alignment selected in Stream Deck's main UI — with an optional **Key Background Image (\`.png\` / \`.jpg\`)** picker right inside the same menu so custom PNG backgrounds work behind giant dynamic timers.
- **Hold-to-Repeat on \`+\` / \`-\`**: Holding *Dynamic Increase* or *Dynamic Decrease* waits \`0.5s\` by default and then repeats \`5\` times per second. Both values can be customized in Global Plugin Settings under **Key Delay / Repeat**.
- **2-Second Capture Debounce**: Rapidly pressing *Fixed Length* or *Dynamic Length* within 2 seconds ignores extra presses. *Dynamic Increase*, *Dynamic Decrease*, and *Reset Dynamic Length* are never debounced.
- **Zero Re-Encoding & Aligned Audio/Video**: Waits for OBS / ShadowPlay to close its write lock so the file is 100% flushed, inspects audio & video durations via \`ffprobe\`, snaps to the nearest keyframe, and runs \`ffmpeg -c copy -avoid_negative_ts make_zero -shortest\` so audio and video lengths match without cutting off a 1.5s tail.
- **Dynamic Fail Timer**: Minimum 10 seconds, plus 2 seconds for every 5 minutes of the capture length (e.g. \`10:30\` = 14s fail timer, \`01:00:00\` = 34s fail timer). Plays your Success Sound (\`.wav\` or \`.mp3\`) if configured once the trimmed clip is verified on disk, or Failure Sound if it fails/times out.
`;
}

export function getAllGeneratedPluginFiles(settings: GlobalPluginSettings): GeneratedPluginFile[] {
  return [
    {
      path: `${SD_PLUGIN_FOLDER}/manifest.json`,
      label: 'manifest.json',
      language: 'json',
      description: `Stream Deck SDK v2 manifest (v${PLUGIN_VERSION}) declaring Node.js 20 runtime and all 7 ReplaySlice button actions.`,
      content: generateManifestJson(),
    },
    {
      path: `${SD_PLUGIN_FOLDER}/bin/plugin.mjs`,
      label: 'bin/plugin.mjs',
      language: 'javascript',
      description:
        'Standalone Node 20 backend: WebSocket client, 2s capture debounce, OS hotkey injection, write-lock polling, ffprobe + ffmpeg stream copy, and .wav/.mp3 audio playback.',
      content: generatePluginNodeBackend(settings),
    },
    {
      path: `${SD_PLUGIN_FOLDER}/ui/property-inspector.html`,
      label: 'ui/property-inspector.html',
      language: 'html',
      description:
        'Stream Deck sidebar UI with HH:MM:SS text inputs, live Fail Timer readout, hotkey recorder, native folder/file browse buttons, and FFmpeg verifier.',
      content: generatePropertyInspectorHtml(settings),
    },
    {
      path: 'install-windows.bat',
      label: 'install-windows.bat',
      language: 'batch',
      description: 'One-click Windows installer script that copies the .sdPlugin bundle into %APPDATA%\\Elgato\\StreamDeck\\Plugins.',
      content: generateWindowsInstallScript(),
    },
    {
      path: 'install-mac.command',
      label: 'install-mac.command',
      language: 'shell',
      description: 'One-click macOS installer script for ~/Library/Application Support/com.elgato.StreamDeck/Plugins.',
      content: generateMacInstallScript(),
    },
    {
      path: 'README.md',
      label: 'README.md',
      language: 'markdown',
      description: 'Quick-start setup and button customization guide.',
      content: generateReadmeMarkdown(),
    },
  ];
}
