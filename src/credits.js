// Shown in the "Credits" panel on the start screen (attribution has to be visible on the live site, not just in CREDITS.md).
// Keep in sync with CREDITS.md. `by`/`url` left empty shows "credit pending" so an unfinished entry is obvious.
export const CREDITS = [
  {
    name: '2017 Honda NSX (3D model)',
    by: 'Ddiaz Design',
    url: 'https://sketchfab.com/3d-models/2017-honda-nsx-e9411dfa29f745d6a69021d8ce19d2e7',
    license: 'CC BY-NC-SA 4.0',
    note: 'Modified: reduced polygon count, re-encoded textures, compressed. Shared under the same licence.',
  },
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
