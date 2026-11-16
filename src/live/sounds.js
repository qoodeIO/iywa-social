// Call sounds synthesised with Web Audio (no audio files), as in Spinchat.
// Browsers only allow audio after a user gesture, so the context is unlocked
// on the first pointer or key press.

let context = null;

function ctx() {
  if (!context) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }
  return context;
}

function unlock() {
  const audio = ctx();
  if (audio && audio.state === "suspended") audio.resume().catch(() => {});
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

function tone(freqs, start, length, gain = 0.08) {
  const audio = ctx();
  if (!audio || audio.state !== "running") return;
  const at = audio.currentTime + start;
  const volume = audio.createGain();
  volume.gain.setValueAtTime(0, at);
  volume.gain.linearRampToValueAtTime(gain, at + 0.02);
  volume.gain.setValueAtTime(gain, at + length - 0.05);
  volume.gain.linearRampToValueAtTime(0, at + length);
  volume.connect(audio.destination);
  for (const freq of freqs) {
    const osc = audio.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(volume);
    osc.start(at);
    osc.stop(at + length + 0.02);
  }
}

export const sounds = {
  ring() {
    // Two short rising chimes.
    tone([880, 1320], 0, 0.32, 0.07);
    tone([988, 1480], 0.42, 0.32, 0.07);
    navigator.vibrate?.([300, 150, 300]);
  },
  ringback() {
    // European ringback: 425 Hz.
    tone([425], 0, 1.0, 0.05);
  },
  join() {
    tone([660], 0, 0.12, 0.05);
    tone([990], 0.12, 0.16, 0.05);
  },
  leave() {
    tone([990], 0, 0.12, 0.05);
    tone([660], 0.12, 0.16, 0.05);
  },
  message() {
    tone([1175], 0, 0.09, 0.035);
    tone([1568], 0.08, 0.12, 0.03);
  },
};

export function loop(play, every) {
  play();
  const id = window.setInterval(play, every);
  return () => window.clearInterval(id);
}
