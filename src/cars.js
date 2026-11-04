// The swappable cars. Order = swap order (next/prev wrap around). To add a real model:
//   1. drop the .glb into public/models/cars/  (Draco-compressed is fine; keep it under ~90k triangles and ~1-2 MB)
//   2. set `file` to it (and remove `box`), then tune scale / rotationY / positionOffset until it sits right on the platform
//   3. fill in `credit` (it feeds the in-page credits panel; CREDITS.md needs the same line)
//
// Fields
//   id               unique key
//   name, year       shown on the info card (year may be null)
//   file             url of the .glb, or null for a placeholder box car (uses `box`)
//   scale            multiplier on top of the automatic fit-to-platform size (CAR_FIT); 1 = fills a 4.4 x 1.2 x 1.9 m box
//   rotationY        radians; the model's long axis must end up along +x. Most glb cars need +/- PI/2 (see NSX below)
//   positionOffset   [x, y, z] meters, nudge from the platform center (y is height above the platform surface)
//   description      one line for the info card
//   credit           { title, by, url, license, note } or null (placeholders have none)
const url = (p) => `${import.meta.env.BASE_URL}${p}`;

// Every car is scaled to fit this box (meters: x = length, y = height, z = width) before `scale` is applied.
export const CAR_FIT = { size: [4.4, 1.2, 1.9] };

export const CARS = [
  {
    id: 'nsx',
    name: 'Acura NSX',
    year: 2017,
    file: url('models/cars/nsx.glb'),
    scale: 1,
    rotationY: Math.PI / 2, // this model's long axis is z; flip to -Math.PI / 2 if the nose points the wrong way
    positionOffset: [0, 0, 0],
    description: 'Hybrid mid-engine supercar: a twin-turbo V6 and three electric motors.',
    credit: {
      title: '2017 Honda NSX',
      by: 'Ddiaz Design',
      url: 'https://sketchfab.com/3d-models/2017-honda-nsx-e9411dfa29f745d6a69021d8ce19d2e7',
      license: 'CC BY-NC-SA 4.0',
      note: 'Modified: reduced polygon count, re-encoded textures, compressed. Shared under the same licence.',
    },
  },
  {
    id: 'p1',
    name: 'McLaren P1',
    year: 2013,
    file: url('models/cars/mclaren-p1.glb'),
    scale: 1.08, // the P1 is wide for its length, so it needs a slightly bigger box to reach the same length as the others
    rotationY: Math.PI / 2,
    positionOffset: [0, 0, 0],
    description: 'Hybrid hypercar: a twin-turbo V8 plus an electric motor, around 900 hp.',
    credit: { title: 'McLaren P1', by: '', url: '', license: '', note: 'Modified: polygon count reduced, textures re-encoded.' }, // TODO: author / source / licence
  },
  {
    id: 'willys',
    name: 'Willys Jeep',
    year: 1941,
    file: url('models/cars/willys-jeep.glb'),
    scale: 1.5, // much taller than the sports cars, so the fit box is scaled up (it ends up ~4 m long, ~1.8 m tall)
    rotationY: -Math.PI / 2, // this model's nose is on its -z side, the opposite of the others
    positionOffset: [0, 0, 0],
    description: 'The wartime 4x4 that started the Jeep legend: light, simple and nearly unstoppable.',
    credit: { title: 'Willys Jeep', by: '', url: '', license: '', note: 'Modified: polygon count reduced, textures re-encoded.' }, // TODO: author / source / licence
  },
  {
    id: 'impala',
    name: 'Chevrolet Impala',
    year: 1967,
    file: url('models/cars/chevy-impala.glb'),
    scale: 1.28, // tall for its length, so the box is scaled up to keep it ~4.4 m long
    rotationY: Math.PI / 2,
    positionOffset: [0, 0, 0],
    description: 'A full-size American cruiser: long, low and unmistakably 1960s.',
    credit: { title: 'Chevrolet Impala 1967', by: '', url: '', license: '', note: 'Modified: textures re-encoded, wheels simplified.' }, // TODO: author / source / licence
  },
];
