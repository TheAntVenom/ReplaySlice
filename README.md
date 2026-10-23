# ReplaySlice

**Multi-length Instant Replay trimming for Elgato Stream Deck — powered by FFmpeg stream copying with zero re-encoding.**

Replay recorders like **OBS Studio**, **Nvidia ShadowPlay**, and **AMD ReLive** only let you configure a single Instant Replay buffer duration. If you keep a 20-minute buffer running for safety, saving a quick 30-second highlight normally forces you to dump a massive 20-minute video file and trim it manually later.

**ReplaySlice** solves this on your Stream Deck. Press a button for the exact clip length you want (`0:30`, `3:30`, `10:00`, etc.)—ReplaySlice triggers your master replay hotkey, waits for the file to finish flushing to disk, and slices out the exact tail duration in under a second using FFmpeg stream copy (`-c copy`) with zero quality loss.

---

## How It Works

```text
[Stream Deck Key Press]
        │
        ▼
[2.0s Capture Debounce] ──► Sends Master Replay Hotkey (OBS / ShadowPlay / ReLive)
                                    │
                                    ▼
                    Waits for Master File + OS Write-Lock Release
                                    │
                                    ▼
                 Probes Real Elapsed Duration & Keyframes (ffprobe)
                                    │
                                    ▼
             Slices Clip via FFmpeg (-c copy, Zero Re-Encoding, A/V Aligned)
                                    │
                                    ▼
         Verifies Output Clip on Disk ──► Deletes Master (Optional) & Plays Sound
```

---

## Included Stream Deck Actions

Once installed, find **ReplaySlice** in the right-hand Actions sidebar of the Elgato Stream Deck app:

| Action | Description |
| :--- | :--- |
| **Fixed Length** | Captures and trims an instant replay to a fixed duration (`HH:MM:SS` or `MM:SS`) configured on that specific button. Drop as many Fixed Length keys onto your deck as you want. |
| **Dynamic Length** | Defaults to `1:00`. Displays a live duration directly on the key face and captures that exact length when pressed. |
| **Dynamic Increase** | Adds your configured **Dynamic Step Length** to the **Dynamic Length** button. |
| **Dynamic Decrease** | Subtracts your configured **Dynamic Step Length** from the **Dynamic Length** button. |
| **Open Output Directory** | Opens your trimmed clips folder in Windows Explorer or macOS Finder. |
| **Open Captures Directory** | Opens your raw master captures folder in Windows Explorer or macOS Finder. |

> **Tip — Styling the Dynamic Length Button:** All six buttons use Stream Deck's native icon, font, font size, alignment, and text color controls. On **Dynamic Length**, leave the static **Title** text box empty in Stream Deck so ReplaySlice can update the live timer (`1:00` → `3:30`) using your chosen font and size.

---

## Requirements

1. **Elgato Stream Deck Software `6.5` or newer** (uses Stream Deck's built-in Node.js 20 runtime — no separate Node or Python install needed).
2. **Windows 10 / 11** or **macOS 12+**.
3. **FFmpeg** installed in your system `PATH` (or linked manually in ReplaySlice's plugin settings):
   - **Windows (winget):** `winget install Gyan.FFmpeg` *(restart Stream Deck after installing so it picks up the updated `PATH`)*
   - **macOS (Homebrew):** `brew install ffmpeg`

---

## Installation

1. Download **`com.antvenom.replayslice.streamDeckPlugin`** from the [**Releases**](../../releases) page.
2. Double-click the `.streamDeckPlugin` file and click **Install** when prompted by Elgato Stream Deck.
3. Drag any **ReplaySlice** action onto your Stream Deck and configure your settings in the Property Inspector panel.

---

## Plugin Settings Reference

| Setting | Scope | Description |
| :--- | :--- | :--- |
| **Fixed Replay Length** | *Fixed Length* key | Duration to keep (`HH:MM:SS`, `MM:SS`, or seconds — e.g. `00:30` or `05:00`). |
| **Master Replay Hotkey** | Global | Shortcut sent to trigger your recorder's Instant Replay save (e.g. `Alt+F10` for ShadowPlay, or your OBS Replay Buffer hotkey). Includes a one-click **Record** button. |
| **Dynamic Step Length** | Global | Amount added or subtracted per press of *Dynamic Increase* / *Dynamic Decrease* (default `00:30`). |
| **Main Captures Directory** | Global | Folder where OBS or ShadowPlay writes master replay files. Automatically scans subfolders (supporting ShadowPlay's per-game folders). |
| **Output Directory** | Global | Destination folder where trimmed clips (`<OriginalName>_<Duration>.<ext>`) are saved. |
| **Delete Original Capture** | Global | Enabled by default. Deletes the full-length master capture only after verifying the trimmed output clip exists and is non-empty on disk. |
| **FFmpeg Path (Optional)** | Global | Custom path to `ffmpeg` if it isn't installed in your system `PATH`. Includes a **Verify** button to confirm detection. |
| **Success Sound** | Global | Optional `.wav` or `.mp3` played once the trimmed clip is verified on disk. |
| **Failure Sound** | Global | Optional `.wav` or `.mp3` played if FFmpeg is missing or no output clip is written before the fail timer expires. |

---

## Smart Edge-Case Handling

- **Aligned Audio & Video Without Re-Encoding:** Waits until OBS/ShadowPlay releases its OS write handle so trailing audio/video packets are completely flushed, inspects stream durations and preceding keyframes via `ffprobe`, and trims using `-map 0:v -map 0:a? -c copy -avoid_negative_ts make_zero -shortest` (preserving multi-track audio).
- **Short-Buffer Safe:** If your replay buffer max is 20 minutes and only 7 minutes have elapsed, ReplaySlice reads the actual `7:00` file duration rather than assuming `20:00`. If you request a clip longer than the elapsed buffer, it cleanly saves the full available buffer from `0:00`.
- **2-Second Capture Debounce:** Accidental double-taps on *Fixed Length* or *Dynamic Length* within 2 seconds are ignored. *Dynamic Increase* and *Dynamic Decrease* are never debounced so you can tap rapidly to dial a target time.
- **Scaled Fail Timer:** Starts at a **10-second** minimum and automatically adds **2 seconds for every 5 minutes** of requested capture length (e.g., `10:30` → `14s`, `01:00:00` → `34s`) so large master buffers have enough time to flush to disk.

---

## Development & Web Packager

This repository also includes an interactive web configurator, Stream Deck emulator, and client-side `.streamDeckPlugin` bundler built with React, TypeScript, and Vite:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to pre-configure defaults, test timecode/buffer calculations in the emulator, or export fresh `.streamDeckPlugin` and `.zip` installer bundles.
