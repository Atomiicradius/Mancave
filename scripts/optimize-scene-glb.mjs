// Web-optimizes a multi-mesh scene model (props with many parts) without flattening small meshes:
//   node scripts/optimize-scene-glb.mjs <in.glb> <out.glb> [--tex 1024] [--ratio 0.25 --ratio-min 1000] [--big 20000 --big-target 1500]
// - removes empty camera/light nodes some exporters leave behind
// - --ratio R: primitives with >= --ratio-min triangles keep a fraction R of them (small parts such as boards stay exact)
// - --big N / --big-target T: primitives with more than N triangles are cut down to T (e.g. a 500k-triangle mouse)
// - re-encodes textures as WebP at most --tex px, then Draco-compresses geometry
// (scripts/optimize-glb.mjs is the simpler whole-model version used for the car and turntable.)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, compactPrimitive, textureCompress, draco, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const [input, output, ...rest] = process.argv.slice(2);
const opt = (name, def) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? Number(rest[i + 1]) : def;
};
const TEX = opt('tex', 1024);
const RATIO = opt('ratio', 1);
const RATIO_MIN = opt('ratio-min', 1000);
const BIG = opt('big', Infinity);
const BIG_TARGET = opt('big-target', 1500);
const ERROR = opt('error', 0.05); // error budget (relative) for --ratio meshes; raise it if the target count isn't reached
const BIG_ERROR = opt('big-error', 1); // error budget for the huge parts (sloppy simplifier)

await MeshoptSimplifier.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });
const doc = await io.read(input);
const root = doc.getRoot();

const countTris = () =>
  root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);
const before = Math.round(countTris());

for (const node of root.listNodes()) {
  if (node.getCamera() || (!node.getMesh() && /^(light|camera)$/i.test(node.getName()))) {
    node.listChildren().forEach((c) => !c.getMesh() && c.dispose());
    node.dispose();
  }
}

await doc.transform(weld());

for (const prim of root.listMeshes().flatMap((m) => m.listPrimitives())) {
  const indices = prim.getIndices();
  if (!indices) continue;
  const tris = indices.getCount() / 3;
  let target = null;
  if (tris > BIG) target = BIG_TARGET;
  else if (RATIO < 1 && tris >= RATIO_MIN) target = Math.floor(tris * RATIO);
  if (!target || target >= tris) continue;

  const pos = prim.getAttribute('POSITION').getArray();
  const uv = prim.getAttribute('TEXCOORD_0')?.getArray();
  const nor = prim.getAttribute('NORMAL')?.getArray();
  const n = pos.length / 3;
  // Interleave uv + normal so texture seams and shading survive the simplification.
  const stride = (uv ? 2 : 0) + (nor ? 3 : 0);
  const attrs = new Float32Array(n * stride);
  for (let i = 0; i < n; i++) {
    let o = i * stride;
    if (uv) { attrs[o++] = uv[i * 2]; attrs[o++] = uv[i * 2 + 1]; }
    if (nor) { attrs[o++] = nor[i * 3]; attrs[o++] = nor[i * 3 + 1]; attrs[o++] = nor[i * 3 + 2]; }
  }
  const weights = [...(uv ? [1, 1] : []), ...(nor ? [0.5, 0.5, 0.5] : [])];
  let out;
  if (tris > BIG) {
    // Dense/messy parts (e.g. a 500k-triangle mouse): the attribute-aware simplifier stalls, and its 'Prune' flag deleted the
    // whole body once, so use the sloppy simplifier, which always reaches the target count.
    [out] = MeshoptSimplifier.simplifySloppy(Uint32Array.from(indices.getArray()), new Float32Array(pos), 3, null, target * 3, BIG_ERROR);
  } else {
    [out] = MeshoptSimplifier.simplifyWithAttributes(
      Uint32Array.from(indices.getArray()),
      new Float32Array(pos),
      3,
      attrs,
      stride,
      weights,
      null,
      target * 3,
      ERROR, // relative error budget; the target count is what usually decides
      []
    );
  }
  indices.setArray(out);
  compactPrimitive(prim);
}

await doc.transform(
  dedup(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX] }),
  draco()
);

await io.write(output, doc);
const scene = root.getDefaultScene() ?? root.listScenes()[0];
const b = getBounds(scene);
console.log(`triangles ${before} -> ${Math.round(countTris())}; size`, b.max.map((v, i) => +(v - b.min[i]).toFixed(3)).join(' x '));
