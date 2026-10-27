const $ = id => document.getElementById(id);
const boardEl = $('board');
let settings = Settings.load();
let game, selected = null, path = [], flipped = false, legal = [];
const pieceEls = new Map();

function newGame() {
  game = new Game(settings.size, settings.first, settings);
  selected = null; path = [];
  flipped = false;
  build();
}

// Position of a board square, as percentages of the board. The board is
// turned as a whole with CSS when `flipped`, so this never depends on it.
function pos(r, c) {
  const n = game.size;
  return { x: c * 100 / n, y: (n - 1 - r) * 100 / n };
}

function build() {
  const n = game.size;
  document.body.dataset.theme = settings.theme;
  boardEl.style.setProperty('--n', n);
  boardEl.classList.toggle('no-anim', !settings.anim);
  boardEl.classList.toggle('flipped', flipped);
  boardEl.innerHTML = '';
  pieceEls.clear();

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const sq = document.createElement('div');
      sq.className = 'sq ' + (Game.isDark(r, c) ? 'dark' : 'light');
      sq.dataset.r = r; sq.dataset.c = c;
      const p = pos(r, c);
      sq.style.left = p.x + '%'; sq.style.top = p.y + '%';
      // Labels sit on both opposite edges; CSS shows the pair on the visual
      // bottom/left whichever way the board is turned.
      if (settings.coords) {
        const side = k => k === 0 ? 'a' : k === n - 1 ? 'b' : '';
        const f = side(r), k = side(c);
        const letter = String.fromCharCode(97 + c);
        if (f) sq.insertAdjacentHTML('beforeend', `<i class="file ${f}">${letter}</i>`);
        if (k) sq.insertAdjacentHTML('beforeend', `<i class="rank ${k}">${r + 1}</i>`);
      }
      boardEl.appendChild(sq);
    }
  }
  for (const piece of game.pieces) {
    const el = document.createElement('div');
    el.dataset.id = piece.id;
    el.innerHTML = '<span class="disc"><span class="ring"></span><span class="crown">♛</span></span>';
    boardEl.appendChild(el);
    pieceEls.set(piece.id, el);
  }
  render();
}

const free = () => settings.mode === 'free';
const same = (a, b) => a[0] === b[0] && a[1] === b[1];

// Moves of the selected piece that agree with the squares clicked so far.
function candidates() {
  if (!selected) return [];
  return legal.filter(m => m.piece === selected &&
    path.every((sq, i) => m.steps[i] && same(m.steps[i].to, sq)));
}

function render() {
  const n = game.size;
  boardEl.classList.toggle('flipped', flipped);
  legal = free() ? [] : game.legalMoves();
  const cands = candidates();
  const nextSquares = free()
    ? null
    : cands.filter(m => m.steps[path.length]).map(m => m.steps[path.length].to);
  const taken = new Set(cands[0] ? cands[0].steps.slice(0, path.length).map(s => s.captured) : []);
  const winner = game.winner();
  const movable = new Set(!selected && !winner ? legal.map(m => m.piece) : []);

  boardEl.querySelectorAll('.sq').forEach(sq => {
    const r = +sq.dataset.r, c = +sq.dataset.c;
    const hint = !!selected && settings.hints && (free()
      ? Game.isDark(r, c) && !game.pieceAt(r, c)
      : nextSquares.some(t => t[0] === r && t[1] === c));
    sq.classList.toggle('hint', hint);
    sq.classList.toggle('from', !!selected && selected.r === r && selected.c === c);
    const p = pos(r, c);
    sq.style.left = p.x + '%'; sq.style.top = p.y + '%';
  });
  for (const [id, el] of pieceEls) {
    const piece = game.pieces.find(p => p.id === id);
    if (!piece) { el.remove(); pieceEls.delete(id); continue; }
    const at = piece === selected && path.length ? path[path.length - 1] : [piece.r, piece.c];
    const p = pos(at[0], at[1]);
    el.className = `piece ${piece.color}${piece.king ? ' king' : ''}` +
      `${piece === selected ? ' selected' : ''}${taken.has(piece) ? ' taken' : ''}` +
      `${settings.hints && movable.has(piece) ? ' movable' : ''}`;
    el.style.width = el.style.height = 100 / n + '%';
    el.firstChild.style.rotate = flipped ? '-180deg' : '0deg';
    el.style.transform = `translate(${p.x / (100 / n) * 100}%, ${p.y / (100 / n) * 100}%)`;
  }
  const name = c => c === 'white' ? 'Brancas' : 'Pretas';
  const mustTake = !free() && legal.length && legal[0].steps[0].captured;
  $('turn').innerHTML = winner
    ? `<span class="dot ${winner}"></span> <strong>${name(winner)} ganham!</strong>`
    : `<span class="dot ${game.turn}"></span> Joga ${name(game.turn)}` +
      (mustTake ? ' · <span class="muted">captura</span>' : '') +
      ` · <span class="muted">${game.count('white')} – ${game.count('black')}</span>`;
}

