// Advanced High-Energy Web Audio API Engine with Volume Control & Dynamic BGM
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.85; // Default 85% volume
    this.masterGain = null;
    this.bgmGain = null;
    this.sfxGain = null;
    this.bgmTimer = null;
    this.currentBgmType = null;
    this.isUnlocked = false;

    // Auto-unlock audio on any user interaction (Mobile & Desktop Safari/Chrome policy)
    const unlockAudio = () => {
      this.init();
      if (this.ctx && this.ctx.state === 'running') {
        this.isUnlocked = true;
        ['click', 'touchstart', 'touchend', 'keydown', 'pointerdown'].forEach(ev => {
          window.removeEventListener(ev, unlockAudio);
        });
      }
    };
    ['click', 'touchstart', 'touchend', 'keydown', 'pointerdown'].forEach(ev => {
      window.addEventListener(ev, unlockAudio, { passive: true });
    });
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // BGM Gain (Boosted for full, rich energy)
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(0.65, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);

      // SFX Gain (Punchy, crisp)
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.9, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(percent) {
    this.volume = Math.max(0, Math.min(1, percent / 100));
    this.enabled = (this.volume > 0);
    this.init();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
    return this.volume;
  }

  toggleMute() {
    if (this.volume > 0) {
      this._prevVolume = this.volume;
      this.setVolume(0);
      return false;
    } else {
      this.setVolume((this._prevVolume || 0.85) * 100);
      return true;
    }
  }

  // --- SOUND EFFECTS (SFX) ---

  // Button Pop & Feedback
  playPop() {
    if (!this.enabled) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch(e) {}
  }

  // Clock Tick
  playTick() {
    if (!this.enabled) return;
    this.init();
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch(e) {}
  }

  // Urgent Tension Tick (<5s remaining)
  playUrgentTick() {
    if (!this.enabled) return;
    this.init();
    try {
      // Sub Thump
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.1);
      gain1.gain.setValueAtTime(0.5, this.ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      osc1.connect(gain1);
      gain1.connect(this.sfxGain);
      osc1.start();
      osc1.stop(this.ctx.currentTime + 0.1);

      // Warning Beep
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(1046.50, this.ctx.currentTime + 0.08);
      gain2.gain.setValueAtTime(0.25, this.ctx.currentTime + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.18);
      osc2.connect(gain2);
      gain2.connect(this.sfxGain);
      osc2.start(this.ctx.currentTime + 0.08);
      osc2.stop(this.ctx.currentTime + 0.18);
    } catch(e) {}
  }

  // Countdown Beep (3, 2, 1)
  playCountdown(count) {
    if (!this.enabled) return;
    this.init();
    try {
      const isGo = (count === 1 || count === 0);
      const freq = isGo ? 1046.50 : 659.25;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isGo ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (isGo) {
        osc.frequency.linearRampToValueAtTime(1318.51, this.ctx.currentTime + 0.35);
      }
      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (isGo ? 0.45 : 0.25));
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start();
      osc.stop(this.ctx.currentTime + (isGo ? 0.45 : 0.25));
    } catch(e) {}
  }

  // LOUDER, HIGH-ENERGY CORRECT ANSWER SOUND (Major 9th Fanfare & Sparkle)
  playCorrect() {
    if (!this.enabled) return;
    this.init();
    this.stopBGM();
    try {
      // Sub Punch on Correct
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(261.63, this.ctx.currentTime); // C4
      subGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      subGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
      sub.connect(subGain);
      subGain.connect(this.sfxGain);
      sub.start();
      sub.stop(this.ctx.currentTime + 0.4);

      // Shimmering Bell Arpeggio
      const chordNotes = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00]; // C5, E5, G5, C6, E6, G6, C7
      chordNotes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        const start = this.ctx.currentTime + idx * 0.05;
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.35, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(start);
        osc.stop(start + 0.55);
      });
    } catch(e) {}
  }

  // LOUDER, PUNCHY INCORRECT ANSWER SOUND (Wah-wah Slide Down)
  playIncorrect() {
    if (!this.enabled) return;
    this.init();
    this.stopBGM();
    try {
      const pitches = [349.23, 311.13, 277.18, 220.00]; // F4 -> Eb4 -> Db4 -> A3
      pitches.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        const t = this.ctx.currentTime + idx * 0.1;
        osc.frequency.setValueAtTime(f, t);
        osc.frequency.linearRampToValueAtTime(f - 25, t + 0.15);
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.15);
      });
    } catch(e) {}
  }

  // Grand Finale Fanfare
  playFanfare() {
    if (!this.enabled) return;
    this.init();
    this.stopBGM();
    try {
      const fanfare = [
        { f: 523.25, d: 0.15 },
        { f: 523.25, d: 0.15 },
        { f: 523.25, d: 0.15 },
        { f: 659.25, d: 0.4 },
        { f: 587.33, d: 0.18 },
        { f: 659.25, d: 0.18 },
        { f: 783.99, d: 0.75 }
      ];
      let t = this.ctx.currentTime;
      fanfare.forEach(n => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.f, t);
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + n.d);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + n.d);
        t += n.d;
      });
    } catch(e) {}
  }

  // --- DYNAMIC BACKGROUND MUSIC SYNTHESIZER ---

  stopBGM() {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.currentBgmType = null;
  }

  // Richer Upbeat Lobby Groove (Booster Synth & Bass)
  startLobbyBGM() {
    if (!this.enabled || this.currentBgmType === 'lobby') return;
    this.init();
    this.stopBGM();
    this.currentBgmType = 'lobby';

    const bassScale = [130.81, 146.83, 164.81, 196.00]; // C3, D3, E3, G3
    const leadScale = [523.25, 659.25, 783.99, 880.00, 1046.50]; // C5, E5, G5, A5, C6
    let step = 0;

    this.bgmTimer = setInterval(() => {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;

      // Pumping Bass Synth
      if (step % 2 === 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(bassScale[(step / 2) % bassScale.length], t);
        gain.gain.setValueAtTime(0.32, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(this.bgmGain);
        osc.start(t);
        osc.stop(t + 0.3);
      }

      // Snare / Click Beat
      const noiseOsc = this.ctx.createOscillator();
      const noiseGain = this.ctx.createGain();
      noiseOsc.type = 'sine';
      noiseOsc.frequency.setValueAtTime(step % 4 === 2 ? 2200 : 1600, t);
      noiseGain.gain.setValueAtTime(0.06, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      noiseOsc.connect(noiseGain);
      noiseGain.connect(this.bgmGain);
      noiseOsc.start(t);
      noiseOsc.stop(t + 0.05);

      // Lead Melody Chords
      if (step % 4 === 1 || step % 4 === 3) {
        const lead = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        lead.type = 'sine';
        lead.frequency.setValueAtTime(leadScale[(step * 3) % leadScale.length], t);
        leadGain.gain.setValueAtTime(0.18, t);
        leadGain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        lead.connect(leadGain);
        leadGain.connect(this.bgmGain);
        lead.start(t);
        lead.stop(t + 0.2);
      }

      step = (step + 1) % 16;
    }, 260); // Energetic tempo
  }

  // Richer Suspense Quiz Game Rhythm
  startQuizBGM() {
    if (!this.enabled || this.currentBgmType === 'quiz') return;
    this.init();
    this.stopBGM();
    this.currentBgmType = 'quiz';

    const rootPitches = [220.00, 246.94, 261.63, 293.66]; // A3, B3, C4, D4
    let step = 0;

    this.bgmTimer = setInterval(() => {
      if (!this.enabled || !this.ctx) return;
      const t = this.ctx.currentTime;

      // Pulse Bass
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      const root = rootPitches[Math.floor(step / 8) % rootPitches.length];
      osc.frequency.setValueAtTime(root, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(t);
      osc.stop(t + 0.16);

      // High Ticking Rhythm
      const tick = this.ctx.createOscillator();
      const tickGain = this.ctx.createGain();
      tick.type = 'square';
      tick.frequency.setValueAtTime(step % 2 === 0 ? 880 : 440, t);
      tickGain.gain.setValueAtTime(0.05, t);
      tickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      tick.connect(tickGain);
      tickGain.connect(this.bgmGain);
      tick.start(t);
      tick.stop(t + 0.05);

      step = (step + 1) % 32;
    }, 210); // Suspense fast tempo
  }
}

// Lightweight Confetti
class ConfettiCannon {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.animationId = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  fire(durationMs = 4000) {
    if (!this.canvas) return;
    this.resize();
    const colors = ['#003366', '#005baa', '#d97706', '#10b981', '#ef4444', '#f59e0b'];
    const count = 100;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: window.innerWidth * 0.5 + (Math.random() - 0.5) * 200,
        y: window.innerHeight * 0.5 + (Math.random() - 0.5) * 100,
        w: Math.random() * 8 + 6,
        h: Math.random() * 5 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 14 - 6,
        rotation: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        alpha: 1
      });
    }

    if (!this.animationId) {
      const loop = () => {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.particles.forEach(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.42;
          p.rotation += p.vRot;
          p.alpha -= 0.007;

          this.ctx.save();
          this.ctx.translate(p.x, p.y);
          this.ctx.rotate((p.rotation * Math.PI) / 180);
          this.ctx.globalAlpha = Math.max(0, p.alpha);
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          this.ctx.restore();
        });

        this.particles = this.particles.filter(p => p.alpha > 0 && p.y < window.innerHeight);

        if (this.particles.length > 0) {
          this.animationId = requestAnimationFrame(loop);
        } else {
          this.animationId = null;
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
      };
      this.animationId = requestAnimationFrame(loop);
    }
  }
}

window.soundFX = new SoundEngine();
window.confettiCannon = new ConfettiCannon('confetti-canvas');
