// Shown in the "Credits" panel on the start screen (attribution has to be visible on the live site, not just in CREDITS.md).
// Keep in sync with CREDITS.md. `by`/`url` left empty shows "credit pending" so an unfinished entry is obvious.
import { CARS } from './cars.js';

export const CREDITS = [
  // One entry per car in src/cars.js that has a model file (credit comes from the car's own `credit`).
  ...CARS.filter((car) => car.file).map((car) =>
    car.credit
      ? { name: `${car.credit.title} (3D model)`, by: car.credit.by, url: car.credit.url, license: car.credit.license, note: car.credit.note }
      : { name: `${car.name} (3D model)`, by: '', url: '', license: '', note: 'Credit missing: fill in `credit` in src/cars.js.' }
  ),
  {
    name: 'Turntable (3D model)',
    by: '', // TODO: author
    url: '', // TODO: source link
    license: '', // TODO: licence
    note: 'Modified: textures re-encoded, tonearm and record split out so they can move.',
  },
  {
    name: 'Chessboard and pieces (3D model)',
    by: '', // TODO: author
    url: '', // TODO: source link
    license: '', // TODO: licence
    note: 'Modified: polygon count reduced, textures re-encoded.',
  },
  {
    name: 'Desk, monitor and PC (3D model)',
    by: '', // TODO: author
    url: '', // TODO: source link
    license: '', // TODO: licence
    note: 'Modified: polygon count reduced, textures re-encoded.',
  },
  {
    name: 'Console table (3D model)',
    by: '', // TODO: author
    url: '', // TODO: source link
    license: '', // TODO: licence
    note: 'Modified: texture re-encoded.',
  },
  {
    name: 'Neon sign collage (3D model)',
    by: '', // TODO: author
    url: '', // TODO: source link
    license: '', // TODO: licence
    note: 'Modified: polygon count reduced.',
  },
  {
    name: 'Animated LED sign (3D model)',
    by: '', // TODO: author
    url: '', // TODO: source link
    license: '', // TODO: licence
    note: 'Modified: textures re-encoded.',
  },
  {
    name: 'Tall lamp (3D model)',
    by: '', // TODO: author
    url: '', // TODO: source link
    license: '', // TODO: licence
    note: 'Modified: polygon count reduced.',
  },
  {
    name: 'Desk lamp (3D model)',
    by: '', // TODO: author
    url: '', // TODO: source link
    license: '', // TODO: licence
    note: 'Modified: polygon count reduced.',
  },
  { name: 'three.js', by: 'mrdoob and contributors', url: 'https://threejs.org', license: 'MIT' },
  { name: 'chess.js', by: 'Jeff Hlywa', url: 'https://github.com/jhlywa/chess.js', license: 'BSD-2-Clause' },
  {
    name: 'Stockfish.js',
    by: 'Nathan Rugg (Stockfish.js) / the Stockfish developers',
    url: 'https://github.com/nmrugg/stockfish.js',
    license: 'GPL-3.0',
    note: 'Source code available at the link.',
  },
  { name: 'Draco decoder', by: 'Google', url: 'https://github.com/google/draco', license: 'Apache-2.0' },
];

export function renderCredits(el) {
  el.innerHTML =
    '<h2>Credits</h2><ul>' +
    CREDITS.map((c) => {
      const title = c.url ? `<a href="${c.url}" target="_blank" rel="noopener">${c.name}</a>` : c.name;
      const who = c.by ? `by ${c.by}` : '<em>credit pending</em>';
      const lic = c.license ? ` · ${c.license}` : '';
      return `<li>${title} ${who}${lic}${c.note ? `<br><small>${c.note}</small>` : ''}</li>`;
    }).join('') +
    '</ul><button type="button" id="credits-close">Close</button>';
}
