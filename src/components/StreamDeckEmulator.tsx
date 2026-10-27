import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight, FolderOpen, RotateCcw, Trash2, XCircle } from 'lucide-react';
import {
  CaptureLogEntry,
  DeckKeySlot,
  GlobalPluginSettings,
  OpenAfterSaveMode,
  StreamDeckActionType,
} from '../types/plugin';
import {
  calculateFailTimeoutSeconds,
  computeReplayTrimPlan,
  formatDynamicButtonTitle,
  formatPreciseTimestamp,
  parseTimecodeToSeconds,
} from '../utils/timecode';
import { playEmulatorCue } from '../utils/soundCue';

interface StreamDeckEmulatorProps {
  settings: GlobalPluginSettings;
  customSuccessAudioUrl: string | null;
  customErrorAudioUrl: string | null;
}

const ACTION_CATALOG: Array<{
  type: StreamDeckActionType;
  name: string;
  defaultTitle: string;
  summary: string;
}> = [
  {
    type: StreamDeckActionType.FIXED_LENGTH,
    name: 'Fixed Length',
    defaultTitle: 'Last 30s',
    summary: 'Saves a fixed replay duration configured on this button.',
  },
  {
    type: StreamDeckActionType.DYNAMIC_LENGTH,
    name: 'Dynamic Length',
    defaultTitle: '',
    summary: 'Defaults to 1:00 and updates its button text live via Dynamic Increase / Decrease.',
  },
  {
    type: StreamDeckActionType.DYNAMIC_INCREASE,
    name: 'Dynamic Increase',
    defaultTitle: '+',
    summary: 'Defaults to "+" text. Adds a button-specific step duration (default 00:30) and auto-repeats while held.',
  },
  {
    type: StreamDeckActionType.DYNAMIC_DECREASE,
    name: 'Dynamic Decrease',
    defaultTitle: '-',
    summary: 'Defaults to "-" text. Subtracts a button-specific step duration (default 00:30) and auto-repeats while held.',
  },
  {
    type: StreamDeckActionType.RESET_DYNAMIC_LENGTH,
    name: 'Reset Dynamic Length',
    defaultTitle: 'Reset 0:30',
    summary: 'Sets Dynamic Length directly to a button-specific target duration (default 00:30).',
  },
  {
    type: StreamDeckActionType.OPEN_OUTPUT_DIRECTORY,
    name: 'Open Output Directory',
    defaultTitle: 'Open Output',
    summary: 'Opens Output Directory where trimmed clips are saved.',
  },
  {
    type: StreamDeckActionType.OPEN_CAPTURES_DIRECTORY,
    name: 'Open Captures Directory',
    defaultTitle: 'Open Captures',
    summary: 'Opens Main Captures Directory where master replays are saved.',
  },
];

function createInitialDeckSlots(): DeckKeySlot[] {
  const slots: DeckKeySlot[] = Array.from({ length: 15 }, (_, idx) => ({
    slotIndex: idx,
    actionType: null,
    userTitle: '',
    titleFontSize: 15,
    titleAlignment: 'middle',
    titleColor: '#F8FAFC',
    fixedDurationInput: '00:30',
    stepDurationInput: '00:30',
    minFloorInput: '',
    resetDurationInput: '00:30',
    openAfterSaveMode: 'global',
    fontSizeBoost: 0,
    bgImagePath: '',
    bgImagePreviewUrl: null,
    customBoostText: '',
  }));

  slots[0] = {
    slotIndex: 0,
    actionType: StreamDeckActionType.FIXED_LENGTH,
    userTitle: 'Clip 30s',
    titleFontSize: 13,
    titleAlignment: 'middle',
    titleColor: '#F8FAFC',
    fixedDurationInput: '00:30',
    stepDurationInput: '00:30',
    minFloorInput: '',
    resetDurationInput: '00:30',
    openAfterSaveMode: 'global',
    fontSizeBoost: 0,
    bgImagePath: '',
    bgImagePreviewUrl: null,
    customBoostText: '',
  };
  slots[1] = {
    slotIndex: 1,
    actionType: StreamDeckActionType.FIXED_LENGTH,
    userTitle: 'VOD 30s',
    titleFontSize: 13,
    titleAlignment: 'middle',
    titleColor: '#F8FAFC',
    fixedDurationInput: '00:30',
    stepDurationInput: '00:30',
    minFloorInput: '',
    resetDurationInput: '00:30',
    openAfterSaveMode: 'open',
    fontSizeBoost: 0,
    bgImagePath: '',
    bgImagePreviewUrl: null,
    customBoostText: '',
  };
  slots[2] = {
    slotIndex: 2,
    actionType: StreamDeckActionType.DYNAMIC_LENGTH,
    userTitle: '',
    titleFontSize: 16,
    titleAlignment: 'middle',
    titleColor: '#FFFFFF',
    fixedDurationInput: '01:00',
    stepDurationInput: '00:30',
    minFloorInput: '',
    resetDurationInput: '00:30',
    openAfterSaveMode: 'global',
    fontSizeBoost: 8,
    bgImagePath: '',
    bgImagePreviewUrl: null,
    customBoostText: '',
  };
  slots[3] = {
    slotIndex: 3,
    actionType: StreamDeckActionType.DYNAMIC_INCREASE,
    userTitle: '',
    titleFontSize: 16,
    titleAlignment: 'middle',
    titleColor: '#E2E8F0',
    fixedDurationInput: '00:30',
    stepDurationInput: '00:30',
    minFloorInput: '',
    resetDurationInput: '00:30',
    openAfterSaveMode: 'global',
    fontSizeBoost: 12,
    bgImagePath: '',
    bgImagePreviewUrl: null,
    customBoostText: '',
  };
  slots[4] = {
    slotIndex: 4,
    actionType: StreamDeckActionType.DYNAMIC_DECREASE,
    userTitle: '',
    titleFontSize: 16,
    titleAlignment: 'middle',
    titleColor: '#E2E8F0',
    fixedDurationInput: '00:30',
    stepDurationInput: '00:30',
    minFloorInput: '',
    resetDurationInput: '00:30',
    openAfterSaveMode: 'global',
    fontSizeBoost: 12,
    bgImagePath: '',
    bgImagePreviewUrl: null,
    customBoostText: '',
  };
  slots[5] = {
    slotIndex: 5,
    actionType: StreamDeckActionType.RESET_DYNAMIC_LENGTH,
    userTitle: 'Reset 0:30',
    titleFontSize: 12,
    titleAlignment: 'middle',
    titleColor: '#E2E8F0',
    fixedDurationInput: '00:30',
    stepDurationInput: '00:30',
    minFloorInput: '',
    resetDurationInput: '00:30',
    openAfterSaveMode: 'global',
    fontSizeBoost: 0,
    bgImagePath: '',
    bgImagePreviewUrl: null,
    customBoostText: '',
  };
  slots[6] = {
    slotIndex: 6,
    actionType: StreamDeckActionType.OPEN_OUTPUT_DIRECTORY,
    userTitle: 'Open Output',
    titleFontSize: 12,
    titleAlignment: 'middle',
    titleColor: '#CBD5E1',
    fixedDurationInput: '00:30',
    stepDurationInput: '00:30',
    minFloorInput: '',
    resetDurationInput: '00:30',
    openAfterSaveMode: 'global',
    fontSizeBoost: 0,
    bgImagePath: '',
    bgImagePreviewUrl: null,
    customBoostText: '',
  };
  slots[7] = {
    slotIndex: 7,
    actionType: StreamDeckActionType.OPEN_CAPTURES_DIRECTORY,
    userTitle: 'Open Captures',
    titleFontSize: 12,
    titleAlignment: 'middle',
    titleColor: '#CBD5E1',
    fixedDurationInput: '00:30',
    stepDurationInput: '00:30',
    minFloorInput: '',
    resetDurationInput: '00:30',
    openAfterSaveMode: 'global',
    fontSizeBoost: 0,
    bgImagePath: '',
    bgImagePreviewUrl: null,
    customBoostText: '',
  };

  return slots;
}

