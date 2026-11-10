// Tiny WebAudio soundscape: a low city murmur. Off until the visitor opts in.
let ctx: AudioContext | null = null;
let master: GainNode;
let murmurFilter: BiquadFilterNode;

function noise(seconds: number, brown = false) {
  const c = ctx!;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    last = brown ? (last + 0.02 * w) / 1.02 : w;
    d[i] = brown ? last * 3.5 : w;
  }
  return buf;
}

export function setSound(on: boolean) {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const src = ctx.createBufferSource();
    src.buffer = noise(6, true);
    src.loop = true;
    murmurFilter = ctx.createBiquadFilter();
    murmurFilter.type = 'lowpass';
    murmurFilter.frequency.value = 380;
    const g = ctx.createGain();
    g.gain.value = 0.35;
    src.connect(murmurFilter).connect(g).connect(master);
    src.start();
  }
  if (on) void ctx.resume();
  master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.5);
}

export function setMood(tone: 'past' | 'modern' | 'future' | 'street') {
  if (!ctx) return;
  const f = { past: 260, modern: 520, future: 1100, street: 420 }[tone];
  murmurFilter.frequency.setTargetAtTime(f, ctx.currentTime, 0.8);
}
