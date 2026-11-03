# Credits

| Asset | Source | License |
|---|---|---|
| Three.js | https://threejs.org | MIT |
| chess.js | https://github.com/jhlywa/chess.js | BSD-2-Clause |
| Stockfish.js 19 (lite, single-threaded) in `public/stockfish/` | https://github.com/nmrugg/stockfish.js | **GPL-3.0** — if you distribute the site, the GPL requires offering the engine's corresponding source; link to the repo above and keep the license notice |
| `public/audio/track-*.wav` | Synthesized by `scripts/gen-audio.mjs` | Original / public domain placeholders |
| Draco decoder in `public/draco/` | three.js examples (Google Draco) | Apache-2.0 |
| `public/models/cars/nsx.glb` — "2017 Honda NSX" by Ddiaz Design, https://sketchfab.com/3d-models/2017-honda-nsx-e9411dfa29f745d6a69021d8ce19d2e7 | Sketchfab | **CC BY-NC-SA 4.0** (https://creativecommons.org/licenses/by-nc-sa/4.0/) — attribution required; **non-commercial only**; adaptations must be shared under the same licence. Modified: triangle count reduced (~191k → ~63k), glass transmission replaced with alpha blending, textures re-encoded to WebP, Draco-compressed (`scripts/optimize-glb.mjs`). Original kept in `source-models/`. |
| `public/models/turntable.glb` — "vinyl_player_pioneer" (Pioneer-style turntable), supplied by the project owner | **TODO: author, source URL and licence not yet recorded — fill in before publishing** | Modified: textures re-encoded to WebP (512px), Draco-compressed (`scripts/optimize-glb.mjs`); the tonearm and record are split out at runtime so they can move. Original kept in `source-models/`. |
| `public/models/chessboard.glb` — chessboard with pieces, supplied by the project owner | **TODO: author, source URL and licence not yet recorded — fill in before publishing** | Modified: ~95k → ~10k triangles, textures 4096px PNG → 1024px WebP, Draco-compressed (`scripts/optimize-scene-glb.mjs`). Original kept locally in `source-models/` (git-ignored: 87 MB). |
| `public/models/computer.glb` — desk, monitor, keyboard, PC tower, supplied by the project owner | **TODO: author, source URL and licence not yet recorded — fill in before publishing** | Modified: ~555k → ~22k triangles (the mouse alone was ~530k), 4096px JPEG atlas → 1024px WebP, empty camera/light nodes removed, Draco-compressed. The monitor screen is given a cyan emissive glow at runtime. Original kept locally in `source-models/` (git-ignored: 26 MB). |
| `public/models/cabinet.glb` — half-round console table ("classical cabinet"), supplied by the project owner | **TODO: author, source URL and licence not yet recorded — fill in before publishing** | Modified: texture re-encoded as WebP, Draco-compressed. Original in `source-models/`. |

## Swappable cars
Each car in `src/cars.js` carries its own `credit` (title, author, source URL, licence, note); the in-page credits panel is generated from
those, so a car's credit shows up automatically once its `file` is set. **Add a matching row here for every real car model you add**
(the three placeholder box cars are procedural and need none). Check each licence: the NSX is non-commercial (CC BY-NC-SA).
| `public/models/neon-signs.glb` — multi-sign neon collage, supplied by the project owner | **TODO: author, source URL and licence not yet recorded — fill in before publishing** | Modified: ~355k → ~17k triangles (`scripts/optimize-scene-glb.mjs`); emissive colors boosted at runtime. Original (10.7 MB) kept locally in `source-models/` (git-ignored). |
| `public/models/neon-sign-animated.glb` — animated LED blade sign, supplied by the project owner | **TODO: author, source URL and licence not yet recorded — fill in before publishing** | Modified: bracket arms shortened by 0.58 model units (`scripts/shorten-sign-arms.mjs`), textures re-encoded as WebP, Draco-compressed; animation unchanged. Original kept in `source-models/`. |
| `public/models/lamp-tall.glb` — "modern lamp" (chess table), supplied by the project owner | **TODO: author, source URL and licence not yet recorded — fill in before publishing** | Modified: ~6.8k → ~2.2k triangles. Original kept in `source-models/`. |
| `public/models/lamp-desk.glb` — "modern lamp 2" (desk), supplied by the project owner | **TODO: author, source URL and licence not yet recorded — fill in before publishing** | Modified: ~3.1k → ~1.5k triangles. Original kept in `source-models/`. |
