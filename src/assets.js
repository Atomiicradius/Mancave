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
    // Source files are far too heavy for the web, so these are optimized copies (originals in source-models/):
    //   scripts/optimize-scene-glb.mjs <in> <out> [--tex N] [--ratio R --ratio-min N] [--big N --big-target N]
    cabinet: {
      // Cabinet the chessboard sits on, against the right wall. Its front is +z in the model, so -PI/2 turns it to face -x (the room).
      file: url('models/cabinet.glb'),
      fit: { size: [0.5, 1.1, 0.95], pos: [3.75, 0, 0], rotY: -Math.PI / 2 },
      hide: ['counter'],
    },
    chessboard: {
      // Sits on the cabinet top (~1.086 m after the cabinet fit). Clicking it opens the chess overlay.
      file: url('models/chessboard.glb'),
      fit: { size: [0.4, 0.2, 0.4], pos: [3.75, 1.086, 0], rotY: Math.PI / 2 }, // rotY: white starts on the model's -z side; +PI/2 puts it on the player's side (-x)
      hide: ['chessboard'],
      interactable: 'chess',
    },
    computer: {
      // Desk + monitor + keyboard + PC on the back wall. Only the monitor and keyboard are clickable (opens the portfolio).
      file: url('models/computer.glb'),
      fit: { size: [1.9, 1.45, 0.8], pos: [0, 0, -2.6], rotY: -Math.PI / 2 }, // the monitor faces +z (the room) with -PI/2; +PI/2 would face the wall
      hide: ['desk', 'monitor', 'monitor-screen', 'monitor-stand'],
      interactable: 'computer',
      interactableMatch: /^(monitor|keyboard|keys)/i, // node/mesh names inside the model
    },
  },
  textures: {},
};
