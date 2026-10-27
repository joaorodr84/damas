const $ = id => document.getElementById(id);
const boardEl = $('board');
let settings = Settings.load();
let game, selected = null, flipped = false;
const pieceEls = new Map();

function newGame() {
  game = new Game(settings.size, settings.first);
  selected = null;
  flipped = false;
  build();
}

// Screen position of a board square, as percentages of the board.
function pos(r, c) {
  const n = game.size;
  const col = flipped ? n - 1 - c : c;
  const row = flipped ? r : n - 1 - r;
  return { x: col * 100 / n, y: row * 100 / n };
}

function build() {
  const n = game.size;
  document.body.dataset.theme = settings.theme;
  boardEl.style.setProperty('--n', n);
  boardEl.classList.toggle('no-anim', !settings.anim);
  boardEl.innerHTML = '';
  pieceEls.clear();

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const sq = document.createElement('div');
      sq.className = 'sq ' + (Game.isDark(r, c) ? 'dark' : 'light');
      sq.dataset.r = r; sq.dataset.c = c;
      const p = pos(r, c);
      sq.style.left = p.x + '%'; sq.style.top = p.y + '%';
      if (settings.coords) {
        const col = flipped ? n - 1 - c : c, row = flipped ? r : n - 1 - r;
        if (row === n - 1) sq.insertAdjacentHTML('beforeend', `<i class="file">${String.fromCharCode(97 + c)}</i>`);
        if (col === 0) sq.insertAdjacentHTML('beforeend', `<i class="rank">${r + 1}</i>`);
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

function render() {
  const n = game.size;
  boardEl.querySelectorAll('.sq').forEach(sq => {
    const r = +sq.dataset.r, c = +sq.dataset.c;
    sq.classList.toggle('hint', settings.hints && !!selected && Game.isDark(r, c) && !game.pieceAt(r, c));
    sq.classList.toggle('from', !!selected && selected.r === r && selected.c === c);
    const p = pos(r, c);
    sq.style.left = p.x + '%'; sq.style.top = p.y + '%';
  });
  for (const [id, el] of pieceEls) {
    const piece = game.pieces.find(p => p.id === id);
    if (!piece) { el.remove(); pieceEls.delete(id); continue; }
    const p = pos(piece.r, piece.c);
    el.className = `piece ${piece.color}${piece.king ? ' king' : ''}${piece === selected ? ' selected' : ''}`;
    el.style.width = el.style.height = 100 / n + '%';
    el.style.transform = `translate(${p.x / (100 / n) * 100}%, ${p.y / (100 / n) * 100}%)`;
  }
  $('turn').innerHTML =
    `<span class="dot ${game.turn}"></span> Joga ${game.turn === 'white' ? 'Brancas' : 'Pretas'}` +
    ` · <span class="muted">${game.count('white')} – ${game.count('black')}</span>`;
}

boardEl.addEventListener('click', e => {
  const pe = e.target.closest('.piece');
  if (pe) {
    const piece = game.pieces.find(p => p.id === +pe.dataset.id);
    if (piece.color === game.turn) { selected = selected === piece ? null : piece; render(); }
    return;
  }
  const sq = e.target.closest('.sq');
  if (!sq || !selected) return;
  if (game.move(selected, +sq.dataset.r, +sq.dataset.c)) {
    selected = null;
    if (settings.flip) flipped = !flipped;
    render();
  }
});

boardEl.addEventListener('dblclick', e => {
  const pe = e.target.closest('.piece');
  if (!pe) return;
  game.toggleKing(game.pieces.find(p => p.id === +pe.dataset.id));
  render();
});

boardEl.addEventListener('contextmenu', e => {
  const pe = e.target.closest('.piece');
  if (!pe) return;
  e.preventDefault();
  const piece = game.pieces.find(p => p.id === +pe.dataset.id);
  if (piece === selected) selected = null;
  game.remove(piece);
  render();
});

$('undo').onclick = () => { if (game.undo()) { selected = null; if (settings.flip) flipped = !flipped; build(); } };
$('reset').onclick = newGame;
$('toggle-settings').onclick = () => { $('settings').hidden = !$('settings').hidden; };

// Settings wiring
const fields = { theme: 's-theme', size: 's-size', first: 's-first', coords: 's-coords', flip: 's-flip', hints: 's-hints', anim: 's-anim' };
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
