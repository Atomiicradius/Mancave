// Single manifest for every asset path. Paths are resolved against Vite's base URL.
const url = (p) => `${import.meta.env.BASE_URL}${p}`;

export const ASSETS = {
  // One entry per album on the wall (6). `name` ties together public/covers/<name>.jpg and public/audio/<name>.mp3.
  // The .wav is the synthesized placeholder loop (scripts/gen-audio.mjs); audio tries each file in order.
  // A missing cover falls back to a generated gradient.
  tracks: Array.from({ length: 6 }, (_, i) => {
    const name = `track-${String(i + 1).padStart(2, '0')}`;
    return {
      name,
      title: `Placeholder Track ${i + 1}`,
      cover: url(`covers/${name}.jpg`),
      audio: [url(`audio/${name}.mp3`), url(`audio/${name}.wav`)],
    };
  }),
  stockfish: url('stockfish/stockfish-19-lite-single.js'),
  // Set `file` to a .glb under public/models/ to replace the placeholder; null keeps the box placeholder.
  // `fit`: the model is scaled uniformly to fit `size` (x,y,z meters), bottom-centered at `pos`, rotated by `rotY` first
  //   (car models usually need rotY so the nose points along +x or -x).
  // `hide`: placeholder mesh names to retire. `interactable`: tags the model's meshes for the click system.
  models: {
    car: {
      file: url('models/nsx.glb'), // optimized from source-models/2017_honda_nsx.glb via scripts/optimize-glb.mjs
      fit: { size: [4.4, 1.2, 1.9], pos: [0, 0.02, 0], rotY: Math.PI / 2 },  // model's long axis is z; flip to -Math.PI / 2 if the nose points the wrong way
      hide: ['car-body', 'car-cabin'],
    },
    turntable: {
      // Pioneer-style turntable with its dust cover; optimized from source-models/vinyl_player_pioneer.glb.
      // Sits on the wooden console (top at y = 0.7). rotY: the model's front faces +z, so +PI/2 turns it to face +x (the room).
      file: url('models/turntable.glb'),
      fit: { size: [0.4, 0.46, 0.52], pos: [-3.8, 0.7, -1.0], rotY: Math.PI / 2 },
      hide: ['turntable-placeholder', 'platter-placeholder'],
      interactable: 'turntable',
    },
  },
  textures: {},
};
