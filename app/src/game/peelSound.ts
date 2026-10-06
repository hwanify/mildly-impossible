// Synthesized tape sounds: a looped stick-slip crackle whose rate, pitch and
// loudness follow the peel speed, plus tiny clicks for the nail. Client only.
export class PeelSound {
  private ctx: AudioContext;
  private src: AudioBufferSourceNode;
  private filter: BiquadFilterNode;
  private gain: GainNode;
  muted = false;

  constructor() {
    this.ctx = new AudioContext();
    const sr = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sr * 2, sr);
    const d = buf.getChannelData(0);
    let env = 0;
    for (let i = 0; i < d.length; i++) {
      if (Math.random() < 0.0045) env = 0.55 + Math.random() * 0.45;
      env *= 0.955;
      d[i] = (Math.random() * 2 - 1) * (0.12 + env);
    }
    this.src = this.ctx.createBufferSource();
    this.src.buffer = buf;
    this.src.loop = true;
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "bandpass";
    this.filter.Q.value = 0.7;
    this.filter.frequency.value = 1400;
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;
    this.src.connect(this.filter).connect(this.gain).connect(this.ctx.destination);
    this.src.start();
  }

  resume() {
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  update(speed: number) {
    const k = this.muted ? 0 : Math.max(0, Math.min(1, (speed - 0.0012) / 0.012));
    const t = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(k * 0.4, t, 0.025);
    this.src.playbackRate.setTargetAtTime(0.45 + k * 1.7, t, 0.05);
    this.filter.frequency.setTargetAtTime(900 + k * 3200, t, 0.05);
  }

  click(freq: number, vol = 0.05) {
    if (this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(this.ctx.destination);
    o.start();
    o.stop(t + 0.06);
  }

  dispose() {
    void this.ctx.close();
  }
}
