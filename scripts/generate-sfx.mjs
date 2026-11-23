import fs from "node:fs/promises";
import path from "node:path";

function writeWav(samples, sampleRate = 22050) {
  const numSamples = samples.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  return buffer;
}

function makeWhoosh(sampleRate = 22050) {
  const duration = 0.36;
  const count = Math.floor(sampleRate * duration);
  const out = new Float32Array(count);
  let lp = 0;
  let hpPrev = 0;
  let phase = 0;
  let seed = 1337;

  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed / 2147483647) * 2 - 1;
  };

  for (let i = 0; i < count; i++) {
    const p = i / count;
    const env = Math.pow(Math.sin(Math.PI * p), 1.6);
    const cutoff = 220 + 1700 * Math.sin(Math.PI * p);
    const alpha = Math.min(0.85, (2 * Math.PI * cutoff) / sampleRate);
    const white = rand();
    lp = lp + alpha * (white - lp);
    const band = lp - hpPrev * 0.65;
    hpPrev = lp;

    const freq = 130 + 190 * Math.sin(Math.PI * p);
    phase += (2 * Math.PI * freq) / sampleRate;
    const sub = Math.sin(phase) * 0.22;

    out[i] = (band * 0.85 + sub) * env * 0.6;
  }
  return writeWav(out, sampleRate);
}

function makePop(sampleRate = 22050) {
  const duration = 0.13;
  const count = Math.floor(sampleRate * duration);
  const out = new Float32Array(count);
  let phase = 0;

  for (let i = 0; i < count; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t / 0.006);
    const decay = Math.exp(-t * 30);
    const freq = 360 + 520 * Math.min(1, t / 0.045);
    phase += (2 * Math.PI * freq) / sampleRate;
    out[i] = Math.sin(phase) * attack * decay * 0.65;
  }
  return writeWav(out, sampleRate);
}

const outDir = path.resolve("public", "sfx");
await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(path.join(outDir, "whoosh.wav"), makeWhoosh());
await fs.writeFile(path.join(outDir, "pop.wav"), makePop());
console.log("SFX generados en public/sfx/");
