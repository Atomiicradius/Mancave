import * as THREE from 'three';
import { Chess } from 'chess.js';
import { addBox } from '../room.js';
import { ASSETS } from '../assets.js';

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#3b2a55' : '#d9cfee';
      ctx.fillRect(x * 8, y * 8, 8, 8);
    }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Counter on the right wall with a flat chessboard on top.
export function buildChess() {
  const g = new THREE.Group();
  g.name = 'chess';

  // Placeholder cabinet + board; sized like the real models (see assets.js) because the collider comes from here.
  addBox(g, { name: 'counter', size: [0.5, 1.1, 0.95], pos: [3.75, 0.55, 0], color: 0x8a1c2b, solid: true });
  const board = addBox(g, { name: 'chessboard', size: [0.44, 0.04, 0.44], pos: [3.75, 1.12, 0], color: 0xffffff });
  board.material.map = checkerTexture();
  board.userData.interactable = 'chess';
  return g;
}

// Filled glyphs for both colors; CSS colors them. ︎ forces text (not emoji) rendering.
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const FILES = 'abcdefgh';

// Stockfish "Skill Level" (0-20) and think time per difficulty.
const LEVELS = {
  Easy: { skill: 0, ms: 150 },
  Medium: { skill: 8, ms: 400 },
  Hard: { skill: 14, ms: 800 },
  Max: { skill: 20, ms: 1500 },
};

// 2D overlay: player is white vs Stockfish (running in a Web Worker).
export function registerChess(interaction) {
  const root = document.getElementById('chess');
  let game = new Chess();
  let selected = null;
  let thinking = false;
  let ignoreBest = 0; // bestmove replies to discard after a reset
  let difficulty = 'Medium';
  let worker = null;
  let ready = null;

  root.innerHTML = `
    <div class="panel">
      <div class="bar">
        <label>Difficulty <select id="ch-diff">${Object.keys(LEVELS)
          .map((k) => `<option ${k === difficulty ? 'selected' : ''}>${k}</option>`)
          .join('')}</select></label>
        <button id="ch-reset">Reset</button>
        <button id="ch-close">Close (Esc)</button>
      </div>
      <div class="board" id="ch-board"></div>
      <div class="status" id="ch-status"></div>
    </div>`;
  const boardEl = root.querySelector('#ch-board');
  const statusEl = root.querySelector('#ch-status');

  function startEngine() {
    if (ready) return ready;
    worker = new Worker(ASSETS.stockfish);
    ready = new Promise((resolve) => {
      worker.onmessage = (e) => {
        const line = typeof e.data === 'string' ? e.data : '';
        if (line === 'uciok') worker.postMessage('isready');
        else if (line === 'readyok') {
          worker.onmessage = onEngine;
          resolve();
        }
      };
      worker.postMessage('uci');
    });
    return ready;
  }

  function onEngine(e) {
    const line = typeof e.data === 'string' ? e.data : '';
    if (!line.startsWith('bestmove')) return;
    if (ignoreBest > 0) {
      ignoreBest--;
      return;
    }
    thinking = false;
    const mv = line.split(' ')[1];
    if (mv && mv !== '(none)') game.move({ from: mv.slice(0, 2), to: mv.slice(2, 4), promotion: mv[4] });
    render();
  }

  async function engineMove() {
    thinking = true;
    render();
    await startEngine();
    if (!thinking) return; // reset while the engine was loading
    const { skill, ms } = LEVELS[difficulty];
    worker.postMessage(`setoption name Skill Level value ${skill}`);
    worker.postMessage(`position fen ${game.fen()}`);
    worker.postMessage(`go movetime ${ms}`);
  }

  function status() {
    if (game.isCheckmate()) return game.turn() === 'w' ? 'Checkmate — Stockfish wins.' : 'Checkmate — you win!';
    if (game.isDraw()) return 'Draw.';
    if (thinking) return 'Stockfish is thinking…';
    return game.inCheck() ? 'Your move — you are in check.' : 'Your move (white).';
  }

  function render() {
    const targets = new Set(selected ? game.moves({ square: selected, verbose: true }).map((m) => m.to) : []);
    const last = game.history({ verbose: true }).at(-1);
    let html = '';
    game.board().forEach((row, r) =>
      row.forEach((p, c) => {
        const sq = FILES[c] + (8 - r);
        const cls = ['sq', (r + c) % 2 ? 'd' : 'l'];
        if (last && (sq === last.from || sq === last.to)) cls.push('last');
        if (sq === selected) cls.push('sel');
        if (targets.has(sq)) cls.push('move');
        if (targets.has(sq) && p) cls.push('cap');
        html += `<div class="${cls.join(' ')}" data-sq="${sq}">${p ? `<span class="${p.color}">${GLYPH[p.type]}︎</span>` : ''}</div>`;
      })
    );
    boardEl.innerHTML = html;
    statusEl.textContent = status();
  }

  boardEl.addEventListener('click', (e) => {
    const el = e.target.closest('.sq');
    if (!el || thinking || game.isGameOver() || game.turn() !== 'w') return;
    const sq = el.dataset.sq;
    if (selected && game.moves({ square: selected, verbose: true }).some((m) => m.to === sq)) {
      game.move({ from: selected, to: sq, promotion: 'q' });
      selected = null;
      render();
      if (!game.isGameOver()) engineMove();
    } else {
      selected = game.get(sq)?.color === 'w' && sq !== selected ? sq : null;
      render();
    }
  });

  root.querySelector('#ch-diff').addEventListener('change', (e) => (difficulty = e.target.value));

  root.querySelector('#ch-reset').addEventListener('click', () => {
    if (thinking && worker) {
      ignoreBest++;
      worker.postMessage('stop');
    }
    thinking = false;
    selected = null;
    game = new Chess();
    worker?.postMessage('ucinewgame');
    render();
  });

  const onKey = (e) => e.code === 'Escape' && close();
  function close() {
    root.style.display = 'none';
    removeEventListener('keydown', onKey);
    interaction.resume();
  }
  root.querySelector('#ch-close').addEventListener('click', close);

  interaction.register('chess', {
    unlocks: true,
    label: () => 'Play chess',
    onInteract() {
      interaction.controls.unlock();
      root.style.display = 'flex';
      addEventListener('keydown', onKey);
      render();
      startEngine(); // warm up while the player looks at the board
    },
    onExit() {
      root.style.display = 'none';
      removeEventListener('keydown', onKey);
    },
  });
}