export function StreamDeckEmulator({
  settings,
  customSuccessAudioUrl,
  customErrorAudioUrl,
}: StreamDeckEmulatorProps) {
  const [slots, setSlots] = useState<DeckKeySlot[]>(createInitialDeckSlots);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number>(2);
  const [dynamicSeconds, setDynamicSeconds] = useState<number>(60);
  const [pressedSlotIdx, setPressedSlotIdx] = useState<number | null>(null);
  const [slotBadgeFeedback, setSlotBadgeFeedback] = useState<Record<number, 'ok' | 'alert'>>({});
  const [appearanceMenuOpen, setAppearanceMenuOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('replayslice_emu_appearance_open') === '1';
    } catch {
      return false;
    }
  });

  const [simulatedElapsedInput, setSimulatedElapsedInput] = useState<string>('07:00');
  const [simulateDiskTimeoutFailure, setSimulateDiskTimeoutFailure] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    tone: 'idle' | 'working' | 'success' | 'debounced' | 'error';
    message: string;
  }>({
    tone: 'idle',
    message: 'Press any populated Stream Deck key to test live button behavior, 2s capture debounce, and timecode math.',
  });

  const [logs, setLogs] = useState<CaptureLogEntry[]>([]);
  const lastCaptureEpochRef = useRef<number>(0);
  const captureRunningRef = useRef<boolean>(false);
  const [debounceRemainingMs, setDebounceRemainingMs] = useState<number>(0);

  const holdDelayTimerRef = useRef<number | null>(null);
  const holdRepeatTimerRef = useRef<number | null>(null);

  const clearHoldTimers = () => {
    if (holdDelayTimerRef.current !== null) {
      window.clearTimeout(holdDelayTimerRef.current);
      holdDelayTimerRef.current = null;
    }
    if (holdRepeatTimerRef.current !== null) {
      window.clearInterval(holdRepeatTimerRef.current);
      holdRepeatTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearHoldTimers();
  }, []);

  useEffect(() => {
    if (debounceRemainingMs <= 0) return;
    const timer = window.setInterval(() => {
      const rem = Math.max(0, 2000 - (Date.now() - lastCaptureEpochRef.current));
      setDebounceRemainingMs(rem);
    }, 80);
    return () => window.clearInterval(timer);
  }, [debounceRemainingMs]);

  const selectedSlot = slots[selectedSlotIdx];
  const actualElapsedSeconds = Math.max(1, parseTimecodeToSeconds(simulatedElapsedInput, 420));

  // Derive the active button's capture duration and its corresponding Fail Timer
  const inspectedCaptureSeconds =
    selectedSlot.actionType === StreamDeckActionType.FIXED_LENGTH
      ? Math.max(1, parseTimecodeToSeconds(selectedSlot.fixedDurationInput, 30))
      : dynamicSeconds;
  const inspectedFailTimeoutSeconds = calculateFailTimeoutSeconds(inspectedCaptureSeconds);

  const hasSuccessSoundConfigured = Boolean(customSuccessAudioUrl || settings.successSoundPath.trim());
  const hasErrorSoundConfigured = Boolean(customErrorAudioUrl || settings.errorSoundPath.trim());

  const flashSlotBadge = (slotIndex: number, kind: 'ok' | 'alert') => {
    setSlotBadgeFeedback((prev) => ({ ...prev, [slotIndex]: kind }));
    window.setTimeout(() => {
      setSlotBadgeFeedback((prev) => {
        const copy = { ...prev };
        delete copy[slotIndex];
        return copy;
      });
    }, 1400);
  };

  const executeSimulatedCapture = (slot: DeckKeySlot, requestedSec: number, triggerLabel: string) => {
    const now = Date.now();
    const sinceLast = now - lastCaptureEpochRef.current;
    const captureFailTimeoutSeconds = calculateFailTimeoutSeconds(requestedSec);

    if (sinceLast < 2000 || captureRunningRef.current) {
      const waitSec = ((2000 - Math.min(2000, sinceLast)) / 1000).toFixed(2);
      const debouncedEntry: CaptureLogEntry = {
        id: `${now}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        triggerLabel,
        status: 'debounced',
        requestedSeconds: requestedSec,
        masterElapsedSeconds: actualElapsedSeconds,
        trimStartSeconds: 0,
        trimEndSeconds: 0,
        outputDurationSeconds: 0,
        wasClampedToBuffer: false,
        deletedOriginal: false,
        openedAfterSave: false,
        failTimeoutBudgetSeconds: captureFailTimeoutSeconds,
        outputFileName: '—',
        ffmpegCommand: '—',
        note: `Ignored duplicate capture press (${waitSec}s remaining in 2.0s debounce window).`,
      };
      setLogs((prev) => [debouncedEntry, ...prev.slice(0, 14)]);
      setStatusBanner({
        tone: 'debounced',
        message: `Debounced: Capture button pressed within 2.0s window (${waitSec}s remaining). Extra press ignored.`,
      });
      return;
    }

    lastCaptureEpochRef.current = now;
    setDebounceRemainingMs(2000);
    captureRunningRef.current = true;

    setStatusBanner({
      tone: 'working',
      message: `Sent ${settings.masterHotkey || 'Alt+F10'} → Waiting for master clip write lock release (Fail timer: ${captureFailTimeoutSeconds}s)...`,
    });

    window.setTimeout(() => {
      captureRunningRef.current = false;

      if (simulateDiskTimeoutFailure) {
        flashSlotBadge(slot.slotIndex, 'alert');
        if (hasErrorSoundConfigured) {
          playEmulatorCue('error', customErrorAudioUrl);
        }
        const failedEntry: CaptureLogEntry = {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: new Date().toLocaleTimeString(),
          triggerLabel,
          status: 'failed',
          requestedSeconds: requestedSec,
          masterElapsedSeconds: actualElapsedSeconds,
          trimStartSeconds: 0,
          trimEndSeconds: 0,
          outputDurationSeconds: 0,
          wasClampedToBuffer: false,
          deletedOriginal: false,
          openedAfterSave: false,
          failTimeoutBudgetSeconds: captureFailTimeoutSeconds,
          outputFileName: 'Not written',
          ffmpegCommand: 'Aborted — master/output clip failed to write within fail timer',
          note: `Exceeded ${captureFailTimeoutSeconds}s fail timer without output file on disk.${
            hasErrorSoundConfigured ? ' Played Failure Sound.' : ' (No Failure Sound set — silent).'
          }`,
        };
        setLogs((prev) => [failedEntry, ...prev.slice(0, 14)]);
        setStatusBanner({
          tone: 'error',
          message: `Capture failed: Output clip was not written within the ${captureFailTimeoutSeconds}s fail timer.${
            hasErrorSoundConfigured ? ' Failure sound triggered.' : ''
          }`,
        });
        return;
      }

      const nowStamp = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const baseName = `Replay_${nowStamp.getFullYear()}-${pad(nowStamp.getMonth() + 1)}-${pad(nowStamp.getDate())}_${pad(nowStamp.getHours())}-${pad(nowStamp.getMinutes())}-${pad(nowStamp.getSeconds())}`;

      const plan = computeReplayTrimPlan({
        requestedSeconds: requestedSec,
        masterElapsedSeconds: actualElapsedSeconds,
        ffmpegPath: settings.ffmpegPath,
        mainCapturesDir: settings.mainCapturesDir,
        outputDir: settings.outputDir,
        masterFileBaseName: baseName,
      });

      flashSlotBadge(slot.slotIndex, 'ok');
      if (hasSuccessSoundConfigured) {
        playEmulatorCue('success', customSuccessAudioUrl);
      }

      const noteParts: string[] = [];
      if (plan.wasClampedToBuffer) {
        noteParts.push(
          `Requested ${formatDynamicButtonTitle(requestedSec)} exceeded ${formatDynamicButtonTitle(actualElapsedSeconds)} elapsed buffer — clamped to 00:00:00.00–${formatPreciseTimestamp(plan.alignedEndSeconds)}.`
        );
      } else {
        noteParts.push(
          `Sliced ${formatPreciseTimestamp(plan.keyframeStartSeconds)} → ${formatPreciseTimestamp(plan.alignedEndSeconds)} (stream copy, A/V aligned).`
        );
      }
      if (settings.deleteOriginal) {
        noteParts.push('Deleted original master capture.');
      }
      const shouldOpenAfterSave =
        slot.openAfterSaveMode === 'open'
          ? true
          : slot.openAfterSaveMode === 'never'
            ? false
            : Boolean(settings.openAfterSave);

      if (shouldOpenAfterSave) {
        noteParts.push('Opened saved clip immediately in default media player.');
      }

      const okEntry: CaptureLogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date().toLocaleTimeString(),
        triggerLabel,
        status: 'success',
        requestedSeconds: requestedSec,
        masterElapsedSeconds: actualElapsedSeconds,
        trimStartSeconds: plan.keyframeStartSeconds,
        trimEndSeconds: plan.alignedEndSeconds,
        outputDurationSeconds: plan.outputDurationSeconds,
        wasClampedToBuffer: plan.wasClampedToBuffer,
        deletedOriginal: settings.deleteOriginal,
        openedAfterSave: shouldOpenAfterSave,
        failTimeoutBudgetSeconds: captureFailTimeoutSeconds,
        outputFileName: plan.outputFileName,
        ffmpegCommand: plan.ffmpegCommand,
        note: noteParts.join(' '),
      };

      setLogs((prev) => [okEntry, ...prev.slice(0, 14)]);
      setStatusBanner({
        tone: 'success',
        message: `Saved ${plan.outputFileName}${shouldOpenAfterSave ? ' and opened clip in default player' : ''} (${formatPreciseTimestamp(plan.keyframeStartSeconds)} → ${formatPreciseTimestamp(plan.alignedEndSeconds)} | Fail timer: ${captureFailTimeoutSeconds}s).${
          hasSuccessSoundConfigured ? ' Played Success Sound.' : ''
        }`,
      });
    }, 380);
  };

  const applyStepForSlot = (slot: DeckKeySlot, isRepeatTick = false) => {
    if (slot.actionType === StreamDeckActionType.DYNAMIC_INCREASE) {
      const btnStepSec = Math.max(1, parseTimecodeToSeconds(slot.stepDurationInput, 30));
      setDynamicSeconds((prev) => {
        const next = prev + btnStepSec;
        const nextFail = calculateFailTimeoutSeconds(next);
        setStatusBanner({
          tone: 'idle',
          message: `Dynamic Increase (+${btnStepSec}s${isRepeatTick ? ' · hold repeat' : ''}): Dynamic Length updated to ${formatDynamicButtonTitle(next)} (Fail timer: ${nextFail}s).`,
        });
        return next;
      });
      return;
    }

    if (slot.actionType === StreamDeckActionType.DYNAMIC_DECREASE) {
      const btnStepSec = Math.max(1, parseTimecodeToSeconds(slot.stepDurationInput, 30));
      const autoFloor = Math.max(1, Math.min(30, btnStepSec));
      const rawFloor = slot.minFloorInput.trim();
      const floorSec = rawFloor ? Math.max(1, parseTimecodeToSeconds(rawFloor, autoFloor)) : autoFloor;
      setDynamicSeconds((prev) => {
        const clamped = Math.max(floorSec, prev - btnStepSec);
        const next = Math.max(1, Math.min(prev, clamped));
        const nextFail = calculateFailTimeoutSeconds(next);
        setStatusBanner({
          tone: 'idle',
          message: `Dynamic Decrease (-${btnStepSec}s, floor ${formatDynamicButtonTitle(floorSec)}${isRepeatTick ? ' · hold repeat' : ''}): Dynamic Length updated to ${formatDynamicButtonTitle(next)} (Fail timer: ${nextFail}s).`,
        });
        return next;
      });
    }
  };

  const handleKeyPointerDown = (slot: DeckKeySlot) => {
    setSelectedSlotIdx(slot.slotIndex);
    setPressedSlotIdx(slot.slotIndex);

    if (
      slot.actionType !== StreamDeckActionType.DYNAMIC_INCREASE &&
      slot.actionType !== StreamDeckActionType.DYNAMIC_DECREASE
    ) {
      return;
    }

    clearHoldTimers();
    applyStepForSlot(slot, false);

    const delaySec =
      Number.isFinite(settings.repeatDelaySeconds) && settings.repeatDelaySeconds >= 0.05
        ? Math.min(10, settings.repeatDelaySeconds)
        : 0.5;
    const rateHz =
      Number.isFinite(settings.repeatRateHz) && settings.repeatRateHz >= 0.5
        ? Math.min(30, settings.repeatRateHz)
        : 5;
    const delayMs = Math.round(delaySec * 1000);
    const intervalMs = Math.max(33, Math.round(1000 / rateHz));

    holdDelayTimerRef.current = window.setTimeout(() => {
      holdDelayTimerRef.current = null;
      applyStepForSlot(slot, true);
      holdRepeatTimerRef.current = window.setInterval(() => {
        applyStepForSlot(slot, true);
      }, intervalMs);
    }, delayMs);
  };

  const handleKeyPointerRelease = (slotIndex: number) => {
    clearHoldTimers();
    setPressedSlotIdx((cur) => (cur === slotIndex ? null : cur));
  };

  const handleKeyPress = (slot: DeckKeySlot, isKeyboardClick = false) => {
    setSelectedSlotIdx(slot.slotIndex);

    if (!slot.actionType) return;

    if (
      slot.actionType === StreamDeckActionType.DYNAMIC_INCREASE ||
      slot.actionType === StreamDeckActionType.DYNAMIC_DECREASE
    ) {
      if (isKeyboardClick) {
        setPressedSlotIdx(slot.slotIndex);
        window.setTimeout(() => setPressedSlotIdx((cur) => (cur === slot.slotIndex ? null : cur)), 130);
        applyStepForSlot(slot, false);
      }
      return;
    }

    setPressedSlotIdx(slot.slotIndex);
    window.setTimeout(() => setPressedSlotIdx((cur) => (cur === slot.slotIndex ? null : cur)), 130);

    if (slot.actionType === StreamDeckActionType.RESET_DYNAMIC_LENGTH) {
      const targetSec = Math.max(1, parseTimecodeToSeconds(slot.resetDurationInput, 30));
      const nextFail = calculateFailTimeoutSeconds(targetSec);
      setDynamicSeconds(targetSec);
      setStatusBanner({
        tone: 'idle',
        message: `Reset Dynamic Length: Dynamic Length set to ${formatDynamicButtonTitle(targetSec)} (${targetSec}s · Fail timer: ${nextFail}s).`,
      });
      return;
    }

    if (slot.actionType === StreamDeckActionType.OPEN_OUTPUT_DIRECTORY) {
      const targetFolder =
        settings.outputDir.trim() || settings.mainCapturesDir.trim() || 'C:\\Videos\\Trimmed Replays';
      setStatusBanner({
        tone: 'idle',
        message: `Open Output Directory: Launched OS file manager at "${targetFolder}".`,
      });
      return;
    }

    if (slot.actionType === StreamDeckActionType.OPEN_CAPTURES_DIRECTORY) {
      const targetFolder = settings.mainCapturesDir.trim() || 'C:\\Videos\\Captures';
      setStatusBanner({
        tone: 'idle',
        message: `Open Captures Directory: Launched OS file manager at "${targetFolder}".`,
      });
      return;
    }

    if (slot.actionType === StreamDeckActionType.FIXED_LENGTH) {
      const fixedSec = Math.max(1, parseTimecodeToSeconds(slot.fixedDurationInput, 30));
      executeSimulatedCapture(slot, fixedSec, `Fixed (${formatDynamicButtonTitle(fixedSec)})`);
      return;
    }

    if (slot.actionType === StreamDeckActionType.DYNAMIC_LENGTH) {
      executeSimulatedCapture(slot, dynamicSeconds, `Dynamic (${formatDynamicButtonTitle(dynamicSeconds)})`);
    }
  };

  const updateSelectedSlot = (patch: Partial<DeckKeySlot>) => {
    setSlots((prev) =>
      prev.map((s) => (s.slotIndex === selectedSlotIdx ? { ...s, ...patch } : s))
    );
  };

  const assignActionToSelectedSlot = (actionType: StreamDeckActionType | null) => {
    if (!actionType) {
      updateSelectedSlot({ actionType: null, userTitle: '', fontSizeBoost: 0 });
      return;
    }
    const meta = ACTION_CATALOG.find((a) => a.type === actionType);
    const isAutoLabel =
      actionType === StreamDeckActionType.DYNAMIC_LENGTH ||
      actionType === StreamDeckActionType.DYNAMIC_INCREASE ||
      actionType === StreamDeckActionType.DYNAMIC_DECREASE;
    updateSelectedSlot({
      actionType,
      userTitle: isAutoLabel ? '' : meta?.defaultTitle ?? '',
      titleFontSize: isAutoLabel ? 16 : 13,
      fontSizeBoost: 0,
    });
  };

  const toggleAppearanceMenu = () => {
    setAppearanceMenuOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('replayslice_emu_appearance_open', next ? '1' : '0');
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleUploadSlotBgPreview = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (selectedSlot.bgImagePreviewUrl) {
      URL.revokeObjectURL(selectedSlot.bgImagePreviewUrl);
    }
    updateSelectedSlot({
      bgImagePreviewUrl: url,
      bgImagePath: selectedSlot.bgImagePath.trim() || file.name,
    });
  };

  return (
    <section id="emulator" className="scroll-mt-20 space-y-6">
      <div className="bg-[#131924] border border-slate-800 rounded-xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-xl md:text-2xl font-semibold text-slate-50 tracking-tight">
              Interactive Stream Deck Emulator &amp; Buffer Math Verifier
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              Test button presses, rapid 2-second capture debouncing, Dynamic Length dialing, and short-buffer timecode calculations before installing.
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-400 shrink-0">
            {debounceRemainingMs > 0 ? (
              <span className="text-amber-400">
                Capture Debounce Active: {(debounceRemainingMs / 1000).toFixed(2)}s
              </span>
            ) : (
              <span>Capture Debounce: Ready (2.00s lockout)</span>
            )}
          </div>
        </div>

        {/* Buffer & Failure Test Inputs Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-5 border-b border-slate-800">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sim-elapsed" className="text-xs font-medium text-slate-300">
              Simulated Elapsed Master Buffer (HH:MM:SS or MM:SS)
            </label>
            <input
              id="sim-elapsed"
              type="text"
              value={simulatedElapsedInput}
              onChange={(e) => setSimulatedElapsedInput(e.target.value)}
              placeholder="07:00"
              className="w-full bg-[#0B0F17] border border-slate-700/90 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-100 outline-none"
            />
            <p className="text-xs text-slate-500">
              Simulates how much video is actually in your recorded master file ({actualElapsedSeconds}s) when FFprobe inspects it.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-1.5">
            <span className="text-xs font-medium text-slate-300">Current Dynamic Button State</span>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-mono font-semibold tabular-nums text-slate-100">
                {formatDynamicButtonTitle(dynamicSeconds)}
              </span>
              <span className="text-xs text-slate-500">·</span>
              <span className="text-xs text-slate-400 font-mono tabular-nums">
                Fail timer: {calculateFailTimeoutSeconds(dynamicSeconds)}s
              </span>
              <button
                type="button"
                onClick={() => setDynamicSeconds(60)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset 1:00</span>
              </button>
            </div>
              <p className="text-xs text-slate-500">
                Tap or press-and-hold <span className="font-mono text-slate-300">+</span> /{' '}
                <span className="font-mono text-slate-300">-</span> on the deck below to dial Dynamic Length, then press the Dynamic key.
              </p>
            </div>

            <div className="flex flex-col justify-center gap-2">
              <label className="inline-flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={simulateDiskTimeoutFailure}
                  onChange={(e) => setSimulateDiskTimeoutFailure(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-[#0B0F17] text-blue-600"
                />
                <div>
                  <span className="block text-xs font-medium text-slate-200">
                    Simulate clip failing to write to disk
                  </span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    Tests the selected button&apos;s {inspectedFailTimeoutSeconds}s fail counter when no output clip is created.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Two-Column Hardware Deck + Stream Deck Native Button Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 items-start">
            {/* Left 7 cols: Physical 5x3 Stream Deck Keypad */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="bg-[#0B0F17] border border-slate-800 rounded-xl p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4 text-xs text-slate-400">
                  <span>Stream Deck 15-Key Layout (Click or hold + / - to test repeat)</span>
                  <span className="font-mono tabular-nums">Slot #{selectedSlotIdx + 1}</span>
                </div>

                <div className="grid grid-cols-5 gap-3 sm:gap-4 max-w-[540px] mx-auto">
                  {slots.map((slot) => {
                    const isSelected = slot.slotIndex === selectedSlotIdx;
                    const isPressed = slot.slotIndex === pressedSlotIdx;
                    const feedback = slotBadgeFeedback[slot.slotIndex];

                    const isDynamic = slot.actionType === StreamDeckActionType.DYNAMIC_LENGTH;
                    const boost = Math.max(0, Math.min(56, slot.fontSizeBoost || 0));
                    const effectiveFontSize = Math.min(64, slot.titleFontSize + boost);

                    let displayTitle = slot.userTitle;
                    if (boost > 0 && slot.customBoostText.trim()) {
                      displayTitle = slot.customBoostText.replace(/\\n/g, '\n');
                    } else if (isDynamic) {
                      displayTitle = slot.userTitle.trim() || formatDynamicButtonTitle(dynamicSeconds);
                    } else if (slot.actionType === StreamDeckActionType.DYNAMIC_INCREASE) {
                      displayTitle = slot.userTitle.trim() || '+';
                    } else if (slot.actionType === StreamDeckActionType.DYNAMIC_DECREASE) {
                      displayTitle = slot.userTitle.trim() || '-';
                    } else if (boost > 0 && !slot.userTitle.trim()) {
                      if (slot.actionType === StreamDeckActionType.FIXED_LENGTH) {
                        displayTitle = formatDynamicButtonTitle(
                          Math.max(1, parseTimecodeToSeconds(slot.fixedDurationInput, 30))
                        );
                      } else if (slot.actionType === StreamDeckActionType.RESET_DYNAMIC_LENGTH) {
                        displayTitle = formatDynamicButtonTitle(
                          Math.max(1, parseTimecodeToSeconds(slot.resetDurationInput, 30))
                        );
                      }
                    }

                    const alignClass =
                      slot.titleAlignment === 'top'
                        ? 'items-start pt-2'
                        : slot.titleAlignment === 'bottom'
                          ? 'items-end pb-2'
                          : 'items-center';

                    return (
                      <button
                        key={slot.slotIndex}
                        type="button"
                        onPointerDown={(e) => {
                          if (e.button === 0) handleKeyPointerDown(slot);
                        }}
                        onPointerUp={() => handleKeyPointerRelease(slot.slotIndex)}
                        onPointerLeave={() => handleKeyPointerRelease(slot.slotIndex)}
                        onPointerCancel={() => handleKeyPointerRelease(slot.slotIndex)}
                        onClick={(e) => handleKeyPress(slot, e.detail === 0)}
                        style={{
                          transform: isPressed ? 'scale(0.94)' : 'scale(1)',
                          backgroundImage: slot.bgImagePreviewUrl ? `url(${slot.bgImagePreviewUrl})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                        className={`relative aspect-square rounded-xl border transition-transform duration-100 flex justify-center px-1.5 select-none cursor-pointer overflow-hidden ${alignClass} ${
                          slot.actionType ? 'bg-[#141820]' : 'bg-[#0E1219]'
                        } ${
                          isSelected
                            ? 'border-blue-500 ring-2 ring-blue-500/30'
                            : 'border-slate-700/80 hover:border-slate-500'
                        }`}
                      >
                      {displayTitle ? (
                        <span
                          style={{
                            fontSize: `${effectiveFontSize}px`,
                            color: slot.titleColor,
                          }}
                          className={`font-semibold leading-none text-center whitespace-pre-line break-words max-w-full drop-shadow-sm ${
                            isDynamic || boost > 0 ? 'font-mono tabular-nums tracking-tight' : ''
                          }`}
                        >
                          {displayTitle}
                        </span>
                      ) : !slot.actionType ? (
                        <span className="text-[11px] text-slate-600">Empty</span>
                      ) : null}

                      {feedback === 'ok' && (
                        <span className="absolute bottom-1.5 right-1.5 text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      )}
                      {feedback === 'alert' && (
                        <span className="absolute bottom-1.5 right-1.5 text-red-400">
                          <XCircle className="w-4 h-4" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Status Readout */}
            <div
              className={`rounded-lg border px-4 py-3 text-xs font-mono leading-relaxed ${
                statusBanner.tone === 'success'
                  ? 'bg-emerald-950/30 border-emerald-800/70 text-emerald-200'
                  : statusBanner.tone === 'error'
                    ? 'bg-red-950/30 border-red-800/70 text-red-200'
                    : statusBanner.tone === 'debounced'
                      ? 'bg-amber-950/30 border-amber-800/70 text-amber-200'
                      : statusBanner.tone === 'working'
                        ? 'bg-blue-950/30 border-blue-800/70 text-blue-200'
                        : 'bg-[#0B0F17] border-slate-800 text-slate-300'
              }`}
            >
              {statusBanner.message}
            </div>
          </div>

          {/* Right 5 cols: Authentic Stream Deck Button & Action Inspector */}
          <div className="lg:col-span-5 bg-[#0B0F17] border border-slate-800 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Stream Deck Key #{selectedSlotIdx + 1} Configuration
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Mirrors Elgato Stream Deck&apos;s right-hand Action &amp; Title inspector
                </p>
              </div>
              {selectedSlot.actionType && (
                <button
                  type="button"
                  onClick={() => assignActionToSelectedSlot(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-red-300 bg-slate-900 border border-slate-800 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Key</span>
                </button>
              )}
            </div>

            {/* Action Type Picker */}
            <div className="space-y-1.5">
              <label htmlFor="slot-action-select" className="text-xs font-medium text-slate-300">
                ReplaySlice Button Type
              </label>
              <select
                id="slot-action-select"
                value={selectedSlot.actionType ?? ''}
                onChange={(e) =>
                  assignActionToSelectedSlot(
                    e.target.value ? (e.target.value as StreamDeckActionType) : null
                  )
                }
                className="w-full bg-[#131924] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
              >
                <option value="">— Empty Key Slot —</option>
                {ACTION_CATALOG.map((item) => (
                  <option key={item.type} value={item.type}>
                    {item.name}
                  </option>
                ))}
              </select>
              {selectedSlot.actionType && (
                <p className="text-xs text-slate-500">
                  {ACTION_CATALOG.find((a) => a.type === selectedSlot.actionType)?.summary}
                </p>
              )}
            </div>

            {selectedSlot.actionType && (
              <>
                {/* Stream Deck Native Title & Font Size Controls */}
                <div className="space-y-3 pt-2 border-t border-slate-800/80">
                  <p className="text-xs font-medium text-slate-400">
                    Stream Deck Software Native Title Styling
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="slot-title" className="text-xs text-slate-400">
                        Title Text
                      </label>
                      <input
                        id="slot-title"
                        type="text"
                        value={selectedSlot.userTitle}
                        onChange={(e) => updateSelectedSlot({ userTitle: e.target.value })}
                        placeholder={
                          selectedSlot.actionType === StreamDeckActionType.DYNAMIC_LENGTH
                            ? 'Leave empty for live timer'
                            : 'Button label'
                        }
                        className="w-full bg-[#131924] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="slot-fontsize" className="text-xs text-slate-400">
                        Stream Deck Font Size (max 16)
                      </label>
                      <input
                        id="slot-fontsize"
                        type="number"
                        min={6}
                        max={16}
                        value={selectedSlot.titleFontSize}
                        onChange={(e) =>
                          updateSelectedSlot({
                            titleFontSize: Math.min(16, Math.max(6, Number(e.target.value) || 14)),
                          })
                        }
                        className="w-full bg-[#131924] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-100 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 bg-[#131924] p-1 rounded-lg border border-slate-800">
                      {(['top', 'middle', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => updateSelectedSlot({ titleAlignment: pos })}
                          className={`px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors cursor-pointer whitespace-nowrap ${
                            selectedSlot.titleAlignment === pos
                              ? 'bg-slate-700 text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs text-slate-400">
                      <span>Color</span>
                      <input
                        type="color"
                        value={selectedSlot.titleColor}
                        onChange={(e) => updateSelectedSlot({ titleColor: e.target.value })}
                        className="w-7 h-7 rounded bg-transparent border-0 cursor-pointer"
                      />
                    </label>
                  </div>

                  {selectedSlot.actionType === StreamDeckActionType.DYNAMIC_LENGTH && (
                    <div className="space-y-1">
                      <p className="text-xs font-mono tabular-nums text-slate-300">
                        Active Dynamic Length: {formatDynamicButtonTitle(dynamicSeconds)} · Fail timer:{' '}
                        <span className="text-slate-100 font-semibold">
                          {calculateFailTimeoutSeconds(dynamicSeconds)}s
                        </span>{' '}
                        (10s + 2s per 5m)
                      </p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Stream Deck&apos;s native font, size, alignment, color, and background image apply directly to{' '}
                        <span className="font-mono text-slate-300">setTitle()</span> updates as long as Title Text is left empty.
                      </p>
                    </div>
                  )}
                </div>

                {/* Per-Button Property Inspector (all ReplaySlice buttons support Custom Text Size & Key Background) */}
                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  <p className="text-xs font-medium text-slate-400">Button Action Settings</p>

                    {selectedSlot.actionType === StreamDeckActionType.FIXED_LENGTH && (
                      <div className="space-y-1.5">
                        <label htmlFor="slot-fixed-dur" className="text-xs font-medium text-slate-300">
                          Fixed Replay Length (HH:MM:SS or MM:SS)
                        </label>
                        <input
                          id="slot-fixed-dur"
                          type="text"
                          value={selectedSlot.fixedDurationInput}
                          onChange={(e) => updateSelectedSlot({ fixedDurationInput: e.target.value })}
                          placeholder="00:30"
                          className="w-full bg-[#131924] border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-100 outline-none"
                        />
                        <p className="text-xs font-mono tabular-nums text-slate-400">
                          Captures last {inspectedCaptureSeconds}s · Fail timer:{' '}
                          <span className="text-slate-100 font-semibold">{inspectedFailTimeoutSeconds}s</span> (10s + 2s per 5m)
                        </p>
                      </div>
                    )}

                    {(selectedSlot.actionType === StreamDeckActionType.FIXED_LENGTH ||
                      selectedSlot.actionType === StreamDeckActionType.DYNAMIC_LENGTH) && (
                      <div className="space-y-1.5 pt-1">
                        <label htmlFor="slot-open-mode" className="text-xs font-medium text-slate-300">
                          After Saving Clip (This Button)
                        </label>
                        <select
                          id="slot-open-mode"
                          value={selectedSlot.openAfterSaveMode}
                          onChange={(e) =>
                            updateSelectedSlot({ openAfterSaveMode: e.target.value as OpenAfterSaveMode })
                          }
                          className="w-full bg-[#131924] border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none"
                        >
                          <option value="global">
                            Follow Global Setting ({settings.openAfterSave ? 'Currently On' : 'Currently Off'})
                          </option>
                          <option value="open">Always open clip on this button</option>
                          <option value="never">Never open clip on this button</option>
                        </select>
                        <p className="text-xs text-slate-500">
                          Saved independently on this key so you can mix silent-save and instant-review buttons.
                        </p>
                      </div>
                    )}

                    {(selectedSlot.actionType === StreamDeckActionType.DYNAMIC_INCREASE ||
                      selectedSlot.actionType === StreamDeckActionType.DYNAMIC_DECREASE) && (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label htmlFor="slot-step-dur" className="text-xs font-medium text-slate-300">
                            {selectedSlot.actionType === StreamDeckActionType.DYNAMIC_INCREASE
                              ? 'Increase Step Length (HH:MM:SS, MM:SS, or sec)'
                              : 'Decrease Step Length (HH:MM:SS, MM:SS, or sec)'}
                          </label>
                          <input
                            id="slot-step-dur"
                            type="text"
                            value={selectedSlot.stepDurationInput}
                            onChange={(e) => updateSelectedSlot({ stepDurationInput: e.target.value })}
                            placeholder="00:30"
                            className="w-full bg-[#131924] border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-100 outline-none"
                          />
                          <p className="text-xs text-slate-400">
                            {selectedSlot.actionType === StreamDeckActionType.DYNAMIC_INCREASE
                              ? `Adds +${Math.max(1, parseTimecodeToSeconds(selectedSlot.stepDurationInput, 30))}s per press (independent to this key).`
                              : `Subtracts -${Math.max(1, parseTimecodeToSeconds(selectedSlot.stepDurationInput, 30))}s per press (independent to this key).`}
                          </p>
                        </div>

                        {selectedSlot.actionType === StreamDeckActionType.DYNAMIC_DECREASE && (
                          <div className="space-y-1.5">
                            <label htmlFor="slot-min-floor" className="text-xs font-medium text-slate-300">
                              Minimum Dynamic Length Floor (Optional)
                            </label>
                            <input
                              id="slot-min-floor"
                              type="text"
                              value={selectedSlot.minFloorInput}
                              onChange={(e) => updateSelectedSlot({ minFloorInput: e.target.value })}
                              placeholder="Auto (00:30, or step if smaller)"
                              className="w-full bg-[#131924] border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-100 outline-none"
                            />
                            <p className="text-xs text-slate-500">
                              Lets a large minus button drop Dynamic Length straight down without going below this floor.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedSlot.actionType === StreamDeckActionType.RESET_DYNAMIC_LENGTH && (
                      <div className="space-y-1.5">
                        <label htmlFor="slot-reset-dur" className="text-xs font-medium text-slate-300">
                          Reset Target Length (HH:MM:SS, MM:SS, or sec)
                        </label>
                        <input
                          id="slot-reset-dur"
                          type="text"
                          value={selectedSlot.resetDurationInput}
                          onChange={(e) => updateSelectedSlot({ resetDurationInput: e.target.value })}
                          placeholder="00:30"
                          className="w-full bg-[#131924] border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-100 outline-none"
                        />
                        <p className="text-xs text-slate-400">
                          Sets Dynamic Length to{' '}
                          <span className="font-mono tabular-nums text-slate-200">
                            {formatDynamicButtonTitle(Math.max(1, parseTimecodeToSeconds(selectedSlot.resetDurationInput, 30)))}
                          </span>{' '}
                          when pressed. Saved independently on this button so you can place multiple preset keys.
                        </p>
                      </div>
                    )}

                    {/* Collapsible Custom Text Size & Key Background Menu */}
                    <div className="border border-slate-800 rounded-lg bg-[#0E131D] overflow-hidden mt-2">
                      <button
                        type="button"
                        onClick={toggleAppearanceMenu}
                        aria-expanded={appearanceMenuOpen}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left bg-[#131924] hover:bg-[#172030] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-semibold text-slate-200">
                            Custom Text Size &amp; Key Background
                          </span>
                          {selectedSlot.fontSizeBoost > 0 && (
                            <span className="text-xs font-mono tabular-nums text-blue-400">
                              +{selectedSlot.fontSizeBoost}pt ({selectedSlot.titleFontSize + selectedSlot.fontSizeBoost}pt)
                            </span>
                          )}
                        </div>
                        <ChevronRight
                          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                            appearanceMenuOpen ? 'rotate-90' : ''
                          }`}
                        />
                      </button>

                      {appearanceMenuOpen && (
                        <div className="p-3.5 border-t border-slate-800 space-y-3.5">
                          <div className="space-y-1.5">
                            <label htmlFor="slot-font-boost" className="text-xs font-medium text-slate-300">
                              Font Size Boost (+pt above Stream Deck size)
                            </label>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedSlot({
                                    fontSizeBoost: Math.max(0, (selectedSlot.fontSizeBoost || 0) - 1),
                                  })
                                }
                                className="px-2.5 py-1.5 text-xs font-mono font-medium text-slate-200 bg-[#131924] hover:bg-slate-800 border border-slate-700 rounded-md cursor-pointer"
                              >
                                -1
                              </button>
                              <input
                                id="slot-font-boost"
                                type="number"
                                min={0}
                                max={56}
                                step={1}
                                value={selectedSlot.fontSizeBoost}
                                onChange={(e) =>
                                  updateSelectedSlot({
                                    fontSizeBoost: Math.min(56, Math.max(0, Math.round(Number(e.target.value) || 0))),
                                  })
                                }
                                className="flex-1 min-w-0 bg-[#131924] border border-slate-700 focus:border-blue-500 rounded-md px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-100 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateSelectedSlot({
                                    fontSizeBoost: Math.min(56, (selectedSlot.fontSizeBoost || 0) + 1),
                                  })
                                }
                                className="px-2.5 py-1.5 text-xs font-mono font-medium text-slate-200 bg-[#131924] hover:bg-slate-800 border border-slate-700 rounded-md cursor-pointer"
                              >
                                +1
                              </button>
                              <button
                                type="button"
                                onClick={() => updateSelectedSlot({ fontSizeBoost: 0 })}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-[#131924] hover:bg-slate-800 border border-slate-700 rounded-md cursor-pointer whitespace-nowrap"
                              >
                                Reset (0)
                              </button>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              {selectedSlot.fontSizeBoost > 0
                                ? `Boost +${selectedSlot.fontSizeBoost}pt (${selectedSlot.titleFontSize} → ${selectedSlot.titleFontSize + selectedSlot.fontSizeBoost}pt) using Stream Deck's selected Font & Color. Leave Title Text blank so text doesn't double up.`
                                : '0 (Off) — Uses Stream Deck’s native text size & icon layer.'}
                            </p>
                          </div>

                          <div className="space-y-1.5">
                            <label htmlFor="slot-bg-img" className="text-xs font-medium text-slate-300">
                              Key Background Image (Optional — .png / .jpg)
                            </label>
                            <div className="flex items-center gap-1.5">
                              <input
                                id="slot-bg-img"
                                type="text"
                                value={selectedSlot.bgImagePath}
                                onChange={(e) => updateSelectedSlot({ bgImagePath: e.target.value })}
                                placeholder="Optional PNG/JPG behind boosted text"
                                className="flex-1 min-w-0 bg-[#131924] border border-slate-700 focus:border-blue-500 rounded-md px-2.5 py-1.5 text-xs font-mono text-slate-100 outline-none"
                              />
                              <label className="px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#131924] hover:bg-slate-800 border border-slate-700 rounded-md cursor-pointer whitespace-nowrap">
                                <span>Browse</span>
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp,image/bmp,image/svg+xml"
                                  className="hidden"
                                  onChange={(e) => handleUploadSlotBgPreview(e.target.files?.[0] ?? null)}
                                />
                              </label>
                              {(selectedSlot.bgImagePath || selectedSlot.bgImagePreviewUrl) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (selectedSlot.bgImagePreviewUrl) {
                                      URL.revokeObjectURL(selectedSlot.bgImagePreviewUrl);
                                    }
                                    updateSelectedSlot({ bgImagePath: '', bgImagePreviewUrl: null });
                                  }}
                                  className="px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-[#131924] hover:bg-slate-800 border border-slate-700 rounded-md cursor-pointer"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">
                              Composites your PNG/JPG directly behind giant boosted timers or symbols.
                            </p>
                          </div>

                          <div className="space-y-1">
                            <label htmlFor="slot-boost-text" className="text-xs font-medium text-slate-300">
                              Boosted Text Override (Optional)
                            </label>
                            <input
                              id="slot-boost-text"
                              type="text"
                              value={selectedSlot.customBoostText}
                              onChange={(e) => updateSelectedSlot({ customBoostText: e.target.value })}
                              placeholder="Leave blank for automatic timer / + / -"
                              className="w-full bg-[#131924] border border-slate-700 focus:border-blue-500 rounded-md px-2.5 py-1.5 text-xs text-slate-100 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Trim & FFmpeg Execution Log Table */}
      <div className="bg-[#131924] border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Capture Pipeline &amp; FFmpeg Stream-Copy Log
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verifies exact start/end timecodes, short-buffer clamping, 2-second debounce behavior, and FFmpeg flags.
            </p>
          </div>
          {logs.length > 0 && (
            <button
              type="button"
              onClick={() => setLogs([])}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              Clear Log
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="py-10 text-center">
            <FolderOpen className="w-7 h-7 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-300 font-medium">No simulated captures triggered yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Click <span className="text-slate-300">Clip 30s</span> or the{' '}
              <span className="font-mono text-slate-300">1:00</span> Dynamic Length button above to inspect the generated FFmpeg command.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 pr-4 whitespace-nowrap">Time</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Button</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Outcome</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Master Elapsed</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Trim Range</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Fail Timer</th>
                  <th className="py-2.5 pl-3">Details &amp; Generated FFmpeg Command</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
                {logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-800/30 align-top">
                    <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">{entry.timestamp}</td>
                    <td className="py-3 px-3 text-slate-200 font-sans font-medium whitespace-nowrap">
                      {entry.triggerLabel}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-sans">
                      {entry.status === 'success' && (
                        <span className="text-emerald-400 font-medium">Clip Saved</span>
                      )}
                      {entry.status === 'debounced' && (
                        <span className="text-amber-400 font-medium">Ignored (2s Debounce)</span>
                      )}
                      {entry.status === 'failed' && (
                        <span className="text-red-400 font-medium">Failed / Timeout</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-300 whitespace-nowrap">
                      {formatPreciseTimestamp(entry.masterElapsedSeconds)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-200 whitespace-nowrap">
                      {entry.status === 'success'
                        ? `${formatPreciseTimestamp(entry.trimStartSeconds)} → ${formatPreciseTimestamp(entry.trimEndSeconds)}`
                        : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-400 whitespace-nowrap">
                      {entry.failTimeoutBudgetSeconds}s
                    </td>
                    <td className="py-3 pl-3 font-sans text-slate-300 min-w-[320px]">
                      <p className="text-xs text-slate-300">{entry.note}</p>
                      {entry.status === 'success' && (
                        <code className="block mt-1.5 p-2 rounded bg-[#0B0F17] border border-slate-800 text-[11px] font-mono text-slate-400 break-all">
                          {entry.ffmpegCommand}
                        </code>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
