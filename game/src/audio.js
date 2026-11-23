// Tiny WebAudio synth for Neon Tide: no audio files, everything is
// generated. Created on the first user gesture; silent until then.
export function makeAudio() {
  let ctx = null;
  let muted = false;
  let sirenNodes = null;

  function ensure() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + dur);
  }

  function noise(dur, vol, lowpass) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start();
  }

  return {
    unlock() { ensure(); },
    toggleMute() { muted = !muted; if (!muted) this.siren(false); return muted; },
    isMuted() { return muted; },
    shoot() { noise(0.12, 0.35, 1800); },
    pickup() { tone(660, 0.12, 'sine', 0.25); setTimeout(() => tone(990, 0.18, 'sine', 0.25), 90); },
    cash() { tone(880, 0.1, 'triangle', 0.25); setTimeout(() => tone(1320, 0.22, 'triangle', 0.25), 80); },
    crash() { noise(0.25, 0.4, 500); },
    horn() { tone(320, 0.18, 'square', 0.12, 300); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.25), i * 110)); },
    busted() { tone(220, 0.5, 'sawtooth', 0.2, 110); },
    siren(on) {
      if (!on) { if (sirenNodes) { try { sirenNodes.o.stop(); } catch (e) {} sirenNodes = null; } return; }
      if (muted || sirenNodes) return;
      const c = ensure(); if (!c) return;
      const o = c.createOscillator(); o.type = 'sine';
      const g = c.createGain(); g.gain.value = 0.05;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.8;
      const lg = c.createGain(); lg.gain.value = 350;
      lfo.connect(lg); lg.connect(o.frequency);
      o.frequency.value = 750;
      o.connect(g); g.connect(c.destination);
      o.start(); lfo.start();
      sirenNodes = { o, lfo };
    },
  };
}