function deselect() { selected = null; path = []; }

function afterMove() {
  deselect();
  if (settings.flip) flipped = !flipped;
  render();
}

boardEl.addEventListener('click', e => {
  const pe = e.target.closest('.piece');
  if (pe) {
    const piece = game.pieces.find(p => p.id === +pe.dataset.id);
    if (piece === selected) { deselect(); render(); return; }
    if (piece.color !== game.turn || path.length) return;
    if (free() || legal.some(m => m.piece === piece)) { selected = piece; render(); }
    return;
  }
  const sq = e.target.closest('.sq');
  if (!sq || !selected) return;
  const r = +sq.dataset.r, c = +sq.dataset.c;
  if (free()) {
    if (game.move(selected, r, c)) afterMove();
    return;
  }
  const next = candidates().filter(m => m.steps[path.length] && same(m.steps[path.length].to, [r, c]));
  if (!next.length) return;
  path.push([r, c]);
  const done = next.find(m => m.steps.length === path.length);
  if (done) { game.play(done); afterMove(); } else render();
});

document.addEventListener('keydown', e => { if (e.key === 'Escape') { deselect(); render(); } });

boardEl.addEventListener('dblclick', e => {
  if (!free()) return;
  const pe = e.target.closest('.piece');
  if (!pe) return;
  game.toggleKing(game.pieces.find(p => p.id === +pe.dataset.id));
  render();
});

boardEl.addEventListener('contextmenu', e => {
  if (!free()) { e.preventDefault(); deselect(); render(); return; }
  const pe = e.target.closest('.piece');
  if (!pe) return;
  e.preventDefault();
  const piece = game.pieces.find(p => p.id === +pe.dataset.id);
  if (piece === selected) deselect();
  game.remove(piece);
  render();
});

$('undo').onclick = () => { if (game.undo()) { deselect(); if (settings.flip) flipped = !flipped; build(); } };
$('reset').onclick = newGame;
$('toggle-settings').onclick = () => { $('settings').hidden = !$('settings').hidden; };

// Settings wiring
const fields = { mode: 's-mode', mandatory: 's-mandatory', majority: 's-majority', menBackward: 's-menBackward', theme: 's-theme', size: 's-size', first: 's-first', coords: 's-coords', flip: 's-flip', hints: 's-hints', anim: 's-anim' };
for (const [key, id] of Object.entries(fields)) {
  const el = $(id);
  const isCheck = el.type === 'checkbox';
  isCheck ? (el.checked = settings[key]) : (el.value = settings[key]);
  el.onchange = () => {
    settings[key] = isCheck ? el.checked : (key === 'size' ? +el.value : el.value);
    Settings.save(settings);
    if (key === 'size' || key === 'first') newGame(); else build();
  };
}

newGame();
