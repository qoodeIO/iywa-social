// Hold-to-record voice notes with expo-audio, with a real waveform from the
// microphone level (the web sends a fixed demo waveform).
import { useCallback, useRef } from "react";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { keepFile } from "./media";
import { VOICE_WAVE } from "./format";

const BARS = 26;

function waveOf(levels) {
  if (levels.length < 4) return VOICE_WAVE;
  const out = [];
  for (let i = 0; i < BARS; i += 1) {
    const from = Math.floor((i / BARS) * levels.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / BARS) * levels.length));
    const slice = levels.slice(from, to);
    const db = Math.max(...slice);
    // -50 dB (quiet) .. -5 dB (loud) -> 18..100 %
    out.push(Math.round(Math.max(18, Math.min(100, ((db + 50) / 45) * 100))));
  }
  return out;
}

export function useVoiceRecorder() {
  const levels = useRef([]);
  const state = useRef({ active: false, ready: null });
  const poll = useRef(0);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true, numberOfChannels: 1, bitRate: 32000 });

  const start = useCallback(async () => {
    levels.current = [];
    state.current.active = true;
    const job = (async () => {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error("denied");
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!state.current.active) return false;
      recorder.record();
      clearInterval(poll.current);
      poll.current = setInterval(() => {
        try {
          const level = recorder.getStatus().metering;
          if (typeof level === "number") levels.current.push(level);
        } catch {
          // released
        }
      }, 90);
      return true;
    })();
    state.current.ready = job;
    return job.catch(() => false);
  }, [recorder]);

  // Resolves to { uri, wave } or null when nothing was recorded.
  const stop = useCallback(async (keep) => {
    state.current.active = false;
    clearInterval(poll.current);
    const started = await (state.current.ready || Promise.resolve(false)).catch(() => false);
    if (!started) {
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      return null;
    }
    try {
      await recorder.stop();
    } catch {
      // nothing recorded
    }
    setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    const uri = recorder.uri;
    if (!keep || !uri) return null;
    return { uri: keepFile(uri, "voice"), wave: waveOf(levels.current) };
  }, [recorder]);

  return { start, stop };
}
