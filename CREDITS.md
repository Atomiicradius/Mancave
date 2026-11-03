# Credits

| Asset | Source | License |
|---|---|---|
| Three.js | https://threejs.org | MIT |
| chess.js | https://github.com/jhlywa/chess.js | BSD-2-Clause |
| Stockfish.js 19 (lite, single-threaded) in `public/stockfish/` | https://github.com/nmrugg/stockfish.js | **GPL-3.0** — if you distribute the site, the GPL requires offering the engine's corresponding source; link to the repo above and keep the license notice |
| `public/audio/track-*.wav` | Synthesized by `scripts/gen-audio.mjs` | Original / public domain placeholders |
| Draco decoder in `public/draco/` | three.js examples (Google Draco) | Apache-2.0 |
| `public/models/nsx.glb` — "2017 Honda NSX" by Ddiaz Design, https://sketchfab.com/3d-models/2017-honda-nsx-e9411dfa29f745d6a69021d8ce19d2e7 | Sketchfab | **CC BY-NC-SA 4.0** (https://creativecommons.org/licenses/by-nc-sa/4.0/) — attribution required; **non-commercial only**; adaptations must be shared under the same licence. Modified: triangle count reduced (~191k → ~86k), glass transmission replaced with alpha blending, textures re-encoded to WebP, Draco-compressed (`scripts/optimize-glb.mjs`). Original kept in `source-models/`. |
| `public/models/turntable.glb` — "vinyl_player_pioneer" (Pioneer-style turntable), supplied by the project owner | **TODO: author, source URL and licence not yet recorded — fill in before publishing** | Modified: textures re-encoded to WebP (512px), Draco-compressed (`scripts/optimize-glb.mjs`); the tonearm and record are split out at runtime so they can move. Original kept in `source-models/`. |
