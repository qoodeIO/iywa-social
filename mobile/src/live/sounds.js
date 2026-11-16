// Call and message sounds, synthesised like the web's Web Audio tones but written
// once as small WAV files and played with expo-audio.
// While a call is live WebRTC owns the audio session, so join/leave/ringback use
// haptics there instead of a player (a player would switch the session away from
// play-and-record and silence the microphone).

import { Vibration } from "react-native";
import * as Haptics from "expo-haptics";
import { createAudioPlayer } from "expo-audio";
import { toneUri, wavBytes } from "./media";

function chime(parts, length) {
  return wavBytes(length, 16000, (t) => {
    let value = 0;
    for (const [freqs, start, dur, gain] of parts) {
      if (t < start || t > start + dur) continue;
      const local = t - start;
      const env = Math.min(1, local / 0.02) * Math.min(1, (dur - local) / 0.05);
      for (const freq of freqs) value += Math.sin(2 * Math.PI * freq * t) * gain * env;
    }
    return value;
  });
}

const SPECS = {
  ring: () => chime([[[880, 1320], 0, 0.32, 0.32], [[988, 1480], 0.42, 0.32, 0.32]], 0.8),
  message: () => chime([[[1175], 0, 0.09, 0.3], [[1568], 0.08, 0.12, 0.26]], 0.24),
};

const players = {};

async function play(name) {
  try {
    if (!players[name]) {
      const uri = await toneUri(name, SPECS[name]());
      if (!uri) return;
      players[name] = createAudioPlayer({ uri });
    }
    const player = players[name];
    await player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // sounds are a nicety
  }
}

export const sounds = {
  ring() {
    play("ring");
    Vibration.vibrate([0, 300, 150, 300]);
  },
  ringback() {
    Haptics.selectionAsync().catch(() => {});
  },
  join() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  leave() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  message() {
    play("message");
  },
};

export function loop(fn, every) {
  fn();
  const id = setInterval(fn, every);
  return () => clearInterval(id);
}
