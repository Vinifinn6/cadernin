const CHIME_MUTE_STORAGE_KEY = "cadernin_timer_chime_muted_v1";

export function isFocusChimeMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CHIME_MUTE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setFocusChimeMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHIME_MUTE_STORAGE_KEY, String(muted));
  } catch {
    // noop
  }
}

/**
 * Sintetiza um toque acústico curto e aconchegante (estilo sino de madeira / marimba)
 * via Web Audio API, sem arquivos externos.
 */
export function playFocusChime(force = false): void {
  if (typeof window === "undefined") return;
  if (!force && isFocusChimeMuted()) return;

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Duas notas doces em quinta justa (Dó5 -> Sol5) com timbre quente de madeira/marimba
    const notes = [
      { freq: 523.25, start: 0, duration: 0.7, gain: 0.14 },
      { freq: 783.99, start: 0.16, duration: 0.95, gain: 0.12 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const amp = ctx.createGain();
      const harmonicAmp = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.start);

      harmonic.type = "triangle";
      harmonic.frequency.setValueAtTime(note.freq * 2, now + note.start);

      amp.gain.setValueAtTime(0.0001, now + note.start);
      amp.gain.exponentialRampToValueAtTime(
        note.gain,
        now + note.start + 0.018
      );
      amp.gain.exponentialRampToValueAtTime(
        0.0001,
        now + note.start + note.duration
      );

      harmonicAmp.gain.setValueAtTime(0.0001, now + note.start);
      harmonicAmp.gain.exponentialRampToValueAtTime(
        note.gain * 0.18,
        now + note.start + 0.012
      );
      harmonicAmp.gain.exponentialRampToValueAtTime(
        0.0001,
        now + note.start + note.duration * 0.45
      );

      osc.connect(amp);
      harmonic.connect(harmonicAmp);
      harmonicAmp.connect(amp);
      amp.connect(ctx.destination);

      osc.start(now + note.start);
      harmonic.start(now + note.start);
      osc.stop(now + note.start + note.duration + 0.05);
      harmonic.stop(now + note.start + note.duration + 0.05);
    }

    setTimeout(() => {
      void ctx.close();
    }, 1600);
  } catch {
    // Ignora caso o navegador bloqueie áudio sem interação recente
  }
}
