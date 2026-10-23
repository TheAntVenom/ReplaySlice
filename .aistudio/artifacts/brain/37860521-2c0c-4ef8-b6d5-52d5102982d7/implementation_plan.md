# ReplaySlice — Stream Deck Multi-Length Instant Replay Plugin & Studio

ReplaySlice transforms your legacy OBS Python script into a universal, cross-app **Elgato Stream Deck plugin** (compatible with OBS, Nvidia ShadowPlay, AMD ReLive, or any replay recorder) paired with an interactive **Plugin Workbench & One-Click Installer Exporter** here in the browser. It triggers your master instant replay hotkey, waits for the file to completely finish flushing to disk, and uses lossless FFmpeg stream-copying with exact audio/video track alignment—eliminating the 1.5-second tail cutoff while keeping every clip in sync.

### User Review & Critical Decisions

> [!IMPORTANT]
> Please review the technical solution for your **audio/video length alignment (zero tail offset)** request below, along with the sensible defaults chosen for cross-platform support and short-buffer handling. Click **Proceed** if everything looks good, or let me know if you want any adjustments before I build it.

- **Confirmed Decision — Zero Tail Cutoff & Exact Audio/Video Duration Alignment**: We are removing the `1.5s` `TAIL_OFFSET` completely. Analyzing your old script revealed **two root causes** for the audio/video length mismatch:
  1. *Premature File Read*: The old script began trimming the moment the file appeared on disk, while OBS was still flushing separate audio and video muxer buffers at the end of the file. ReplaySlice waits until file size stabilizes **and** the OS write-lock handle is fully released by OBS/ShadowPlay before touching the file.
  2. *Unaligned Keyframe Seeking with `-c copy`*: Running `ffmpeg -ss <time> -i <file> -t <dur> -c copy` forces video to snap backward to an earlier keyframe (often 1–2 seconds earlier) while audio cuts at the exact timestamp, leaving video and audio tracks with different lengths or shifted start timestamps. ReplaySlice inspects per-stream durations via `ffprobe`, locates the exact preceding keyframe boundary, and trims using `-avoid_negative_ts make_zero -shortest` alongside `-c copy` so audio and video start at `0.00s` together and end at the exact same aligned timestamp without re-encoding.
- **Default — Short Buffer & Elapsed Time Math**: If your replay buffer is set to 20 minutes cleanly in OBS/ShadowPlay, and only 7 minutes have elapsed, ReplaySlice probes the actual duration of the saved master file (`7:00`) rather than assuming `20:00`, slicing `6:30–7:00` for a 30-second clip. If you request a clip *longer* than the recorded master buffer (e.g., requesting `3:30` when only `1:45` exists), ReplaySlice safely clamps start time to `0:00`, saves the full `1:45` clip, and plays your success sound (with an optional setting in the Property Inspector if you ever prefer playing the warning/failure sound on clamped clips).
- **Default — Recursive Captures Folder Watching (ShadowPlay + OBS Ready)**: Because Nvidia ShadowPlay automatically saves clips inside per-game subfolders (whereas OBS saves directly in the root captures folder), the directory watcher monitors both your Main Captures folder and its subfolders automatically.
- **Default — Zero-Dependency Stream Deck Runtime (Windows + macOS)**: Because AI Studio runs in your browser while Stream Deck plugins run locally inside the Elgato desktop app, this web app will both **simulate your Stream Deck live** and **export a ready-to-install Stream Deck plugin package** with one-click Windows and macOS installer scripts that run directly on Stream Deck's built-in Node.js runtime (no separate Python or Node installation required on your PC).

---

### 1. Overview & Core Concept

