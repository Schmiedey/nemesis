// All sound is made in code with WebAudio: no audio files.
// sfx(name) plays a one-shot effect. scene(mode, g) steers the soundtrack. Nothing plays until unlock().
const MUTE_KEY = 'nemesis_mute';
let ac = null, master, sfxBus, musBus, musFilter, echo, noiseBuf;
let muted = false;
try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* no storage */ }

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* no storage */ }
  if (ac) master.gain.setTargetAtTime(muted ? 0 : 1, ac.currentTime, 0.02);
  return muted;
}

// Browsers only allow sound after a key press or click, so this is called from those.
export function unlock() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  const comp = ac.createDynamicsCompressor(); comp.connect(ac.destination);
  master = ac.createGain(); master.gain.value = muted ? 0 : 1; master.connect(comp);
  sfxBus = ac.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  musFilter = ac.createBiquadFilter(); musFilter.type = 'lowpass'; musFilter.frequency.value = 18000; musFilter.connect(master);
  musBus = ac.createGain(); musBus.gain.value = 0.5; musBus.connect(musFilter);
  echo = ac.createDelay(1); echo.delayTime.value = 0.28;
  const fb = ac.createGain(); fb.gain.value = 0.35; echo.connect(fb); fb.connect(echo); echo.connect(musBus);
  noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  nextTime = ac.currentTime + 0.1;
  setInterval(tick, 30);
}

// ---------- voices ----------
function env(at, dur, vol, atk = 0.004) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vol, at + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  return g;
}

function tone(type, f0, f1, dur, vol, { at = ac.currentTime, out = sfxBus, atk, lp, detune = 0 } = {}) {
  const o = ac.createOscillator(), g = env(at, dur, vol, atk);
  o.type = type; o.detune.value = detune;
  o.frequency.setValueAtTime(f0, at);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + dur);
  if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); f.connect(g); } else o.connect(g);
  g.connect(out); o.start(at); o.stop(at + dur + 0.03);
  return g;
}

function noise(dur, vol, kind, f0, f1 = f0, { at = ac.currentTime, out = sfxBus } = {}) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = env(at, dur, vol, 0.002);
  s.buffer = noiseBuf; s.loop = true; f.type = kind;
  f.frequency.setValueAtTime(f0, at);
  if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, at + dur);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(at, Math.random() * 0.5); s.stop(at + dur + 0.03);
}

const hz = m => 440 * 2 ** ((m - 69) / 12);
const vary = (f, amt = 0.06) => f * (1 + (Math.random() * 2 - 1) * amt);
const notes = (ms, step, dur, vol, type, at) => ms.forEach((m, i) => tone(type, hz(m), hz(m), dur, vol, { at: at + i * step }));

// ---------- effects ----------
let gemRun = 0, gemAt = 0;
const SFX = {
  shoot: t => tone('square', vary(820), 380, 0.07, 0.035, { at: t }),
  hit: t => noise(0.035, 0.05, 'bandpass', vary(2600, 0.2), 1800, { at: t }),
  kill: t => { tone('triangle', vary(330, 0.15), 70, 0.13, 0.13, { at: t }); noise(0.07, 0.06, 'highpass', 1500, 900, { at: t }); },
  gem: t => { // quick pickups climb in pitch
    gemRun = t - gemAt < 0.35 ? Math.min(gemRun + 1, 12) : 0; gemAt = t;
    const f = hz(81 + gemRun); tone('sine', f, f * 1.5, 0.07, 0.06, { at: t });
  },
  hurt: t => { tone('sawtooth', 220, 55, 0.22, 0.22, { at: t }); noise(0.12, 0.14, 'lowpass', 1200, 300, { at: t }); },
  boom: t => { noise(0.55, 0.45, 'lowpass', 1400, 60, { at: t }); tone('sine', 130, 28, 0.5, 0.4, { at: t }); },
  allyDown: t => tone('triangle', 520, 140, 0.32, 0.14, { at: t }),
  level: t => notes([69, 73, 76, 81], 0.06, 0.28, 0.1, 'triangle', t),
  pick: t => notes([76, 83], 0.05, 0.12, 0.09, 'square', t),
  ui: t => tone('sine', 620, 700, 0.04, 0.06, { at: t }),
  start: t => { tone('sawtooth', 110, 440, 0.3, 0.12, { at: t, lp: 2000 }); noise(0.3, 0.08, 'highpass', 500, 6000, { at: t }); },
  surge: t => { for (let i = 0; i < 2; i++) { tone('sawtooth', 466, 466, 0.16, 0.09, { at: t + i * 0.36, lp: 1800 }); tone('sawtooth', 349, 349, 0.16, 0.09, { at: t + 0.18 + i * 0.36, lp: 1800 }); } },
  ring: t => tone('sawtooth', 320, 120, 0.28, 0.12, { at: t, lp: 1500 }),
  boss: t => {
    tone('sine', 55, 41, 2.4, 0.5, { at: t, atk: 0.4 });
    for (const m of [45, 46, 51]) tone('sawtooth', hz(m), hz(m - 1), 2.2, 0.09, { at: t, atk: 0.6, lp: 900 });
    noise(1.6, 0.18, 'lowpass', 200, 2400, { at: t });
  },
  die: t => { tone('sawtooth', 440, 36, 1.2, 0.25, { at: t, lp: 1600 }); noise(0.9, 0.25, 'lowpass', 3000, 80, { at: t }); },
  win: t => { notes([69, 73, 76, 81, 85, 88], 0.11, 0.5, 0.12, 'triangle', t); notes([45, 57], 0.33, 1.2, 0.2, 'sawtooth', t); },
  stamp: t => { noise(0.12, 0.3, 'lowpass', 500, 120, { at: t }); tone('sine', 90, 45, 0.18, 0.4, { at: t }); notes([76, 81, 88], 0.07, 0.35, 0.08, 'triangle', t + 0.06); },
};
// Shortest allowed gap between two plays of the same effect, in seconds.
const GAP = { hit: 0.05, kill: 0.04, gem: 0.03, shoot: 0.05, boom: 0.08, hurt: 0.1, ui: 0.03 };
const lastAt = {};

