/**
 * Audio bridge — connects the thesis soundtrack (opt-in, user-activated) to the
 * system network. The ThesisCrawl dispatches `indii:thesis-audio` with the
 * playing <audio> element; this module taps it with an AnalyserNode and writes
 * three coarse band levels into the signals store at ~10Hz.
 *
 * Nothing here can ever start audio: it only reacts to an element the user
 * already chose to play. If the thesis falls back to the WebAudio synth path
 * (no <audio> element), the visuals simply stay silent.
 */
import { setSystemAudio, type AudioLevels } from './signals';

const AUDIO_START_EVENT = 'indii:thesis-audio';
const AUDIO_STOP_EVENT = 'indii:thesis-audio-stop';

const FFT_SIZE = 64;
const POLL_MS = 100;

interface BridgeState {
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  source: MediaElementAudioSourceNode | null;
  pollTimer: number | null;
  element: HTMLAudioElement | null;
}

let bridge: BridgeState | null = null;

function startBridge(element: HTMLAudioElement) {
  if (bridge) return; // already running

  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    const context = new AudioContextClass();
    const analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.75;

    const source = context.createMediaElementSource(element);
    source.connect(analyser);
    analyser.connect(context.destination);
    void context.resume();

    bridge = { context, analyser, source, pollTimer: null, element };
    // Only mark the element as attached once the graph is live, so a failed
    // attach never leaves a sticky flag that blocks a later retry.
    (element as HTMLAudioElement & { __indiiBridgeAttached?: boolean }).__indiiBridgeAttached = true;

    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    const readLevels = () => {
      if (!bridge) return;
      analyser.getByteFrequencyData(frequencyData);
      const bands = frequencyData;

      const avg = (from: number, to: number) => {
        let sum = 0;
        const count = Math.max(1, to - from + 1);
        for (let i = from; i <= to; i++) sum += bands[i];
        return sum / count / 255;
      };

      // 32 bins: bass ≈ 0-3, mid ≈ 4-11, high ≈ 12-31. Non-linear lift so
      // quiet masters still move the network.
      const levels: AudioLevels = {
        bass: Math.min(1, Math.pow(avg(0, 3), 0.8) * 1.6),
        mid: Math.min(1, Math.pow(avg(4, 11), 0.8) * 1.5),
        high: Math.min(1, Math.pow(avg(12, 31), 0.8) * 1.4),
      };
      setSystemAudio(levels, true);
    };

    readLevels();
    bridge.pollTimer = window.setInterval(readLevels, POLL_MS);
  } catch (error) {
    console.warn('[indii] Audio bridge could not start:', error);
    stopBridge();
  }
}

function stopBridge() {
  if (!bridge) return;
  const { context, analyser, source, pollTimer, element } = bridge;
  if (pollTimer !== null) window.clearInterval(pollTimer);
  try {
    analyser?.disconnect();
    // createMediaElementSource reroutes the element's output through the
    // graph; restore a direct path so the playing track stays audible.
    if (source && context && context.state !== 'closed') {
      source.connect(context.destination);
    }
  } catch {
    /* noop */
  }
  const canCloseContext = element ? element.paused || element.ended : true;
  bridge = null;
  if (element) {
    // Allow a fresh bridge on a later replay of the same element.
    (element as HTMLAudioElement & { __indiiBridgeAttached?: boolean }).__indiiBridgeAttached = false;
  }
  if (canCloseContext) {
    void context?.close().catch(() => {
      /* noop */
    });
  }
  setSystemAudio({ bass: 0, mid: 0, high: 0 }, false);
}

export function initAudioBridge() {
  if (typeof window === 'undefined') return () => undefined;

  const onStart = (event: Event) => {
    const detail = (event as CustomEvent<{ element?: HTMLAudioElement }>).detail;
    const element = detail?.element;
    if (!element || element === bridge?.element) return;
    // Guard against re-tapping an element that already has a MediaElementSource.
    if ((element as HTMLAudioElement & { __indiiBridgeAttached?: boolean }).__indiiBridgeAttached) return;
    startBridge(element);
  };

  const onStop = () => stopBridge();

  window.addEventListener(AUDIO_START_EVENT, onStart);
  window.addEventListener(AUDIO_STOP_EVENT, onStop);

  return () => {
    window.removeEventListener(AUDIO_START_EVENT, onStart);
    window.removeEventListener(AUDIO_STOP_EVENT, onStop);
    stopBridge();
  };
}