- **What It Does**: Delivers a complete Elgato Stream Deck plugin featuring all five requested custom actions—**Fixed Length**, **Dynamic Length**, **Dynamic Increase**, **Dynamic Decrease**, and **Open Captures Directory**—plus a browser-based **ReplaySlice Studio** where you can interactively test button behavior, verify buffer/trim timecode math, pre-fill your folder paths and hotkeys, inspect the plugin code, and download the ready-to-install Stream Deck plugin bundle.
- **Target Audience / Persona**: Creators, streamers, and gameplay editors who record long safety replay buffers (e.g., 10–20 minutes in OBS or ShadowPlay) and want instant, zero-quality-loss clips of exact lengths (`30s` highlight vs. `3:30` full round) at the press of a physical Stream Deck key.
- **Key Value**: Decouples multi-length replay trimming from OBS's internal Python scripting engine so it works universally with **any** capture software, preserves 100% original video/audio quality at gigabyte-per-second disk speeds (`-c copy`), keeps audio and video track durations aligned right up to the end of the capture, and lets you dial custom clip lengths on the fly directly on your Stream Deck hardware.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Interactive Stream Deck Hardware Simulation**: On launch, users see a physical 15-key (5×3) Stream Deck unit next to an authentic Stream Deck Action Palette and Property Inspector sidebar. Clicking `Dynamic Increase` or `Dynamic Decrease` immediately updates the live timer rendered on the `Dynamic Length` key face (defaulting to `1:00`, stepping cleanly to `1:30`, `2:00`, `3:30`, etc.). Clicking `Fixed Length` or `Dynamic Length` runs a visual step-by-step capture trace: *2s Debounce Check → Master Hotkey Sent → Write-Lock & Flush Verification → FFmpeg Keyframe-Aligned Stream Copy → Original Cleanup → Audio Cue Playback*.
  2. **Buffer Edge-Case & FFmpeg Alignment Lab**: Users can drag a "Master Buffer Elapsed Duration" slider (e.g., simulating `7:00` elapsed in a `20:00` max buffer, or `0:45` elapsed when requesting `3:30`) and test rapid double-presses within 2 seconds to verify debounce blocking, timecode clamping, and the exact generated `ffprobe` / `ffmpeg` command flags.
  3. **Plugin Configuration & One-Click Export**: Users configure their global plugin defaults (Master Replay Hotkey recorder, Main Captures Directory, Output Directory, Delete Original Capture toggle, Dynamic Step Length in seconds, optional FFmpeg binary path with PATH auto-detection, and Success / Failure `.wav` file paths) and click **Download Stream Deck Plugin** to export the complete `.sdPlugin` bundle with automated Windows and macOS installers.
  4. **Code & Migration Inspector**: Users can inspect every generated Stream Deck plugin module alongside a clear breakdown of what changed from the attached `AdditionalReplays_5_2.py` script.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Tactile broadcast-hardware studio console—clean, utilitarian, high-contrast dark surfaces inspired by physical Elgato control surfaces and professional NLE editing suites, adhering strictly to single-elevation depth and zero-pill metadata discipline.
  - *Color Palette & Mood*:
    - `--background`: Deep studio slate (`#0B0F17`) for the primary 60% workspace canvas.
    - `--surface`: Elevated anodized graphite (`#131924`) with crisp `1px` hairline borders (`#1F2937`) for the 30% structural panels—no nested card-in-card clutter or thick left borders.
    - `--primary` / `--accent`: Broadcast cobalt (`#3B82F6`) concentrated strictly on primary actions and active hardware selection (10% accent budget), paired with semantic status indicators always accompanied by explicit text labels: emerald (`#16A34A`) for completed captures, amber (`#D97706`) for 2-second debounce blocks or clamped short buffers, and crimson (`#DC2626`) for FFmpeg/file exceptions.
  - *Typography & Hierarchy*:
    - **Display & Navigation**: `Outfit` (SemiBold 600) with balanced headline wrapping for crisp studio headers and Stream Deck key legends.
    - **Body & Controls**: `Plus Jakarta Sans` (Regular 400 / Medium 500) for clean readability across Property Inspector forms and installation steps.
    - **Timecodes, Metrics & Commands**: `JetBrains Mono` with strict `tabular-nums` so `1:00 → 3:30` button readouts, millisecond debounce timers, and `06:30.00 → 07:00.00` trim ranges never jitter horizontally.
  - *Component Styling & Layout*: Full-width `1440px` desktop studio layout obeying the strict 3-zone Top Bar Contract (`ReplaySlice` wordmark on the left, concise single-line section navigation links in the center, and one primary `Download Plugin (.zip)` CTA button on the right). Below the header, an interactive two-column hardware + inspector workbench sits above a clean execution log table and installation walkthrough.

