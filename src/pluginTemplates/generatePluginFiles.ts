import { GeneratedPluginFile, GlobalPluginSettings } from '../types/plugin';

export const PLUGIN_UUID = 'com.antvenom.replayslice';
export const PLUGIN_VERSION = '1.0.0';
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
        Tooltip: 'Increase the Dynamic Length button duration by Dynamic Step Length',
        Icon: 'imgs/action-plus',
        Controllers: ['Keypad'],
        States: [
          {
            Image: 'imgs/key-default',
            TitleAlignment: 'middle',
          },
        ],
      },
      {
        UUID: `${PLUGIN_UUID}.dynamicdecrease`,
        Name: 'Dynamic Decrease',
        Tooltip: 'Decrease the Dynamic Length button duration by Dynamic Step Length',
        Icon: 'imgs/action-minus',
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
      masterHotkey: defaults.masterHotkey || 'Alt+F10',
      mainCapturesDir: defaults.mainCapturesDir || '',
      outputDir: defaults.outputDir || '',
      deleteOriginal: defaults.deleteOriginal ?? true,
      dynamicStepLength: defaults.dynamicStepLength || '00:30',
      ffmpegPath: defaults.ffmpegPath || '',
      successSoundPath: defaults.successSoundPath || '',
      errorSoundPath: defaults.errorSoundPath || '',
      dynamicCurrentSeconds: 60,
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
    '',
    'const ACTION_FIXED = "com.antvenom.replayslice.fixedlength";',
    'const ACTION_DYNAMIC = "com.antvenom.replayslice.dynamiclength";',
    'const ACTION_INCREASE = "com.antvenom.replayslice.dynamicincrease";',
    'const ACTION_DECREASE = "com.antvenom.replayslice.dynamicdecrease";',
    'const ACTION_OPEN_OUTPUT = "com.antvenom.replayslice.openfolder";',
    'const ACTION_OPEN_CAPTURES = "com.antvenom.replayslice.opencaptures";',
    '',
    'const VIDEO_EXTENSIONS = new Set([".mp4", ".mkv", ".mov", ".avi", ".flv", ".ts", ".m4v", ".webm"]);',
    'const DEBOUNCE_MS = 2000;',
    '',
    `const DEFAULT_GLOBAL_SETTINGS = ${serializedDefaults};`,
    '',
    'function writeLog(level, message, extra = "") {',
    '  try {',
    '    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });',
    '    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 2 * 1024 * 1024) {',
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
    '      : "Executable Files (*.exe)|*.exe|All Files (*.*)|*.*";',
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
    'let globalSettings = { ...DEFAULT_GLOBAL_SETTINGS };',
    'const visibleContexts = new Map(); // context -> { action, settings }',
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
    '    writeLog("INFO", "Stream Deck socket closed. Exiting.");',
    '    process.exit(0);',
    '  }',
    ');',
    '',
    'function refreshAllDynamicButtons() {',
    '  const title = formatDynamicTitle(globalSettings.dynamicCurrentSeconds ?? 60);',
    '  for (const [context, meta] of visibleContexts.entries()) {',
    '    if (meta.action === ACTION_DYNAMIC) {',
    '      sd.sendJSON({',
    '        event: "setTitle",',
    '        context,',
    '        payload: { title, target: 0 },',
    '      });',
    '    }',
    '  }',
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
    '',
    'async function executeCaptureFlow(context, requestedSeconds) {',
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
    '  }',
    '}',
    '',
    'function handleStreamDeckMessage(msg) {',
    '  const { event, action, context, payload } = msg;',
    '',
    '  if (event === "didReceiveGlobalSettings") {',
    '    const incoming = (payload && payload.settings) || {};',
    '    // First launch: seed defaults into Stream Deck global store if empty',
    '    const isFirstSeed = Object.keys(incoming).length === 0;',
    '    globalSettings = { ...DEFAULT_GLOBAL_SETTINGS, ...incoming };',
    '    if (!Number.isFinite(globalSettings.dynamicCurrentSeconds) || globalSettings.dynamicCurrentSeconds <= 0) {',
    '      globalSettings.dynamicCurrentSeconds = 60;',
    '    }',
    '    if (isFirstSeed) saveGlobalSettings();',
    '    refreshAllDynamicButtons();',
    '    return;',
    '  }',
    '',
    '  if (event === "willAppear") {',
    '    visibleContexts.set(context, { action, settings: (payload && payload.settings) || {} });',
    '    if (action === ACTION_DYNAMIC) {',
    '      sd.sendJSON({',
    '        event: "setTitle",',
    '        context,',
    '        payload: { title: formatDynamicTitle(globalSettings.dynamicCurrentSeconds ?? 60), target: 0 },',
    '      });',
    '    }',
    '    return;',
    '  }',
    '',
    '  if (event === "willDisappear") {',
    '    visibleContexts.delete(context);',
    '    return;',
    '  }',
    '',
    '  if (event === "didReceiveSettings") {',
    '    const existing = visibleContexts.get(context) || { action, settings: {} };',
    '    existing.settings = (payload && payload.settings) || {};',
    '    visibleContexts.set(context, existing);',
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
    '      const btnSettings = (payload && payload.settings) || (visibleContexts.get(context) || {}).settings || {};',
    '      const fixedSec = Math.max(1, parseTimecodeToSeconds(btnSettings.fixedDuration || "00:30", 30));',
    '      executeCaptureFlow(context, fixedSec);',
    '    } else if (action === ACTION_DYNAMIC) {',
    '      const dynSec = Math.max(1, Number(globalSettings.dynamicCurrentSeconds) || 60);',
    '      executeCaptureFlow(context, dynSec);',
    '    } else if (action === ACTION_INCREASE) {',
    '      const step = Math.max(1, parseTimecodeToSeconds(globalSettings.dynamicStepLength || "00:30", 30));',
    '      globalSettings.dynamicCurrentSeconds = Math.max(1, (Number(globalSettings.dynamicCurrentSeconds) || 60) + step);',
    '      saveGlobalSettings();',
    '      refreshAllDynamicButtons();',
    '    } else if (action === ACTION_DECREASE) {',
    '      const step = Math.max(1, parseTimecodeToSeconds(globalSettings.dynamicStepLength || "00:30", 30));',
    '      const current = Number(globalSettings.dynamicCurrentSeconds) || 60;',
    '      if (current > step) {',
    '        globalSettings.dynamicCurrentSeconds = current - step;',
    '      } else {',
    '        globalSettings.dynamicCurrentSeconds = Math.max(1, Math.min(current, step));',
    '      }',
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
    masterHotkey: defaults.masterHotkey || 'Alt+F10',
    mainCapturesDir: defaults.mainCapturesDir || '',
    outputDir: defaults.outputDir || '',
    deleteOriginal: defaults.deleteOriginal ?? true,
    dynamicStepLength: defaults.dynamicStepLength || '00:30',
    ffmpegPath: defaults.ffmpegPath || '',
    successSoundPath: defaults.successSoundPath || '',
    errorSoundPath: defaults.errorSoundPath || '',
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
    .row label {
      color: #BDBDBD;
      font-weight: 500;
    }
    .inline-group {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    input[type="text"] {
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
    input[type="text"]:focus {
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
      margin: 10px 0;
      cursor: pointer;
    }
    .hint {
      font-size: 11px;
      color: #8E8E8E;
    }
    .status-ok { color: #4ADE80; }
    .status-err { color: #F87171; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <!-- Per-Button Settings: Fixed Length ONLY -->
  <div id="fixedSection" class="hidden">
    <div class="section-heading">Button Action Settings</div>
    <div class="row">
      <label for="fixedDuration">Fixed Replay Length (HH:MM:SS or MM:SS)</label>
      <input id="fixedDuration" type="text" placeholder="00:30" value="00:30" />
      <div id="fixedDurationHint" class="hint">Saves the last 30s · Fail timer: 10s</div>
    </div>
  </div>

  <!-- Per-Button Note: Dynamic Length ONLY -->
  <div id="dynamicSection" class="hidden">
    <div class="section-heading">Dynamic Length Button</div>
    <div class="row">
      <div id="dynamicDurationHint" class="hint">Current Dynamic Length: 60s · Fail timer: 10s</div>
      <div class="hint">
        Use Stream Deck's native Title bar above to choose your preferred font, size, color, and position. Leave the Title text box empty so ReplaySlice can update the live duration automatically.
      </div>
      <div>
        <button id="resetDynamicBtn" type="button">Reset Dynamic Length to 1:00</button>
      </div>
    </div>
  </div>

  <!-- Shared Global Plugin Settings -->
  <div class="section-heading">Global Plugin Settings</div>

  <div class="row">
    <label for="masterHotkey">Master Replay Hotkey (OBS / ShadowPlay)</label>
    <div class="inline-group">
      <input id="masterHotkey" type="text" placeholder="Alt+F10" />
      <button id="recordHotkeyBtn" type="button">Record</button>
    </div>
    <div class="hint">Shortcut sent to save the master instant replay buffer</div>
  </div>

  <div class="row">
    <label for="dynamicStepLength">Dynamic Step Length (HH:MM:SS, MM:SS, or sec)</label>
    <input id="dynamicStepLength" type="text" placeholder="00:30" />
    <div class="hint">Amount added or subtracted by Dynamic Increase / Decrease</div>
  </div>

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

  <label class="checkbox-row">
    <input id="deleteOriginal" type="checkbox" />
    <span>Delete original master capture after trim succeeds</span>
  </label>

  <div class="row">
    <label for="ffmpegPath">FFmpeg Path (Optional)</label>
    <div class="inline-group">
      <input id="ffmpegPath" type="text" placeholder="Auto-detect from system PATH" />
      <button type="button" data-browse-file="ffmpegPath" data-kind="exe" data-title="Select ffmpeg executable">Browse</button>
      <button id="verifyFfmpegBtn" type="button">Verify</button>
    </div>
    <div id="ffmpegStatus" class="hint">Leave blank if FFmpeg is installed in PATH</div>
  </div>

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

  <script>
    const DEFAULTS = ${serializedDefaults};
    let websocket = null;
    let piUUID = "";
    let actionInfo = null;
    let globalState = Object.assign({}, DEFAULTS);
    let actionState = { fixedDuration: "00:30" };
    let recordingHotkey = false;

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

    function computeFailSeconds(captureSec) {
      return Math.max(10, 10 + Math.floor(Math.max(0, captureSec) / 300) * 2);
    }

    function updateHints() {
      const fixedSec = Math.max(1, parseTimecode(document.getElementById("fixedDuration").value, 30));
      const fixedFail = computeFailSeconds(fixedSec);
      document.getElementById("fixedDurationHint").textContent =
        "Saves the last " + fixedSec + "s · Fail timer: " + fixedFail + "s (10s + 2s per 5m)";

      const dynSec = Math.max(1, Number(globalState.dynamicCurrentSeconds) || 60);
      const dynFail = computeFailSeconds(dynSec);
      const dynHint = document.getElementById("dynamicDurationHint");
      if (dynHint) {
        dynHint.textContent =
          "Current Dynamic Length: " + dynSec + "s · Fail timer: " + dynFail + "s (10s + 2s per 5m)";
      }
    }

    function renderGlobalFields() {
      const fields = [
        "masterHotkey",
        "dynamicStepLength",
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
      document.getElementById("deleteOriginal").checked = globalState.deleteOriginal !== false;
      updateHints();
    }

    function persistGlobal() {
      globalState = Object.assign({}, globalState, {
        masterHotkey: document.getElementById("masterHotkey").value.trim(),
        dynamicStepLength: document.getElementById("dynamicStepLength").value.trim(),
        mainCapturesDir: document.getElementById("mainCapturesDir").value.trim(),
        outputDir: document.getElementById("outputDir").value.trim(),
        deleteOriginal: document.getElementById("deleteOriginal").checked,
        ffmpegPath: document.getElementById("ffmpegPath").value.trim(),
        successSoundPath: document.getElementById("successSoundPath").value.trim(),
        errorSoundPath: document.getElementById("errorSoundPath").value.trim()
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

    function persistAction() {
      actionState = Object.assign({}, actionState, {
        fixedDuration: document.getElementById("fixedDuration").value.trim() || "00:30"
      });
      updateHints();
      if (websocket && websocket.readyState === 1) {
        websocket.send(JSON.stringify({
          event: "setSettings",
          context: piUUID,
          payload: actionState
        }));
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

      if (actionInfo.action === "${PLUGIN_UUID}.fixedlength") {
        document.getElementById("fixedSection").classList.remove("hidden");
        const savedFixed = actionInfo.payload && actionInfo.payload.settings && actionInfo.payload.settings.fixedDuration;
        if (savedFixed) {
          actionState.fixedDuration = savedFixed;
          document.getElementById("fixedDuration").value = savedFixed;
        }
      } else if (actionInfo.action === "${PLUGIN_UUID}.dynamiclength") {
        document.getElementById("dynamicSection").classList.remove("hidden");
      }

      websocket = new WebSocket("ws://127.0.0.1:" + inPort);
      websocket.onopen = function() {
        websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
        websocket.send(JSON.stringify({ event: "getGlobalSettings", context: inUUID }));
        sendPluginCmd({ cmd: "verifyFfmpeg" });
      };

      websocket.onmessage = function(evt) {
        const msg = JSON.parse(evt.data);
        if (msg.event === "didReceiveGlobalSettings") {
          const incoming = (msg.payload && msg.payload.settings) || {};
          globalState = Object.assign({}, DEFAULTS, incoming);
          renderGlobalFields();
        } else if (msg.event === "sendToPropertyInspector" && msg.payload) {
          if (msg.payload.event === "ffmpegStatus") {
            const st = document.getElementById("ffmpegStatus");
            st.textContent = msg.payload.detail;
            st.className = "hint " + (msg.payload.ok ? "status-ok" : "status-err");
          } else if (msg.payload.event === "pickedPath" && msg.payload.field) {
            const input = document.getElementById(msg.payload.field);
            if (input) {
              input.value = msg.payload.path;
              persistGlobal();
            }
          }
        }
      };
    };

    document.querySelectorAll("#masterHotkey, #dynamicStepLength, #mainCapturesDir, #outputDir, #ffmpegPath, #successSoundPath, #errorSoundPath")
      .forEach((el) => el.addEventListener("input", persistGlobal));
    document.getElementById("deleteOriginal").addEventListener("change", persistGlobal);
    document.getElementById("fixedDuration").addEventListener("input", persistAction);

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
1. **Fixed Length** — Saves a clip of a specific duration (\`HH:MM:SS\` or \`MM:SS\`) set on that button.
2. **Dynamic Length** — Defaults to \`1:00\`. Updates its displayed duration automatically when you press Dynamic Increase / Decrease. Style the font, size, color, and icon directly in Stream Deck's Title bar (leave the static Title text empty so the dynamic timer displays).
3. **Dynamic Increase** — Adds your configured **Dynamic Step Length** to the Dynamic Length button.
4. **Dynamic Decrease** — Subtracts your configured **Dynamic Step Length** from the Dynamic Length button.
5. **Open Output Directory** — Opens your configured Output Directory in Explorer / Finder.
6. **Open Captures Directory** — Opens your configured Main Captures Directory in Explorer / Finder.

## Key Behaviors
- **2-Second Capture Debounce**: Rapidly pressing *Fixed Length* or *Dynamic Length* within 2 seconds ignores extra presses. *Dynamic Increase* and *Dynamic Decrease* are never debounced.
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
      description: `Stream Deck SDK v2 manifest (v${PLUGIN_VERSION}) declaring Node.js 20 runtime and all 6 ReplaySlice button actions.`,
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
