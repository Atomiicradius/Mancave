// Makes a web-friendly copy of a heavy .glb:
//   node scripts/optimize-glb.mjs <in.glb> <out.glb> [triangleRatio=0.5]
// - merges duplicates, welds vertices, simplifies meshes to `triangleRatio` of the original triangle count
// - replaces KHR_materials_transmission (extra full-scene render pass, costly on phones) with plain alpha blending
// - re-encodes textures as 512px max WebP, then Draco-compresses geometry
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, textureCompress, draco, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const [input, output, ratioArg] = process.argv.slice(2);
const ratio = Number(ratioArg ?? 0.5);

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

const doc = await io.read(input);

const countTris = () =>
  doc.getRoot().listMeshes().reduce(
    (n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0),
    0
  );
const before = Math.round(countTris());

// Transmission -> alpha blend (keeps a see-through tinted window without the extra render pass).
for (const mat of doc.getRoot().listMaterials()) {
  if (!mat.getExtension('KHR_materials_transmission')) continue;
  mat.setExtension('KHR_materials_transmission', null);
  const c = mat.getBaseColorFactor();
  mat.setBaseColorFactor([c[0] * 0.3, c[1] * 0.3, c[2] * 0.3, 0.35]).setAlphaMode('BLEND').setDoubleSided(true);
  console.log(`transmission -> blend: ${mat.getName()}`);
}

await doc.transform(
  dedup(),
  weld(),
  simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002 }),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512] }),
  draco()
);

await io.write(output, doc);
const b = getBounds(doc.getRoot().listScenes()[0]);
console.log(`triangles ${before} -> ${Math.round(countTris())}; size`, b.max.map((v, i) => +(v - b.min[i]).toFixed(3)));
