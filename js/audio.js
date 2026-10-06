/* ============================================================
 * audio.js — เอฟเฟกต์เสียงสังเคราะห์ด้วย Web Audio (ไม่ต้องมีไฟล์เสียง)
 * ============================================================ */
window.FR = window.FR || {};

FR.Audio = (function () {
  'use strict';
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let muted = false;
  const VOLUME = 0.5;

  // ต้องเรียกจาก event ที่ผู้เล่นกด/แตะ เบราว์เซอร์ถึงจะยอมให้เล่นเสียง
  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ctx = new AC();
      } catch (e) {
        ctx = null;
        return;
      }
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume().catch(function () {});
  }

  function ready() {
    return ctx && ctx.state === 'running' && !muted;
  }

  function tone(f0, f1, dur, type, vol, when) {
    const t = ctx.currentTime + (when || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function noise(dur, vol, freq, when, attack) {
    const t = ctx.currentTime + (when || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  const SOUNDS = {
    jump: function () { tone(360, 760, 0.14, 'square', 0.07); },
    land: function () { noise(0.18, 0.22, 1100); tone(150, 80, 0.08, 'sine', 0.12); },
    duck: function () { tone(260, 150, 0.08, 'triangle', 0.08); },
    hit: function () { tone(440, 60, 0.45, 'sawtooth', 0.14); noise(0.4, 0.3, 700); },
    milestone: function () { tone(880, 0, 0.09, 'square', 0.06); tone(1320, 0, 0.16, 'square', 0.06, 0.09); },
    select: function () { tone(620, 0, 0.06, 'triangle', 0.12); },
    start: function () {
      [523, 659, 784, 1047].forEach(function (f, i) { tone(f, 0, 0.12, 'square', 0.06, i * 0.07); });
    },
    record: function () {
      [784, 988, 1175, 1568].forEach(function (f, i) { tone(f, 0, 0.16, 'triangle', 0.12, i * 0.09); });
    },
    pause: function () { tone(520, 330, 0.12, 'triangle', 0.1); },
    thunder: function () { noise(1.8, 0.28, 160, 0.35, 0.08); },
  };

  function play(name) {
    if (!ready() || !SOUNDS[name]) return;
    try {
      SOUNDS[name]();
    } catch (e) {
      /* เสียงพังต้องไม่ทำให้เกมพัง */
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : VOLUME;
  }

  return {
    unlock: unlock,
    play: play,
    setMuted: setMuted,
    isMuted: function () { return muted; },
  };
})();
