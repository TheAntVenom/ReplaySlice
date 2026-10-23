let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Plays either an uploaded browser preview audio file (.wav / .mp3) or a clean broadcast cue tone
 * when testing the Stream Deck emulator inside the browser.
 */
export function playEmulatorCue(kind: 'success' | 'error' | 'tick', customObjectUrl?: string | null): void {
  if (customObjectUrl && (kind === 'success' || kind === 'error')) {
    const audio = new Audio(customObjectUrl);
    audio.volume = 0.8;
    audio.play().catch(() => {});
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  if (kind === 'tick') {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(640, now);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
    return;
  }

  if (kind === 'success') {
    const notes = [523.25, 783.99]; // C5 -> G5 crisp chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + idx * 0.085;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.24);
    });
    return;
  }

  // Error cue: two low descending buzz tones
  const errNotes = [260, 185];
  errNotes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    const start = now + idx * 0.14;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.11, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.2);
  });
}
