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
  echo = ac.createDelay(1); echo.delayTime.value = 0.22;
  const fb = ac.createGain(); fb.gain.value = 0.2; echo.connect(fb); fb.connect(echo); echo.connect(musBus);
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
  shoot: t => tone('triangle', vary(520, 0.04), 430, 0.025, 0.012, { at: t }),   // barely there: a faint tick to feel the rhythm of firing
  hit: t => noise(0.035, 0.05, 'bandpass', vary(2600, 0.2), 1800, { at: t }),
  kill: t => { tone('triangle', vary(330, 0.15), 70, 0.13, 0.13, { at: t }); noise(0.07, 0.06, 'highpass', 1500, 900, { at: t }); },
  gem: t => { // quick pickups climb in pitch
    gemRun = t - gemAt < 0.35 ? Math.min(gemRun + 1, 12) : 0; gemAt = t;
    const f = hz(81 + gemRun); tone('sine', f, f * 1.5, 0.07, 0.06, { at: t });
  },
  hurt: t => { tone('sawtooth', 220, 55, 0.22, 0.22, { at: t }); noise(0.12, 0.14, 'lowpass', 1200, 300, { at: t }); },
  boom: t => { noise(0.55, 0.45, 'lowpass', 1400, 60, { at: t }); tone('sine', 130, 28, 0.5, 0.4, { at: t }); },
  allyDown: t => tone('triangle', 520, 140, 0.32, 0.14, { at: t }),
  level: t => { notes([69, 73, 76, 81, 85, 88], 0.05, 0.3, 0.1, 'triangle', t); notes([57, 64], 0.15, 0.5, 0.1, 'square', t); noise(0.5, 0.05, 'highpass', 3000, 9000, { at: t }); },
  pick: t => notes([76, 83], 0.05, 0.12, 0.09, 'square', t),
  ui: t => tone('sine', 620, 700, 0.04, 0.06, { at: t }),
  power: t => notes([72, 76, 79, 84], 0.045, 0.22, 0.11, 'square', t),
  // What you hear when the cards land, by the best rarity on offer.
  rare: t => notes([76, 83], 0.07, 0.3, 0.09, 'triangle', t),
  epic: t => { notes([72, 79, 84, 91], 0.06, 0.35, 0.1, 'triangle', t); noise(0.3, 0.05, 'highpass', 5000, 9000, { at: t }); },
  legendary: t => { notes([60, 67, 72, 76, 79, 84, 88, 96], 0.07, 0.6, 0.12, 'square', t); notes([48, 55, 60], 0.2, 1.2, 0.16, 'sawtooth', t); noise(0.9, 0.08, 'highpass', 3000, 10000, { at: t }); },
  ult: t => { notes([45, 52, 57, 64, 69, 76], 0.05, 0.7, 0.14, 'sawtooth', t); noise(0.8, 0.14, 'lowpass', 300, 4000, { at: t }); tone('sine', 70, 40, 0.8, 0.4, { at: t }); },
  streak: t => notes([81, 88, 93], 0.045, 0.2, 0.1, 'square', t),
  sweep: t => noise(0.12, 0.16, 'bandpass', 900, 3200, { at: t }),
  bolt: t => { noise(0.1, 0.2, 'highpass', 3000, 5000, { at: t }); tone('square', 1400, 200, 0.12, 0.07, { at: t }); },
  dash: t => noise(0.16, 0.16, 'bandpass', 500, 4000, { at: t }),
  slowmo: t => tone('sine', 600, 90, 0.7, 0.2, { at: t }),
  windup: t => tone('sawtooth', 140, 420, 0.3, 0.07, { at: t, lp: 1400 }),
  thud: t => { noise(0.14, 0.3, 'lowpass', 400, 90, { at: t }); tone('sine', 110, 50, 0.16, 0.3, { at: t }); },
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
const GAP = { sweep: 0.05, bolt: 0.08, windup: 0.12, hit: 0.05, kill: 0.04, gem: 0.03, shoot: 0.05, boom: 0.08, hurt: 0.1, ui: 0.03 };
const lastAt = {};

export function sfx(name, delay = 0) {
  if (!ac || muted || !SFX[name]) return;
  const t = ac.currentTime + delay;
  if (t - (lastAt[name] ?? -1) < (GAP[name] || 0)) return;
  lastAt[name] = t; SFX[name](t);
}

