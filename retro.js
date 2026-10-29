/* FIRST OFFER retro audio: N64-style soundtrack + fight SFX, all synthesized live (no files).
   Self-contained so it doesn't collide with index.html edits. index.html's sfx() calls Retro.sfx(kind) first.
   Tracks follow the visible screen; fight music ducks under boss voice and while the mic hears you. */
(function () {
  'use strict';
  var ctx = null, master, musicBus, musicDuck, sfxBus, verb, verbSend, comp;
  var muted = false;
  try { muted = localStorage.getItem('fo_muted') === '1'; } catch (e) {}

  // ---------- audio graph ----------
  function impulse(sec, decay) {
    var len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function init() {
    if (ctx) return true;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return false; }
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    verb = ctx.createConvolver(); verb.buffer = impulse(2.4, 2.6);
    var verbOut = ctx.createGain(); verbOut.gain.value = 0.55; verb.connect(verbOut); verbOut.connect(master);
    verbSend = ctx.createGain(); verbSend.gain.value = 1; verbSend.connect(verb);
    musicBus = ctx.createGain(); musicBus.gain.value = 0;
    musicDuck = ctx.createGain(); musicDuck.gain.value = 1;
    musicBus.connect(musicDuck); musicDuck.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(master);
    return true;
  }
  function unlock(e) {
    if (e && e.isTrusted === false) return;
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!started) { started = true; onScreen(); }
  }
  var started = false;
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { document.addEventListener(ev, unlock, true); });

  function setMuted(m) {
    muted = !!m;
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.03);
  }

  // ---------- notes ----------
  var NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(s) {
    var m = /^([A-G])(#|b)?(-?\d)$/.exec(s); if (!m) return null;
    return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); }
  var QUAL = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6], '7b9': [0, 4, 7, 10, 13], sus: [0, 5, 7] };
  function chord(name) {
    var m = /^([A-G])(#|b)?(.*)$/.exec(name);
    var root = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return { root: root, tones: (QUAL[m[3]] || QUAL['']).slice() };
  }
  // tokens: note name, '.' rest, '-' hold. one token = `res` sixteenths
  function parseLine(str, res) {
    var out = [], toks = str.replace(/\|/g, ' ').trim().split(/\s+/), step = 0;
    toks.forEach(function (t) {
      if (t === '-') { if (out.length) out[out.length - 1].len += res; }
      else if (t !== '.') out.push({ step: step, n: midi(t), len: res });
      step += res;
    });
    return out;
  }

  // ---------- instruments ----------
  function env(g, t, a, peak, d, sus, rel, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, d);
    g.gain.setTargetAtTime(0.0001, end, rel);
  }
  function osc(type, f, t, stop, dest, detune) {
    var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.connect(dest); o.start(t); o.stop(stop); return o;
  }
  function lp(f, q) { var x = ctx.createBiquadFilter(); x.type = 'lowpass'; x.frequency.value = f; x.Q.value = q || 0.7; return x; }
  function out(node, dest, send) {
    node.connect(dest);
    if (send) { var s = ctx.createGain(); s.gain.value = send; node.connect(s); s.connect(verbSend); }
  }
  var INST = {
    lead: function (n, t, dur, v, dest, opt) { // detuned brassy saw + vibrato: N64 soundfont lead
      var g = ctx.createGain(), f = lp(opt && opt.bright ? 3600 : 2400, 2), end = t + dur, stop = end + 0.5;
      f.frequency.setValueAtTime(800, t); f.frequency.linearRampToValueAtTime(opt && opt.bright ? 3600 : 2400, t + 0.05);
      f.connect(g); out(g, dest, 0.35);
      env(g, t, 0.012, 0.16 * v, 0.25, 0.7, 0.07, end);
      var vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5.6;
      vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(dur > 0.25 ? 14 : 0, t + Math.min(0.3, dur));
      vib.connect(vg); vib.start(t); vib.stop(stop);
      [-7, 7].forEach(function (dt) { var o = osc('sawtooth', hz(n), t, stop, f, dt); vg.connect(o.detune); });
      osc('square', hz(n - 12), t, stop, f).detune.value = 3;
    },
    bass: function (n, t, dur, v, dest) {
      var g = ctx.createGain(), f = lp(900, 4), end = t + Math.min(dur, 0.4);
      f.frequency.setValueAtTime(1600, t); f.frequency.exponentialRampToValueAtTime(380, t + 0.12);
      f.connect(g); out(g, dest, 0.05);
      env(g, t, 0.004, 0.32 * v, 0.12, 0.55, 0.04, end);
      osc('sawtooth', hz(n), t, end + 0.3, f); osc('triangle', hz(n - 12), t, end + 0.3, f);
    },
    pluck: function (n, t, dur, v, dest) {
      var g = ctx.createGain(), f = lp(5000, 1), end = t + 0.18;
      f.frequency.setValueAtTime(5000, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.15);
      f.connect(g); out(g, dest, 0.4);
      env(g, t, 0.002, 0.07 * v, 0.06, 0.2, 0.05, end);
      osc('square', hz(n), t, end + 0.3, f);
    },
    guitar: function (n, t, dur, v, dest) { // nylon-ish pluck for the Spanish cartridge
      var g = ctx.createGain(), f = lp(3200, 3), end = t + Math.min(dur, 0.6);
      f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(700, t + 0.35);
      f.connect(g); out(g, dest, 0.45);
      env(g, t, 0.002, 0.13 * v, 0.18, 0.15, 0.08, end);
      osc('triangle', hz(n), t, end + 0.4, f); osc('sawtooth', hz(n), t, end + 0.4, f, 4);
    },
    pad: function (n, t, dur, v, dest) {
      var g = ctx.createGain(), f = lp(1300, 0.5), end = t + dur;
      f.connect(g); out(g, dest, 0.9);
      env(g, t, 0.25, 0.045 * v, 0.6, 0.8, 0.3, end);
      osc('sawtooth', hz(n), t, end + 1.2, f, -9); osc('sawtooth', hz(n), t, end + 1.2, f, 9);
    }
  };
  var noiseBuf = null;
  function noise(t, dur, type, freq, q, gain, dest, send) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 1;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); out(g, dest, send);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return { src: s, filter: f, gain: g };
  }
  function thump(t, from, to, dur, gain, dest) {
    var g = ctx.createGain(), o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.1);
  }
  var DRUM = {
    k: function (t, v, d) { thump(t, 150, 42, 0.22, 0.7 * v, d); },
    s: function (t, v, d) { noise(t, 0.16, 'bandpass', 1900, 0.8, 0.32 * v, d, 0.3); thump(t, 230, 160, 0.08, 0.25 * v, d); },
    h: function (t, v, d) { noise(t, 0.04, 'highpass', 8000, 1, 0.09 * v, d); },
    o: function (t, v, d) { noise(t, 0.22, 'highpass', 7000, 1, 0.08 * v, d); },
    c: function (t, v, d) { noise(t, 1.2, 'highpass', 5000, 0.5, 0.16 * v, d, 0.5); },
    t: function (t, v, d) { thump(t, 180, 90, 0.2, 0.45 * v, d); },
    p: function (t, v, d) { noise(t, 0.05, 'bandpass', 2600, 6, 0.4 * v, d, 0.35); }, // castanet / palmas
    x: function (t, v, d) { noise(t, 0.06, 'highpass', 5500, 1, 0.05 * v, d); } // shaker
  };

  // ---------- songs ----------
  // chords: one per bar. lead: 8th-note tokens. drums: 16-step strings per bar (repeated).
  var SONGS = {
    title: { bpm: 128, chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'], leadOpt: { bright: true },
      lead: 'G4 - C5 - E5 - G5 - | F5 - E5 D5 - - B4 - | C5 - E5 - A5 - G5 E5 | F5 - - - E5 D5 C5 - |' +
            'G4 - C5 - E5 - G5 - | A5 - G5 F5 E5 - D5 - | C5 - F5 - A5 - G5 F5 | G5 - - - - - . .',
      bass: [0, null, 12, null, 0, null, 12, null, 0, null, 12, null, 0, null, 12, 7],
      arp: true, pad: true,
      drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, crash: true },
    select: { bpm: 108, swing: 0.16, chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Bbmaj7', 'Am7', 'Gm7', 'C7'],
      lead: 'A5 - . C6 - A5 G5 - | G5 - . . E5 - D5 - | F5 - A5 - C6 - A5 - | G5 - - - . . . . |' +
            'D6 - . C6 - A5 F5 - | E5 - . G5 - E5 C5 - | D5 - F5 - A5 - G5 F5 | E5 - - - . . . .',
      leadVel: 0.7, bass: [0, null, null, 7, null, null, 0, null, null, null, 12, null, 7, null, 5, null],
      arp: true, pad: true,
      drums: { k: 'x.....x...x.....', p: '....x.......x...', x: 'xxxxxxxxxxxxxxxx' } },
    fight: { bpm: 150, chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B'],
      lead: 'E5 - E5 G5 - E5 A5 - | G5 - F#5 - E5 - D5 - | E5 - G5 - B5 - C6 B5 | A5 - F#5 - D5 - F#5 - |' +
            'E5 - E5 G5 - E5 A5 - | B5 - A5 - G5 - F#5 G5 | E5 - G5 - C6 - B5 A5 | B5 - - - D#5 - F#5 -',
      bass: [0, null, 0, 12, null, 0, 0, 12, 0, null, 0, 12, null, 0, 7, 12],
      arp: true, pad: true,
      drums: { k: 'x..x..x.x..x..x.', s: '....x.......x..x', h: 'x.x.x.x.x.x.x.x.' }, crash: true },
    final: { bpm: 164, chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Edim', 'A7b9'], leadOpt: { bright: true },
      lead: 'D5 - F5 - A5 - D6 - | C#6 - D6 - Bb5 - A5 - | G5 - Bb5 - D6 - C6 Bb5 | A5 - - - C#5 - E5 - |' +
            'D5 F5 A5 D6 F6 - E6 D6 | D6 - C#6 - Bb5 - A5 - | G#5 - B5 - D6 - F6 E6 | E6 - - - A5 - C#6 -',
      bass: [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 12, 1, 0],
      arp: true, pad: true,
      drums: { k: 'x.x.x..xx.x.x..x', s: '....x.......x.x.', h: 'xxxxxxxxxxxxxxxx', t: '..............xx' }, crash: true },
    flamenco: { bpm: 138, chords: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'], leadInst: 'guitar', strum: true,
      lead: 'E5 - A5 - C6 - B5 A5 | B5 - D6 - B5 G5 - . | A5 - C6 - A5 F5 E5 F5 | G#5 - - - F5 E5 - . |' +
            'A5 C6 E6 - D6 C6 B5 A5 | G5 B5 D6 - C6 B5 A5 G5 | F5 A5 C6 - B5 A5 G#5 F5 | E5 - - - . . . .',
      bass: [0, null, null, 7, null, null, 0, null, 0, null, 7, null, 12, null, 7, null],
      drums: { k: 'x.......x.......', p: 'x..x..x...x.x...', x: 'x.xxx.xxx.xxx.xx' }, crash: true },
    flamencoFinal: { bpm: 168, chords: ['Am', 'G', 'F', 'E', 'Am', 'G', 'F', 'E'], leadInst: 'guitar', strum: true,
      lead: 'A5 C6 E6 - D6 C6 B5 A5 | G5 B5 D6 - C6 B5 A5 G5 | F5 A5 C6 - B5 A5 G#5 F5 | E5 F5 G#5 B5 D6 - C6 B5 |' +
            'E5 - A5 - C6 - B5 A5 | B5 - D6 - B5 G5 - . | A5 - C6 - A5 F5 E5 F5 | G#5 - - - B5 - E6 -',
      bass: [0, 0, 12, 0, 7, 0, 12, 0, 0, 0, 12, 0, 7, 12, 7, 0],
      pad: true,
      drums: { k: 'x..x..x.x..x..x.', p: 'x..x..x...x.x.xx', s: '....x.......x...', x: 'xxxxxxxxxxxxxxxx' }, crash: true }
  };
  Object.keys(SONGS).forEach(function (k) { SONGS[k].leadNotes = parseLine(SONGS[k].lead, 2); });

  // ---------- sequencer ----------
  var cur = null, curName = '', nextStep = 0, nextTime = 0, timer = null, songGain = null;
  function stepDur(s) { return 60 / s.bpm / 4; }
  function playStep(s, step, t, dest) {
    var bars = s.chords.length, total = bars * 16, st = step % total, bar = Math.floor(st / 16), inBar = st % 16;
    var ch = chord(s.chords[bar]), rootMidi = 36 + ch.root, sd = stepDur(s);
    if (s.swing && inBar % 2 === 1) t += sd * s.swing;
    // lead
    s.leadNotes.forEach(function (n) {
      if (n.step === st && n.n != null) INST[s.leadInst || 'lead'](n.n, t, n.len * sd * 0.95, s.leadVel || 1, dest, s.leadOpt);
    });
    // bass
    var b = s.bass[inBar];
    if (b != null) INST.bass(rootMidi + b, t, sd * 1.6, inBar % 4 === 0 ? 1 : 0.8, dest);
    // arp (16ths through chord tones, 2 octaves)
    if (s.arp) {
      var tones = ch.tones, idx = inBar % (tones.length * 2), oct = idx >= tones.length ? 12 : 0;
      INST.pluck(60 + ch.root + tones[idx % tones.length] + oct, t, sd, 1, dest);
    }
    // flamenco strum on beats 1 and the "and" of 2
    if (s.strum && (inBar === 0 || inBar === 6 || inBar === 10)) {
      ch.tones.concat([12]).forEach(function (iv, i) { INST.guitar(52 + ch.root + iv, t + i * 0.018, sd * 3, 0.7, dest); });
    }
    // pad holds the bar
    if (s.pad && inBar === 0) ch.tones.forEach(function (iv) { INST.pad(60 + ch.root + iv, t, sd * 16, 1, dest); });
    // drums
    Object.keys(s.drums).forEach(function (k) {
      if (s.drums[k][inBar] === 'x') DRUM[k](t, inBar % 4 === 0 ? 1 : 0.75, dest);
    });
    if (s.crash && st === 0) DRUM.c(t, 1, dest);
  }
  function tick() {
    if (!cur || !ctx) return;
    while (nextTime < ctx.currentTime + 0.14) {
      playStep(cur, nextStep, nextTime, songGain);
      nextStep++; nextTime += stepDur(cur);
    }
  }
  function stopMusic(fade) {
    if (songGain && ctx) {
      var g = songGain; g.gain.setTargetAtTime(0.0001, ctx.currentTime, (fade || 0.3) / 3);
      setTimeout(function () { try { g.disconnect(); } catch (e) {} }, (fade || 0.3) * 1000 + 1500);
    }
    songGain = null; cur = null; curName = '';
    clearInterval(timer); timer = null;
  }
  var LEVEL = { title: 0.55, select: 0.45, fight: 0.28, final: 0.3, flamenco: 0.3, flamencoFinal: 0.3 };
  function playSong(name) {
    if (!ctx || name === curName) return;
    stopMusic(0.4);
    var s = SONGS[name]; if (!s) return;
    cur = s; curName = name; nextStep = 0; nextTime = ctx.currentTime + 0.08;
    songGain = ctx.createGain(); songGain.gain.value = 0.0001; songGain.connect(musicBus);
    songGain.gain.setTargetAtTime(1, ctx.currentTime, 0.08);
    musicBus.gain.setTargetAtTime(LEVEL[name] || 0.7, ctx.currentTime, 0.1);
    timer = setInterval(tick, 25); tick();
  }

  // one-shot jingles
  function jingle(kind) {
    if (!ctx) return;
    var t = ctx.currentTime + 0.05, g = ctx.createGain(); g.gain.value = 1; g.connect(musicBus);
    musicBus.gain.setTargetAtTime(0.5, ctx.currentTime, 0.05);
    if (kind === 'win') {
      var q = 60 / 140 / 2;
      [['C5', 0, 1], ['C5', 1, 1], ['C5', 2, 1], ['C5', 3, 2], ['Ab4', 5, 2], ['Bb4', 7, 2], ['C5', 9, 1], ['Bb4', 10, 1], ['C5', 11, 6]].forEach(function (n) {
        INST.lead(midi(n[0]) + 12, t + n[1] * q, n[2] * q * 0.95, 1.1, g, { bright: true });
        INST.lead(midi(n[0]) + 5, t + n[1] * q, n[2] * q * 0.95, 0.5, g);
      });
      [['C', 0], ['Ab', 5], ['Bb', 7], ['C', 9]].forEach(function (c) {
        var ch = chord(c[0]); ch.tones.forEach(function (iv) { INST.pad(60 + ch.root + iv, t + c[1] * q, 3 * q, 2, g); });
        INST.bass(36 + ch.root, t + c[1] * q, q * 2, 1, g);
      });
      DRUM.c(t + 9 * q, 1.2, g); DRUM.k(t + 9 * q, 1, g);
      [0, 1, 2, 3].forEach(function (i) { DRUM.s(t + i * q, 0.6, g); });
    } else {
      var r = 60 / 90 / 2;
      [['E5', 0, 2], ['Eb5', 2, 2], ['D5', 4, 2], ['C#5', 6, 6]].forEach(function (n) { INST.lead(midi(n[0]), t + n[1] * r, n[2] * r, 0.9, g); });
      ['Am', 'Fm'].forEach(function (c, i) { var ch = chord(c); ch.tones.forEach(function (iv) { INST.pad(57 + ch.root + iv, t + i * 4 * r, 5 * r, 2, g); }); });
      INST.bass(33, t + 6 * r, 6 * r, 1, g);
    }
  }

  // ---------- SFX ----------
  function rnd(a) { return 1 + (Math.random() * 2 - 1) * a; }
  function crunch(amount) { // waveshaper for gritty hits
    var w = ctx.createWaveShaper(), n = 1024, c = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i * 2 / n - 1; c[i] = (1 + amount) * x / (1 + amount * Math.abs(x)); }
    w.curve = c; return w;
  }
  function tone(type, f, t, dur, gain, slideTo, dest, send) {
    var g = ctx.createGain(), o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); out(g, dest || sfxBus, send); o.start(t); o.stop(t + dur + 0.05);
  }
  var SFX = {
    select: function (t) { tone('triangle', 988, t, 0.06, 0.18, 0, null, 0.3); tone('triangle', 1480, t + 0.05, 0.09, 0.15, 0, null, 0.3); },
    insert: function (t) { // cartridge pushed into the console
      noise(t, 0.08, 'bandpass', 900, 2, 0.5, sfxBus); thump(t + 0.05, 120, 60, 0.12, 0.6, sfxBus);
      noise(t + 0.06, 0.03, 'highpass', 3000, 1, 0.4, sfxBus);
      tone('square', 523, t + 0.22, 0.08, 0.08, 0, null, 0.4); tone('square', 784, t + 0.3, 0.14, 0.08, 0, null, 0.4);
    },
    start: function (t) {
      tone('square', 988, t, 0.08, 0.12); tone('square', 1319, t + 0.08, 0.35, 0.12, 0, null, 0.3);
      noise(t, 0.6, 'bandpass', 600, 0.7, 0.12, sfxBus, 0.3);
      var sw = noise(t, 0.6, 'bandpass', 400, 4, 0.18, sfxBus, 0.4); sw.filter.frequency.exponentialRampToValueAtTime(5000, t + 0.55);
    },
    fight: function (t) { // round-start gong + brass stab
      thump(t, 90, 40, 0.9, 0.8, sfxBus); noise(t, 1.4, 'lowpass', 1200, 0.5, 0.3, sfxBus, 0.8);
      ['E4', 'B4', 'E5', 'G5'].forEach(function (n) { INST.lead(midi(n), t + 0.18, 0.5, 1.4, sfxBus, { bright: true }); });
      DRUM.c(t + 0.18, 1.3, sfxBus);
    },
    hit: function (t) { // punch: body thump + slap + crack
      var p = rnd(0.12);
      thump(t, 190 * p, 55, 0.14, 0.9, sfxBus);
      noise(t, 0.09, 'lowpass', 2200 * p, 1, 0.55, sfxBus, 0.15);
      noise(t, 0.025, 'highpass', 4000, 1, 0.5, sfxBus);
      tone('square', 300 * p, t, 0.07, 0.08, 120);
    },
    crit: function (t) { // heavy hit, gritty + whoosh-in + ring
      var sh = crunch(30), g = ctx.createGain(); g.gain.value = 0.5; sh.connect(g); out(g, sfxBus, 0.5);
      var w = noise(t - 0.0, 0.12, 'bandpass', 600, 3, 0.25, sfxBus); w.filter.frequency.exponentialRampToValueAtTime(4000, t + 0.1);
      thump(t + 0.08, 220, 38, 0.32, 1, sh);
      noise(t + 0.08, 0.25, 'lowpass', 3000, 1, 0.7, sh);
      tone('sawtooth', 660, t + 0.08, 0.4, 0.06, 1760, null, 0.6);
      tone('triangle', 2093, t + 0.12, 0.6, 0.06, 0, null, 0.8);
    },
    hurt: function (t) { // you get hit: dull body blow + downward buzz
      var sh = crunch(12), g = ctx.createGain(); g.gain.value = 0.55; sh.connect(g); out(g, sfxBus, 0.25);
      thump(t, 140, 40, 0.3, 1, sh); noise(t, 0.14, 'lowpass', 900, 1, 0.6, sh);
      tone('sawtooth', 220, t + 0.03, 0.35, 0.09, 55);
    },
    blip: function (t) { tone('square', 1400 * rnd(0.05), t, 0.025, 0.04); },
    coin: function (t) { tone('square', 988, t, 0.07, 0.1); tone('square', 1319, t + 0.07, 0.3, 0.1, 0, null, 0.3); },
    ko: function (t) { // explosion + slow sub drop + reverb wash
      var sh = crunch(20), g = ctx.createGain(); g.gain.value = 0.6; sh.connect(g); out(g, sfxBus, 0.9);
      thump(t, 120, 25, 1.1, 1, sh);
      var n = noise(t, 1.6, 'lowpass', 6000, 1, 0.8, sh); n.filter.frequency.exponentialRampToValueAtTime(180, t + 1.4);
      noise(t, 0.05, 'highpass', 3000, 1, 0.8, sfxBus);
      DRUM.c(t, 1.4, sfxBus);
    }
  };
  var lastWinner = null, skipSelectUntil = 0, lastKoAt = 0;
  function sfx(kind) {
    if (!ctx || ctx.state !== 'running') return false;
    if (muted) return true;
    var t = ctx.currentTime + 0.005;
    if (kind === 'select' && performance.now() < skipSelectUntil) return true;
    if (kind === 'win') {
      stopMusic(0.15);
      if (performance.now() - lastKoAt < 200) setTimeout(function () { jingle('win'); }, 650); else jingle('win');
      return true;
    }
    if (kind === 'ko') {
      lastKoAt = performance.now(); stopMusic(0.12); SFX.ko(t);
      if (lastWinner === 'boss') setTimeout(function () { jingle('lose'); }, 700);
      return true;
    }
    if (SFX[kind]) { SFX[kind](t); return true; }
    return false;
  }

  // ---------- screen -> track ----------
  function $(id) { return document.getElementById(id); }
  function visible(id) { var el = $(id); return el && !el.classList.contains('hidden'); }
  var koTimer = null;
  function onScreen() {
    if (!ctx || !started) return;
    clearTimeout(koTimer);
    if (visible('title')) playSong('title');
    else if (visible('carts') || visible('fighters') || visible('bosses')) playSong('select');
    else if (visible('fight')) {
      var st = ($('arena') && $('arena').getAttribute('data-stage')) || 'negotiate-0';
      var esp = st.indexOf('espanol') === 0, fin = /-2$/.test(st);
      playSong(esp ? (fin ? 'flamencoFinal' : 'flamenco') : (fin ? 'final' : 'fight'));
    } else if (visible('ko')) koTimer = setTimeout(function () { if (visible('ko')) playSong('select'); }, 3200);
  }
  function watch() {
    var mo = new MutationObserver(onScreen);
    ['title', 'carts', 'fighters', 'bosses', 'fight', 'ko'].forEach(function (id) { var el = $(id); if (el) mo.observe(el, { attributes: true, attributeFilter: ['class'] }); });
    var arena = $('arena');
    if (arena) new MutationObserver(function () {
      if (visible('fight')) { curName = ''; onScreen(); }
    }).observe(arena, { attributes: true, attributeFilter: ['data-stage'] });
    // cartridge insert sound
    document.querySelectorAll('[data-cart]').forEach(function (b) {
      b.addEventListener('click', function () { unlock(); if (ctx && !muted) { SFX.insert(ctx.currentTime); skipSelectUntil = performance.now() + 80; } }, true);
    });
    var mb = $('muteBtn');
    if (mb) mb.addEventListener('click', function () { setTimeout(function () { try { setMuted(localStorage.getItem('fo_muted') === '1'); } catch (e) {} }, 0); });
  }

  // ---------- ducking: boss voice + your mic ----------
  var duckUntil = 0, speaking = false, lastValue = 0;
  function hookEngine() {
    var F = window.FirstOffer; if (!F || !F.on) return;
    F.on('bossLine', function (e) { duckUntil = performance.now() + 2200 + String(e.text || '').length * 85; });
    F.on('interim', function (e) { speaking = !!(e && e.text && e.text !== '…'); });
    F.on('ko', function (e) { lastWinner = e && e.winner; });
    F.on('score', function (e) {
      var v = Number(e && e.value) || 0;
      if (v > lastValue && ctx && !muted && v - lastValue >= 1) setTimeout(function () { sfx('coin'); }, 180);
      lastValue = v;
    });
  }
  setInterval(function () {
    if (!ctx || !musicDuck) return;
    var F = window.FirstOffer, target = 1;
    if (visible('fight')) {
      if (F && F.isListening && F.isListening()) target = 0.5;
      if (performance.now() < duckUntil) target = 0.3;
      if (speaking) target = 0.18;
      if (F && F.isBossTalking && F.isBossTalking()) target = 0.05;
    }
    musicDuck.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
  }, 120);

  function boot() { watch(); hookEngine(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  function level() { // debug: peak level on the master bus (0..1)
    if (!ctx) return -1;
    if (!level.a) { level.a = ctx.createAnalyser(); level.a.fftSize = 2048; comp.connect(level.a); }
    var d = new Float32Array(2048); level.a.getFloatTimeDomainData(d);
    var m = 0; for (var i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); return m;
  }
  window.Retro = { level: level, now: function () { return curName; }, sfx: sfx, playSong: playSong, stopMusic: stopMusic, setMuted: setMuted, jingle: jingle, songs: Object.keys(SONGS) };
})();