- **Interactive Feedback & Motion**:
  - Physical tactile depression (`transform: scale(0.96)`, `120ms` cubic-bezier) on Stream Deck keys when clicked, accompanied by realistic Web Audio synthesized (or custom-loaded `.wav`) success and error audio cues.
  - Instantaneous (`<50ms`) live canvas/SVG re-rendering on the `Dynamic Length` key face whenever `Dynamic Increase` or `Dynamic Decrease` is triggered.
  - Clear visual debounce toast/state indicator when capture buttons are pressed repeatedly within the 2.0-second lockout window.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Two-Stage Lossless FFmpeg Trimming (`ffprobe` Stream End + Keyframe Alignment + `-avoid_negative_ts make_zero -shortest`)**
  - *Chosen Approach*: Keep pure stream-copying (`-c copy`, zero re-encoding) for instant sub-second speed and original bitrate fidelity, enhanced with:
    1. OS write-handle release polling so the master capture's trailing audio/video packets are 100% muxed before reading (`0.0s` tail loss).
    2. `ffprobe` inspection of both video and audio stream durations ($T_{\text{end}} = \min(D_{\text{video}}, D_{\text{audio}})$) so any tiny muxer overhang in the master recording itself is normalized.
    3. Snapping the cut start time to the nearest keyframe boundary and passing `-map 0 -c copy -avoid_negative_ts make_zero -shortest` so all video and multi-track audio streams start cleanly at `0.00s` and terminate at the exact same duration.
  - *Why*: Directly solves the audio/video duration mismatch that previously forced you to chop 1.5 seconds off the end, while preserving OBS/ShadowPlay multi-track audio (`-map 0`) and avoiding slow CPU/GPU re-encoding.
  - *Alternatives Considered*: Full audio/video re-encoding (`libx264`/`aac`), which was rejected because you explicitly require lossless stream-copying without quality loss or encoding lag during gameplay.

- **Decision 2: Standalone Zero-Dependency Node.js Stream Deck Plugin Architecture**
  - *Chosen Approach*: Target Elgato Stream Deck SDK v2 (Node.js 20 runtime built natively into the Stream Deck desktop app) using zero external npm binary dependencies—handling local Stream Deck WebSocket communication, recursive `fs` file watching, FFmpeg `child_process` execution, OS hotkey injection (Windows `.NET/SendInput` via PowerShell & macOS `osascript`), and asynchronous `.wav` playback natively.
  - *Why*: You can download the exported ZIP from this app, double-click the included install script, and immediately use all 5 buttons in Stream Deck without compiling C++ addons or installing Python/MoviePy like the old OBS script required.
  - *Alternatives Considered*: Requiring a local `npm install && npm run build` toolchain with native C++ keyboard libraries (`robotjs`), which frequently breaks across Node versions on Windows.

- **Decision 3: Shared Global State for Dynamic Length Across Stream Deck Profiles/Pages**
  - *Chosen Approach*: Store the current `dynamicLengthSeconds` (default `60s`, displayed as `1:00`) in the Stream Deck plugin's global runtime state and broadcast title/image updates to every visible `Dynamic Length` button instance whenever `Dynamic Increase` or `Dynamic Decrease` is pressed.
  - *Why*: Even if you place `Dynamic Length` on multiple Stream Deck pages or folders, pressing `Dynamic Increase` or `Dynamic Decrease` keeps every `Dynamic Length` display synchronized in real time.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                     REPLAYSLICE WEB STUDIO (Browser UI)                      │
├──────────────────────────────────────┬───────────────────────────────────────┤
│   Interactive Stream Deck Simulator  │    Property Inspector & Configurator  │
│  ┌────────┐ ┌────────┐ ┌────────┐    │  • Master Hotkey Recorder (e.g. Alt+F10)│
│  │ Fixed  │ │Dynamic │ │Dynamic │    │  • Main Captures & Output Directories │
│  │ Length │ │  3:30  │ │  + Step│    │  • Delete Original Capture Checkbox   │
│  └────────┘ └────────┘ └────────┘    │  • Dynamic Step Length (sec)          │
│  ┌────────┐ ┌────────┐               │  • Optional FFmpeg Path + Auto-Check  │
│  │Dynamic │ │  Open  │               │  • Success & Error Sound (.wav) Paths │
│  │ - Step │ │ Folder │               │  • Per-Button Fixed Length (sec)      │
│  └────────┘ └────────┘               └───────────────────┬───────────────────┘
└──────────────────┬───────────────────────────────────────┼───────────────────┘
                   │ Live State & Trim Math Engine         │ Pre-baked Defaults
                   ▼                                       ▼
