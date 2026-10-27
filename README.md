# ReplaySlice

**Multi-length Instant Replay trimming for Elgato Stream Deck — powered by FFmpeg stream copying with zero re-encoding.**

Replay recorders like **OBS Studio**, **Nvidia ShadowPlay**, and **AMD ReLive** only let you configure a single Instant Replay buffer duration. If you keep a 20-minute buffer running for safety, saving a quick 30-second highlight normally forces you to dump a massive 20-minute video file and trim it manually later.

**ReplaySlice** solves this on your Stream Deck. Press a button for the exact clip length you want (`0:30`, `3:30`, `10:00`, etc.)—ReplaySlice triggers your master replay hotkey, waits for the file to finish flushing to disk, and slices out the exact tail duration in under a second using FFmpeg stream copy (`-c copy`) with zero quality loss.

---

## How It Works

```text
[Stream Deck Key Press] ──► (Ignores duplicate presses for 2.0s)
        │
        ▼
Immediately Sends Master Replay Hotkey (OBS / ShadowPlay / ReLive)
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
| **Dynamic Increase** | Defaults to `+` text and adds a button-specific step duration (default `00:30`) to **Dynamic Length**. Hold the key down to auto-repeat, or place multiple `+` buttons with different step sizes independently. |
| **Dynamic Decrease** | Defaults to `-` text and subtracts a button-specific step duration (default `00:30`) from **Dynamic Length**, with an optional minimum floor. Hold the key down to auto-repeat, or place multiple `-` buttons independently. |
| **Reset Dynamic Length** | Sets **Dynamic Length** directly to a button-specific target duration (default `00:30`). Place multiple reset/preset buttons to jump straight to any duration. |
| **Open Output Directory** | Opens your trimmed clips folder in Windows Explorer or macOS Finder. |
| **Open Captures Directory** | Opens your raw master captures folder in Windows Explorer or macOS Finder. |

> **Tip — Styling the Dynamic Length Button:** All seven buttons use Stream Deck's native icon, font, font size, alignment, and text color controls. On **Dynamic Length**, leave the static **Title** text box empty in Stream Deck so ReplaySlice can update the live timer (`1:00` → `3:30`) using your chosen font and size.

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
| **After Saving Clip** | Global & per-key (*Fixed* / *Dynamic Length*) | Global **Open clip automatically after saving** toggle at the top of Global Plugin Settings, plus a per-button override (*Follow Global Setting*, *Always open*, or *Never open*) so you can mix silent-save and instant-review buttons. |
| **Step Length** | *Dynamic Increase* & *Decrease* keys | Amount added or subtracted per press (`HH:MM:SS`, `MM:SS`, or seconds — default `00:30`). Configured independently on each `+` and `-` button, with an optional **Minimum Floor** on *Dynamic Decrease*. |
| **Reset Target Length** | *Reset Dynamic Length* key | Duration that *Dynamic Length* jumps to when pressed (default `00:30`). Configured independently per button so you can create multiple preset keys. |
| **Custom Text Size & Key Background** | Per-key (Collapsible) | **Font Size Boost** (`0` default, `+1`, `+2`, … past Stream Deck's `16`/`18pt` cap using Stream Deck's selected font, style, color & alignment) paired in the same menu with an optional **Key Background Image (`.png` / `.jpg`)** picker so custom PNG backgrounds work behind giant dynamic timers. |
| **Delete Original Capture** | Global | Enabled by default at the top of Global Plugin Settings. Deletes the full-length master capture only after verifying the trimmed output clip exists and is non-empty on disk. |
| **Master Replay Hotkey** | Global | Shortcut sent to trigger your recorder's Instant Replay save (e.g. `Alt+F10` for ShadowPlay, or your OBS Replay Buffer hotkey). Includes a one-click **Record** button. |
| **Directories & FFmpeg Path** | Global (Collapsible) | **Main Captures Directory** (watched recursively), **Output Directory**, and optional **FFmpeg Path** with one-click **Verify** button. Open by default and remembers collapse state. |
| **Sound Confirmations** | Global (Collapsible) | Optional **Success Sound** and **Failure Sound** (`.wav` or `.mp3`) with **Test** buttons. Open by default and remembers collapse state. |
| **Key Delay / Repeat** | Global (Collapsible) | Configures **Hold Delay Before Repeat** (default `0.5s`) and **Repeat Rate** (default `5` times/sec) when holding *Dynamic Increase* or *Dynamic Decrease*. Remembers collapse state. |
| **Diagnostics** | Global (Collapsible) | Optional **Enable debug log file** toggle (off by default, closed by default, remembers collapse state). |

---

## Smart Edge-Case Handling

- **Aligned Audio & Video Without Re-Encoding:** Waits until OBS/ShadowPlay releases its OS write handle so trailing audio/video packets are completely flushed, inspects stream durations and preceding keyframes via `ffprobe`, and trims using `-map 0:v -map 0:a? -c copy -avoid_negative_ts make_zero -shortest` (preserving multi-track audio).
- **Short-Buffer Safe:** If your replay buffer max is 20 minutes and only 7 minutes have elapsed, ReplaySlice reads the actual `7:00` file duration rather than assuming `20:00`. If you request a clip longer than the elapsed buffer, it cleanly saves the full available buffer from `0:00`.
- **Instant Trigger + 2-Second Cooldown:** Pressing *Fixed Length* or *Dynamic Length* fires the capture immediately and ignores accidental double-taps for the next 2 seconds. *Dynamic Increase*, *Dynamic Decrease*, and *Reset Dynamic Length* are never debounced so you can adjust durations rapidly.
- **Scaled Fail Timer:** Starts at a **10-second** minimum and automatically adds **2 seconds for every 5 minutes** of requested capture length (e.g., `10:30` → `14s`, `01:00:00` → `34s`) so large master buffers have enough time to flush to disk.

---

## Development & Web Packager

This repository also includes an interactive web configurator, Stream Deck emulator, and client-side `.streamDeckPlugin` bundler built with React, TypeScript, and Vite:

```bash
npm install
npm run dev
```

Open `http://localhost:3000` to pre-configure defaults, test timecode/buffer calculations in the emulator, or export fresh `.streamDeckPlugin` and `.zip` installer bundles.
