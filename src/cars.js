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
    id: 'car-2',
    name: 'Placeholder Coupe',
    year: null,
    file: null,
    box: { color: 0x2f6bff },
    scale: 1,
    rotationY: 0,
    positionOffset: [0, 0, 0],
    description: 'Placeholder box car #2: swap in a real model in src/cars.js.',
    credit: null,
  },
  {
    id: 'car-3',
    name: 'Placeholder Roadster',
    year: null,
    file: null,
    box: { color: 0xe83a5f },
    scale: 1,
    rotationY: 0,
    positionOffset: [0, 0, 0],
    description: 'Placeholder box car #3: swap in a real model in src/cars.js.',
    credit: null,
  },
  {
    id: 'car-4',
    name: 'Placeholder GT',
    year: null,
    file: null,
    box: { color: 0x3fd08a },
    scale: 1,
    rotationY: 0,
    positionOffset: [0, 0, 0],
    description: 'Placeholder box car #4: swap in a real model in src/cars.js.',
    credit: null,
  },
];
