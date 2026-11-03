// Generates 6 short looping placeholder tracks into public/audio/ (royalty-free: synthesized here).
// Replace them with real tracks and update src/assets.js.
import { writeFileSync, mkdirSync } from 'node:fs';

const RATE = 11025;
const SECONDS = 8;
const roots = [110, 123.47, 130.81, 146.83, 164.81, 98];
const minor = [0, 3, 7, 10, 12, 15, 19];

mkdirSync('public/audio', { recursive: true });
roots.forEach((root, t) => {
  const n = RATE * SECONDS;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  const step = 0.25 + (t % 3) * 0.05; // seconds per note
  for (let i = 0; i < n; i++) {
    const time = i / RATE;
    const k = Math.floor(time / step);
    const semis = minor[(k * (2 + (t % 3)) + t) % minor.length];
    const f = root * 2 ** (semis / 12);
    const local = (time % step) / step;
    const env = Math.exp(-local * 4);
    const bass = Math.sin(2 * Math.PI * root * 0.5 * time) * 0.3;
    const lead = (Math.sin(2 * Math.PI * f * time) + 0.4 * Math.sin(4 * Math.PI * f * time)) * 0.3 * env;
    buf.writeInt16LE(Math.round((bass + lead) * 0.8 * 32767), 44 + i * 2);
  }
  writeFileSync(`public/audio/track-${String(t + 1).padStart(2, '0')}.wav`, buf);
});