export function sfx(name, delay = 0) {
  if (!ac || muted || !SFX[name]) return;
  const t = ac.currentTime + delay;
  if (t - (lastAt[name] ?? -1) < (GAP[name] || 0)) return;
  lastAt[name] = t; SFX[name](t);
}

// ---------- soundtrack ----------
// A four-bar loop in A minor. Layers come in as the run goes on; the boss gets its own chords and tempo.
const PROG = { calm: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], boss: [[57, 60, 64], [58, 62, 65], [57, 60, 64], [52, 56, 59]] };
const BPM = { menu: 96, play: 132, boss: 150, over: 84 };
let cur = { scene: 'menu', level: 0, muffle: false };
let nextTime = 0, stepI = 0;

export function scene(mode, g) {
  if (!ac) return;
  const inRun = mode === 'play' || mode === 'lvl' || mode === 'pause';
  const s = !inRun ? (mode === 'dead' || mode === 'won' ? 'over' : 'menu') : g && g.boss ? 'boss' : 'play';
  const level = !inRun || !g ? 0 : g.boss ? 3 : g.t < 25 ? 0 : g.t < 70 ? 1 : g.t < 150 ? 2 : 3;
  const muffle = mode === 'pause' || mode === 'lvl' || mode === 'dead';
  if (muffle !== cur.muffle) musFilter.frequency.setTargetAtTime(muffle ? 500 : 18000, ac.currentTime, 0.08);
  cur = { scene: s, level, muffle };
}

function tick() {
  if (!ac || ac.state !== 'running') return;
  if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05; // tab was asleep
  while (nextTime < ac.currentTime + 0.15) {
    playStep(stepI, nextTime);
    nextTime += 60 / BPM[cur.scene] / 4;
    stepI = (stepI + 1) % 64;
  }
}

function playStep(i, t) {
  const { scene: sc, level } = cur, s = i & 15, sixteenth = 60 / BPM[sc] / 4;
  const chord = (sc === 'boss' ? PROG.boss : PROG.calm)[i >> 4], root = chord[0] - 24;
  const mus = { at: t, out: musBus };
  if (s === 0) for (const m of chord) for (const dt of [-8, 8]) // pad
    tone('sawtooth', hz(m), hz(m), sixteenth * 16, 0.035, { ...mus, atk: sixteenth * 3, lp: 700, detune: dt });
  if (sc === 'menu' || sc === 'over') {
    if (s % 2 === 0) tone('triangle', hz(chord[(s / 2) % 3] + 12), hz(chord[(s / 2) % 3] + 12), sixteenth * 2.5, 0.07, { at: t, out: echo });
    if (s === 0) tone('sine', hz(root + 12), hz(root + 12), sixteenth * 12, 0.16, mus);
    return;
  }
  // kick and bass: always on during a run
  if (s % 4 === 0) tone('sine', 150, 42, 0.16, 0.5, mus);
  if (s % 2 === 0) { const m = root + (s % 4 === 2 ? 12 : 0); tone('sawtooth', hz(m), hz(m), sixteenth * 1.7, 0.16, { ...mus, lp: 500 + level * 250 }); }
  if (level >= 1) {
    if (s % 4 === 2 || (level >= 2 && s % 2 === 0) || level >= 3) noise(0.03, s % 4 === 2 ? 0.07 : 0.035, 'highpass', 7000, 7000, mus);
    const m = chord[[0, 1, 2, 1][s % 4]] + (level >= 3 ? 24 : 12) + (s >= 8 && s % 4 === 3 ? 12 : 0);
    tone('square', hz(m), hz(m), sixteenth * 0.9, 0.03, { at: t, out: echo, lp: 2400 });
  }
  if (level >= 2 && (s === 4 || s === 12)) { noise(0.13, 0.2, 'bandpass', 1800, 900, mus); tone('triangle', 200, 110, 0.09, 0.14, mus); }
  if (sc === 'boss' && s % 8 === 6) tone('sawtooth', hz(root + 13), hz(root + 12), sixteenth * 2, 0.1, { ...mus, lp: 1200 }); // uneasy stab
}

// For browser checks: is the audio clock running, and what is the soundtrack doing.
export const debugState = () => ({ state: ac ? ac.state : 'none', time: ac ? ac.currentTime : 0, step: stepI, ...cur });