┌──────────────────────────────────────┐ ┌─────────────────────────────────────┐
│   Buffer & FFmpeg Pipeline Verifier  │ │  Client-Side .sdPlugin ZIP Builder  │
│  • 2.0s Capture-Only Debounce Guard  │ │  • Manifest (5 Stream Deck Actions) │
│  • Elapsed Buffer vs Request Math    │ │  • Standalone Node 20 Plugin Engine │
│  • Exact ffprobe + ffmpeg Command    │ │  • Stream Deck Property Inspector UI│
│  • Web Audio Success / Failure Cues  │ │  • 1-Click Win (.bat) & Mac Install │
└──────────────────────────────────────┘ └─────────────────┬───────────────────┘
                                                           │ Installed Locally
                                                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│              LOCAL ELGATO STREAM DECK RUNTIME (Windows / macOS)              │
│                                                                              │
│  [Stream Deck Press] ──► [2s Debounce Guard] ──► [OS Hotkey Injector]        │
│                                                          │                   │
│                                             OBS / ShadowPlay Writes Clip     │
│                                                          ▼                   │
│  [Play Success/Fail .wav] ◄── [Optional Delete] ◄── [Lossless FFmpeg Trim]   │
│                                                          ▲                   │
│                                        [Recursive Watcher + Write-Lock Poll] │
│                                        [ffprobe Stream End & Keyframe Calc]  │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Global Plugin Settings**:
    - `masterHotkey`: Key combination string (e.g., `Alt+F10`, `Ctrl+Shift+R`) injected to trigger OBS/ShadowPlay.
    - `mainCapturesDir`: Source directory watched recursively for new master replay files.
    - `outputDir`: Target directory where trimmed clips (`<OriginalName>_<Duration>.<ext>`) are written.
    - `deleteOriginal`: Boolean flag controlling whether the master file is deleted after verifying the trimmed output file exists and is non-empty.
    - `dynamicStepSeconds`: Integer step size (default `30`) added/subtracted by `Dynamic Increase` / `Dynamic Decrease`.
    - `dynamicCurrentSeconds`: Shared runtime duration for `Dynamic Length` buttons (initialized to `60` seconds / `1:00`, minimum clamped to `5` seconds).
    - `ffmpegPath`: Optional explicit path to `ffmpeg`; falls back to system `PATH` auto-discovery and throws an immediate error + failure sound if missing.
    - `successSoundPath` & `errorSoundPath`: File paths to `.wav`/audio cues played asynchronously on completion or exception.
  - **Per-Button Action Settings**:
    - `Fixed Length`: Stores `fixedDurationSeconds` (e.g., `30`, `60`, `180`) independently per button instance so you can place as many fixed-duration buttons on your Stream Deck as you want.
    - `Dynamic Length`, `Dynamic Increase`, `Dynamic Decrease`, `Open Captures Directory`: Require zero extra per-button setup (all share the global settings seamlessly, while allowing custom Stream Deck titles/icons on the 4 visually default buttons).

- **Interactive Component & State Mapping**:
  - **Capture Trigger (`Fixed Length` & `Dynamic Length`)**: Checks `now - lastCaptureTimestamp < 2000ms` or `isCapturing === true`. If within 2 seconds, ignores the press and surfaces a non-intrusive debounce notice. Otherwise locks capture state, dispatches the master hotkey, polls for a completely flushed master file, runs `ffprobe` duration/keyframe math, executes lossless `ffmpeg` stream copy, optionally removes the master clip, and triggers the success sound (or catches any timeout/missing-FFmpeg/IO failure and plays the failure sound).
  - **Dynamic Duration Controls (`Dynamic Increase` & `Dynamic Decrease`)**: Bypass the 2-second capture debounce so rapid presses immediately mutate `dynamicCurrentSeconds` (`current ± dynamicStepSeconds`, clamped `>= 5s`) and push live `M:SS` formatted labels (`1:00`, `2:30`, `3:30`) to the `Dynamic Length` button face.
  - **Directory Launcher (`Open Captures Directory`)**: Opens the configured `outputDir` (falling back to `mainCapturesDir`) in the OS file manager (`explorer` on Windows, `open` on macOS), or previews the simulated output clip list inside the browser studio.
  - **ZIP Bundle Generator**: Packages all configured defaults, custom action icons (rendered cleanly on HTML5 Canvas as crisp `72×72` and `144×144` PNGs required by Elgato's manifest spec), Property Inspector HTML panels, standalone plugin code, and one-click installer scripts into a downloadable archive.
