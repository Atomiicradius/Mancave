// Writes a tiny colored-box .glb for checking the model pipeline: node scripts/make-test-glb.mjs <out.glb> [sx sy sz]
import { writeFileSync } from 'node:fs';

const [out, sx = 2, sy = 1, sz = 3] = process.argv.slice(2);
const h = [sx / 2, sy / 2, sz / 2].map(Number);
const pos = [];
const idx = [];
// 6 faces, 4 verts each (flat-shaded normals omitted; viewer computes none, so we add them)
const nor = [];
const faces = [
  [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
  [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
  [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]],
  [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
  [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
  [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
];
faces.forEach(([n, vs], f) => {
  vs.forEach((v) => { pos.push(v[0] * h[0], v[1] * h[1], v[2] * h[2]); nor.push(...n); });
  const b = f * 4;
  idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
});

const posBuf = Buffer.from(new Float32Array(pos).buffer);
const norBuf = Buffer.from(new Float32Array(nor).buffer);
const idxBuf = Buffer.from(new Uint16Array(idx).buffer);
const bin = Buffer.concat([posBuf, norBuf, idxBuf]);
const pad = (b, ch) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, ch)]);

const json = {
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.2, 0.9, 0.4, 1], metallicFactor: 0.1, roughnessFactor: 0.6 } }],
  buffers: [{ byteLength: bin.length }],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: posBuf.length },
    { buffer: 0, byteOffset: posBuf.length, byteLength: norBuf.length },
    { buffer: 0, byteOffset: posBuf.length + norBuf.length, byteLength: idxBuf.length },
  ],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: h.map((v) => -v), max: h },
    { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' },
  ],
};
const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
const binChunk = pad(bin, 0);
const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
const head = Buffer.alloc(12);
head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.write(type, 4, 'latin1'); return b; };
writeFileSync(out, Buffer.concat([head, ch(jsonChunk.length, 'JSON'), jsonChunk, ch(binChunk.length, 'BIN\0'), binChunk]));
