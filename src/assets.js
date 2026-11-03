// Single manifest for every asset path. Paths are resolved against Vite's base URL.
const url = (p) => `${import.meta.env.BASE_URL}${p}`;

export const ASSETS = {
  // Placeholder synthesized loops (scripts/gen-audio.mjs); swap for real tracks.
  tracks: Array.from({ length: 10 }, (_, i) => ({
    title: `Placeholder Track ${i + 1}`,
    file: url(`audio/track-${String(i + 1).padStart(2, '0')}.wav`),
  })),
  stockfish: url('stockfish/stockfish-19-lite-single.js'),
  // Set `file` to a .glb under public/models/ to replace the placeholder; null keeps the box placeholder.
  // `fit`: the model is scaled uniformly to fit `size` (x,y,z meters), bottom-centered at `pos`, rotated by `rotY` first
  //   (car models usually need rotY so the nose points along +x or -x).
  // `hide`: placeholder mesh names to retire. `interactable`: tags the model's meshes for the click system.
  models: {
    car: {
      file: null, // e.g. url('models/nsx.glb')
      fit: { size: [4.4, 1.2, 1.9], pos: [0, 0.02, 0], rotY: 0 },
      hide: ['car-body', 'car-cabin'],
    },
    turntable: {
      file: null, // e.g. url('models/turntable.glb')
      fit: { size: [0.45, 0.25, 0.55], pos: [-3.7, 0.9, 1.9], rotY: 0 },
      hide: ['turntable', 'platter'],
      interactable: 'turntable',
    },
    shelf: {
      file: null, // e.g. url('models/shelf.glb'); vinyl records are positioned on its front face (x = -3.59)
      fit: { size: [0.4, 2.0, 2.4], pos: [-3.8, 0, -0.8], rotY: 0 },
      hide: ['shelf'],
    },
  },
  textures: {},
};
