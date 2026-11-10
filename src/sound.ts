// Tiny Web Audio sound kit, so no audio files are needed. Muted by default.
let ctx: AudioContext | null = null;
let enabled = false;

function audio() {
  if (!enabled) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const sound = {
  setEnabled(value: boolean) {
    enabled = value;
    if (value) audio();
  },

  whoosh(seconds = 10) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    const buffer = a.createBuffer(1, a.sampleRate * seconds, a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = a.createBufferSource();
    noise.buffer = buffer;
    const filter = a.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(180, t);
    filter.frequency.exponentialRampToValueAtTime(1300, t + seconds * 0.55);
    filter.frequency.exponentialRampToValueAtTime(140, t + seconds);
    const gain = a.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.28, t + seconds * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    noise.connect(filter).connect(gain).connect(a.destination);
    noise.start(t);
    noise.stop(t + seconds);

    const rumble = a.createOscillator();
    const rumbleGain = a.createGain();
    rumble.frequency.value = 48;
    rumbleGain.gain.setValueAtTime(0.0001, t);
    rumbleGain.gain.exponentialRampToValueAtTime(0.12, t + seconds * 0.6);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    rumble.connect(rumbleGain).connect(a.destination);
    rumble.start(t);
    rumble.stop(t + seconds);
  },

  pop() {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046, t);
    osc.frequency.exponentialRampToValueAtTime(523, t + 0.18);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  },
};