// ---------- soundtrack ----------
// Chiptune, like an old console: a pulse lead with a real tune, a triangle bass, a quiet arpeggio and noise drums.
// Each bar is [bass root, chord, melody]. The melody has 8 slots (eighth notes): a note, 0 = rest, -1 = hold.
const Am = [57, 60, 64], F = [53, 57, 60], C = [60, 64, 67], G = [55, 59, 62], Em = [52, 55, 59], E = [52, 56, 59], Bb = [58, 62, 65];
const SONGS = {
  main: [ // 16 bars: an 8-bar tune, then an 8-bar lift that climbs and falls back into it
    [45, Am, [76, -1, 69, 72, 76, -1, 74, 72]], [41, F, [72, -1, 69, 72, 77, -1, 76, 72]],
    [48, C, [76, -1, 72, 76, 79, -1, 76, 74]], [43, G, [74, -1, 71, 74, 79, 74, 71, 74]],
    [45, Am, [76, -1, 69, 72, 76, -1, 81, 79]], [41, F, [77, -1, 76, 77, 81, -1, 77, 76]],
    [43, G, [74, -1, 79, 74, 71, -1, 74, 71]], [45, Am, [69, -1, -1, -1, 72, 71, 69, 0]],
    [41, F, [81, -1, 77, 81, 84, -1, 81, 77]], [43, G, [83, -1, 79, 83, 86, -1, 83, 79]],
    [40, Em, [79, -1, 76, 79, 83, -1, 79, 76]], [45, Am, [81, -1, 76, 72, 69, -1, 72, 76]],
    [41, F, [77, -1, 81, 77, 72, -1, 77, 81]], [43, G, [79, -1, 83, 79, 74, -1, 79, 83]],
    [40, E, [80, -1, 76, 80, 83, -1, 80, 83]], [40, E, [88, -1, 86, 83, 80, -1, 76, 0]],
  ],
  boss: [ // 4 tense bars with a pounding low note
    [45, Am, [69, 69, 81, 69, 72, 69, 81, 76]], [46, Bb, [70, 70, 82, 70, 74, 70, 82, 77]],
    [45, Am, [69, 69, 81, 69, 72, 69, 84, 81]], [40, E, [76, 76, 88, 76, 80, 76, 83, 80]],
  ],
};
const BPM = { menu: 104, play: 138, boss: 158, over: 88 };
let cur = { scene: 'menu', level: 0, muffle: false };
let nextTime = 0, stepI = 0, songName = 'main';

export function scene(mode, g) {
  if (!ac) return;
  const inRun = mode === 'play' || mode === 'lvl' || mode === 'pause';
  const s = !inRun ? (mode === 'dead' || mode === 'won' ? 'over' : 'menu') : g && g.boss ? 'boss' : 'play';
  const level = !inRun || !g ? 0 : g.boss ? 3 : g.t < 25 ? 0 : g.t < 70 ? 1 : g.t < 150 ? 2 : 3;
  const muffle = mode === 'pause' || mode === 'lvl' || mode === 'dead';
  if (muffle !== cur.muffle) musFilter.frequency.setTargetAtTime(muffle ? 600 : 18000, ac.currentTime, 0.08);
  cur = { scene: s, level, muffle };
}

// Music is switched off for now: the user disliked both attempts. Sound effects still play.
const MUSIC_ON = false;

function tick() {
  if (!MUSIC_ON || !ac || ac.state !== 'running') return;
  if (nextTime < ac.currentTime) nextTime = ac.currentTime + 0.05; // tab was asleep
  while (nextTime < ac.currentTime + 0.15) {
    const want = cur.scene === 'boss' ? 'boss' : 'main';
    if (want !== songName) { songName = want; stepI = 0; }       // a new tune starts from its first bar
    playStep(stepI, nextTime);
    nextTime += 60 / BPM[cur.scene] / 4;
    stepI = (stepI + 1) % (SONGS[songName].length * 16);
  }
}

// One 16th-note step. Pulse voices go through a low-pass so they sound round, not buzzy.
function playStep(i, t) {
  const { scene: sc, level } = cur, s = i & 15, six = 60 / BPM[sc] / 4;
  const [root, chord, mel] = SONGS[songName][i >> 4];
  const mus = { at: t, out: musBus }, quiet = sc === 'menu' || sc === 'over';
  if (s % 2 === 0) {
    // lead
    const k = s / 2, m = mel[k];
    if (m > 0) {
      let len = 1; while (k + len < 8 && mel[k + len] === -1) len++;
      const dur = six * 2 * len * 0.95;
      tone('square', hz(m), hz(m), dur, quiet ? 0.045 : 0.06, { at: t, out: echo, lp: quiet ? 1400 : 2200, atk: 0.008 });
      tone('triangle', hz(m), hz(m), dur, 0.05, mus);                                  // body under the pulse
      if (level >= 3) tone('square', hz(m + 12), hz(m + 12), dur * 0.6, 0.018, { ...mus, lp: 2600 });
    }
    // bass: bouncing octaves in a run, one long note per half bar on the menu
    if (quiet) { if (s % 8 === 0) tone('triangle', hz(root), hz(root), six * 7, 0.2, mus); }
    else { const b = root + (s % 4 === 2 ? 12 : 0); tone('triangle', hz(b), hz(b), six * 1.8, 0.24, mus); }
  }
  if (quiet) return;
  if (level >= 2) { const a = chord[s % 3] + 12; tone('square', hz(a), hz(a), six * 0.8, 0.014, { ...mus, lp: 1800 }); } // arpeggio
  if (level >= 1 || sc === 'boss') {
    if (s % 4 === 0) tone('triangle', 160, 45, 0.14, 0.45, mus);                         // kick
    if (s % 4 === 2) noise(0.03, 0.035, 'highpass', 8000, 8000, mus);                    // hat
  }
  if (level >= 2 && (s === 4 || s === 12)) noise(0.11, 0.12, 'bandpass', 1900, 1200, mus); // snare
  if (sc === 'boss' && s % 4 === 0) tone('triangle', hz(root - 12), hz(root - 12), six * 3, 0.2, mus);
}

// For browser checks: is the audio clock running, and what is the soundtrack doing.
export const debugState = () => ({ state: ac ? ac.state : 'none', time: ac ? ac.currentTime : 0, step: stepI, song: songName, ...cur });
