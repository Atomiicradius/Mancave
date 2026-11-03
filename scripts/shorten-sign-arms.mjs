// Shortens the bracket arms of the animated blade sign so its panel sits closer to the wall:
//   node scripts/shorten-sign-arms.mjs <in.glb> <out.glb> [shift=0.58]
// The arms are two boxes whose only vertices are at their ends, so shifting every vertex past x = 1.0 (the mounting plate end)
// and the separate holder node toward the panel by `shift` model units shortens them cleanly without touching the panel.
// (Model units: the panel is 1.24 wide; at the in-game scale of ~0.47, 0.58 units is ~27 cm. The original arm length is 1.0.)
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const [input, output, shiftArg] = process.argv.slice(2);
const shift = Number(shiftArg ?? 0.58);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(input);
const find = (name) => doc.getRoot().listNodes().find((n) => n.getName() === name);

const body = find('Object_36'); // frame + arms + plate end, merged into one mesh
const pos = body.getMesh().listPrimitives()[0].getAttribute('POSITION');
const v = [0, 0, 0];
let moved = 0;
for (let i = 0; i < pos.getCount(); i++) {
  pos.getElement(i, v);
  if (v[0] > 1.0) { v[0] -= shift; pos.setElement(i, v); moved++; }
}
const holder = find('Holder_17'); // the mounting bar, a separate node
const t = holder.getTranslation();
holder.setTranslation([t[0] - shift, t[1], t[2]]);
console.log(`shifted ${moved} body vertices and the holder by -${shift}`);
await io.write(output, doc);
