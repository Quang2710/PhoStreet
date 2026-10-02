// ===== Âm thanh tổng hợp bằng WebAudio (không cần file ngoài) =====
export const Audio = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null, noiseBuf = null;
  let musicOn = true, musicTimer = null, nextNoteTime = 0, step = 0;
  let ttsOn = true, viVoice = null;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    pickVoice();
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = pickVoice;
  }

  function pickVoice() {
    if (!window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices();
    viVoice = vs.find(v => /^vi/i.test(v.lang)) || null;
  }

  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, when = 0, dest = null) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol = 0.3, freq = 1000, q = 1, type = 'bandpass', when = 0, dest = null) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxGain);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const sfx = {
    pick: () => tone(660, 0.08, 'triangle', 0.25, 880),
    drop: () => tone(440, 0.09, 'triangle', 0.2, 300),
    chop: () => { noise(0.05, 0.35, 2500, 2); tone(180, 0.05, 'square', 0.08); },
    bump: () => { noise(0.25, 0.6, 400, 0.7, 'lowpass'); tone(160, 0.25, 'sine', 0.5, 50); },
    bigbump: () => { noise(0.4, 0.8, 300, 0.5, 'lowpass'); tone(120, 0.4, 'sawtooth', 0.25, 40); tone(900, 0.3, 'sine', 0.15, 1800, 0.05); },
    boing: () => tone(220, 0.3, 'sine', 0.35, 660),
    slip: () => { tone(900, 0.5, 'sine', 0.3, 150); noise(0.3, 0.2, 3000, 3); },
    serve: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'triangle', 0.25, null, i * 0.07)); },
    wrong: () => { tone(220, 0.25, 'square', 0.15); tone(180, 0.3, 'square', 0.15, null, 0.15); },
    expire: () => { tone(400, 0.4, 'sawtooth', 0.15, 120); },
    sizzle: () => noise(0.25, 0.07, 6000, 0.6, 'highpass'),
    done: () => { tone(1046, 0.12, 'sine', 0.2); tone(1318, 0.15, 'sine', 0.2, null, 0.1); },
    burnWarn: () => tone(1400, 0.08, 'square', 0.08),
    burnt: () => { noise(0.5, 0.3, 500, 0.5, 'lowpass'); tone(300, 0.5, 'sawtooth', 0.12, 80); },
    throw: () => noise(0.18, 0.2, 1500, 1.5),
    catch: () => { tone(880, 0.06, 'triangle', 0.25); tone(1320, 0.1, 'triangle', 0.25, null, 0.05); },
    splash: () => { noise(0.5, 0.45, 800, 0.6); noise(0.3, 0.3, 2500, 1, 'bandpass', 0.05); },
    whistle: () => { for (let i = 0; i < 3; i++) tone(2800, 0.15, 'sine', 0.25, 3100, i * 0.2); },
    horn: () => { tone(420, 0.25, 'square', 0.18); tone(520, 0.25, 'square', 0.14); tone(420, 0.35, 'square', 0.18, null, 0.32); tone(520, 0.35, 'square', 0.14, null, 0.32); },
    engine: () => { tone(90, 1.2, 'sawtooth', 0.18, 240); noise(1.2, 0.15, 400, 1, 'lowpass'); },
    alert: () => { tone(880, 0.12, 'square', 0.12); tone(660, 0.12, 'square', 0.12, null, 0.15); tone(880, 0.12, 'square', 0.12, null, 0.3); },
    pop: () => tone(500, 0.12, 'sine', 0.25, 1200),
    thunder: () => { noise(1.6, 0.6, 120, 0.3, 'lowpass'); noise(0.3, 0.3, 900, 0.5, 'lowpass', 0.05); },
    powerdown: () => tone(600, 0.8, 'sawtooth', 0.15, 40),
    powerup: () => tone(80, 0.6, 'sawtooth', 0.12, 700),
    firecracker: () => { for (let i = 0; i < 7; i++) noise(0.06, 0.7, 2000 + Math.random() * 2000, 0.8, 'bandpass', i * (0.05 + Math.random() * 0.07)); },
    wave: () => noise(1.5, 0.35, 500, 0.4, 'lowpass'),
    laugh: () => { for (let i = 0; i < 4; i++) tone(700 + i * 30, 0.08, 'triangle', 0.12, 900, i * 0.11); },
    grumble: () => tone(140, 0.4, 'sawtooth', 0.1, 110),
    countdown: () => tone(660, 0.15, 'square', 0.15),
    go: () => tone(1320, 0.4, 'square', 0.15),
    star: () => tone(1568, 0.3, 'triangle', 0.25, 2093),
    dash: () => noise(0.15, 0.18, 1200, 0.8),
  };

  function play(name) { if (ctx && sfx[name]) sfx[name](); }

  // ---- Nhạc nền: giai điệu ngũ cung kiểu đàn bầu (sine luyến) + nhịp điện tử ----
  const BPM = 104, STEP = 60 / BPM / 2; // nốt móc đơn
  const SCALE = [261.63, 293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 783.99]; // C D F G A (ngũ cung)
  const MELODY = [4, -1, 5, 4, 3, -1, 2, 3, 4, -1, 6, 5, 4, 3, 2, -1, 0, -1, 2, 3, 4, -1, 3, 2, 1, -1, 2, 0, 1, -1, -1, -1];
  const BASS = [0, 0, 3, 3, 4, 4, 2, 2];

  function danBau(freq, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine';
    // luyến: trượt từ dưới lên như tay nhấn cần đàn bầu
    o.frequency.setValueAtTime(freq * 0.94, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.08);
    lfo.frequency.value = 5.5; lg.gain.value = freq * 0.012;
    lfo.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicGain);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  function scheduleMusic() {
    if (!ctx) return;
    while (nextNoteTime < ctx.currentTime + 0.2) {
      const t = nextNoteTime, s = step % 32;
      const m = MELODY[s];
      if (m >= 0) danBau(SCALE[m] * 2, t, STEP * 1.8);
      // kick
      if (s % 4 === 0) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.2);
      }
      // hi-hat
      if (s % 2 === 1) noise(0.04, 0.08, 8000, 1, 'highpass', t - ctx.currentTime, musicGain);
      // clap
      if (s % 8 === 4) noise(0.12, 0.18, 1500, 0.8, 'bandpass', t - ctx.currentTime, musicGain);
      // bass
      if (s % 4 === 0) tone(SCALE[BASS[(s / 4) | 0]] / 2, STEP * 3.5, 'triangle', 0.22, null, t - ctx.currentTime, musicGain);
      nextNoteTime += STEP; step++;
    }
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    nextNoteTime = ctx.currentTime + 0.1; step = 0;
    musicTimer = setInterval(() => { if (musicOn) scheduleMusic(); else nextNoteTime = ctx.currentTime + 0.1; }, 50);
  }
  function stopMusic() { clearInterval(musicTimer); musicTimer = null; }
  function setMusic(on) { musicOn = on; if (musicGain) musicGain.gain.value = on ? 0.32 : 0; }
  function setTTS(on) { ttsOn = on; }

  let lastSpeak = 0;
  function speak(text) {
    if (!ttsOn || !viVoice || !window.speechSynthesis) return;
    const now = performance.now();
    if (now - lastSpeak < 900) return;
    lastSpeak = now;
    const clean = text.replace(/[^\p{L}\p{N}\s!?,.]/gu, '').trim();
    if (!clean) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.voice = viVoice; u.lang = viVoice.lang; u.rate = 1.25; u.pitch = 1.3; u.volume = 0.9;
    speechSynthesis.speak(u);
  }

  return {
    init, play, startMusic, stopMusic, setMusic, setTTS, speak,
    get musicOn() { return musicOn; }, get ttsOn() { return ttsOn; }, get hasViVoice() { return !!viVoice; },
  };
})();
