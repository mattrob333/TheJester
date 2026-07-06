import { bus } from "./events";

/**
 * Synthesized sound effects — zero audio assets, everything is generated
 * with the WebAudio API (oscillators + filtered noise). Event-driven off the
 * game bus, same decoupling as every other system: nothing calls into this
 * module except `initSound()` (which must run inside a user gesture, e.g.
 * the title screen's start button, because browsers gate AudioContext on
 * interaction).
 *
 * Design: tiny percussive envelopes, everything through a master gain at a
 * polite volume. The lockdown siren is the only sustained sound and stops
 * itself when lockdown clears.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let subscribed = false;

const MASTER_VOLUME = 0.35;

/** Call from a user gesture (title button). Safe to call repeatedly. */
export function initSound() {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return; // no audio support — game plays silent
    }
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);

    // 1s of white noise, reused by every noise-based effect.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    if (!subscribed) {
      subscribed = true;
      subscribe();
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function env(gain: GainNode, t0: number, peak: number, decay: number) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
}

function blip(freqStart: number, freqEnd: number, decay: number, peak = 0.5, type: OscillatorType = "square") {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + decay);
  env(gain, t0, peak, decay);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + decay + 0.05);
}

function noiseBurst(decay: number, peak = 0.5, filterFreq = 2000, filterType: BiquadFilterType = "lowpass") {
  if (!ctx || !master || !noiseBuffer) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  env(gain, t0, peak, decay);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
  src.stop(t0 + decay + 0.05);
}

// --- lockdown siren (the one sustained sound) -----------------------------
let sirenOsc: OscillatorNode | null = null;
let sirenLfo: OscillatorNode | null = null;
let sirenGain: GainNode | null = null;

function startSiren() {
  if (!ctx || !master || sirenOsc) return;
  sirenOsc = ctx.createOscillator();
  sirenLfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  sirenGain = ctx.createGain();
  sirenOsc.type = "sawtooth";
  sirenOsc.frequency.value = 520;
  sirenLfo.frequency.value = 1.6; // wail rate
  lfoGain.gain.value = 160; // wail depth (Hz)
  sirenLfo.connect(lfoGain).connect(sirenOsc.frequency);
  sirenGain.gain.value = 0.06;
  sirenOsc.connect(sirenGain).connect(master);
  sirenOsc.start();
  sirenLfo.start();
}

function stopSiren() {
  if (!ctx) return;
  if (sirenGain) sirenGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
  const osc = sirenOsc;
  const lfo = sirenLfo;
  if (osc) osc.stop(ctx.currentTime + 0.5);
  if (lfo) lfo.stop(ctx.currentTime + 0.5);
  sirenOsc = null;
  sirenLfo = null;
  sirenGain = null;
}

/** Stops any sustained sounds (siren) — called on run reset. */
export function resetSound() {
  stopSiren();
}

function subscribe() {
  bus.on("shotFired", ({ owner }) => {
    if (owner === "player") {
      blip(900, 220, 0.09, 0.25);
    } else {
      blip(500, 140, 0.14, 0.3, "sawtooth");
    }
  });

  bus.on("playerDamaged", ({ amount }) => {
    noiseBurst(0.18, Math.min(0.7, 0.3 + amount * 0.01), 700);
    blip(160, 60, 0.18, 0.4, "triangle");
  });

  bus.on("enemyKilled", () => {
    noiseBurst(0.5, 0.7, 1600);
    blip(320, 40, 0.5, 0.5, "sawtooth");
  });

  bus.on("checkpointReached", () => {
    blip(660, 660, 0.12, 0.3, "sine");
    setTimeout(() => blip(990, 990, 0.2, 0.3, "sine"), 110);
  });

  bus.on("playerDied", () => {
    blip(400, 60, 0.9, 0.5, "sawtooth");
    noiseBurst(0.7, 0.5, 900);
  });

  bus.on("runWon", () => {
    // Little three-note fanfare.
    blip(523, 523, 0.18, 0.35, "triangle");
    setTimeout(() => blip(659, 659, 0.18, 0.35, "triangle"), 160);
    setTimeout(() => blip(784, 784, 0.45, 0.4, "triangle"), 320);
  });

  bus.on("suspicionThreshold", ({ level }) => {
    if (level === "warning") blip(880, 880, 0.25, 0.25, "sine");
  });

  bus.on("lockdownActive", ({ on }) => {
    if (on) startSiren();
    else stopSiren();
  });
}
