const $ = id => document.getElementById(id);
const boardEl = $('board');
let settings = Settings.load();
let game, selected = null, path = [], flipped = false, legal = [];
let net = null; // online session, see the Online section below
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

const free = () => !net && settings.mode === 'free';
const myTurn = () => !net || (net.ready && game.turn === net.me);
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
  const movable = new Set(!selected && !winner && myTurn() ? legal.map(m => m.piece) : []);

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
  const counts = `<span class="muted">${game.count('white')} – ${game.count('black')}</span>`;
  let text;
  if (winner) {
    text = net
      ? `<span class="dot ${winner}"></span> <strong>${winner === net.me ? 'Ganhaste!' : 'Perdeste.'}</strong>`
      : `<span class="dot ${winner}"></span> <strong>${name(winner)} ganham!</strong>`;
  } else if (net) {
    text = !net.ready
      ? `<span class="dot ${game.turn}"></span> <span class="muted">Adversário desligado</span>`
      : `<span class="dot ${game.turn}"></span> ${game.turn === net.me ? '<strong>A tua vez</strong>' : 'Vez do adversário'}` +
        (mustTake && game.turn === net.me ? ' · <span class="muted">captura</span>' : '') + ` · ${counts}`;
  } else {
    text = `<span class="dot ${game.turn}"></span> Joga ${name(game.turn)}` +
      (mustTake ? ' · <span class="muted">captura</span>' : '') + ` · ${counts}`;
  }
  $('turn').innerHTML = text;
  renderOnline();
}

function deselect() { selected = null; path = []; }

function afterMove() {
  deselect();
  if (settings.flip && !net) flipped = !flipped;
  if (net) checkEnd();
  render();
}

boardEl.addEventListener('click', e => {
  const pe = e.target.closest('.piece');
  if (pe) {
    const piece = game.pieces.find(p => p.id === +pe.dataset.id);
    if (piece === selected) { deselect(); render(); return; }
    if (piece.color !== game.turn || path.length || !myTurn()) return;
    if (free() || legal.some(m => m.piece === piece)) { selected = piece; render(); }
    return;
  }
  const sq = e.target.closest('.sq');
  if (!sq || !selected || !myTurn()) return;
  const r = +sq.dataset.r, c = +sq.dataset.c;
  if (free()) {
    if (game.move(selected, r, c)) afterMove();
    return;
  }
  const next = candidates().filter(m => m.steps[path.length] && same(m.steps[path.length].to, [r, c]));
  if (!next.length) return;
  path.push([r, c]);
  const done = next.find(m => m.steps.length === path.length);
  if (done) {
    const from = [done.piece.r, done.piece.c];
    game.play(done);
    if (net) net.link.send({ type: 'move', from, path: done.steps.map(st => st.to) });
    afterMove();
  } else render();
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

$('undo').onclick = () => { if (!net && game.undo()) { deselect(); if (settings.flip) flipped = !flipped; build(); } };
$('reset').onclick = () => {
  if (!net) return newGame();
  if (!game.winner() && !confirm('Terminar a partida atual e começar outra?')) return;
  net.role === 'host' ? startOnlineGame() : net.link.send({ type: 'rematch' });
};
$('toggle-online').onclick = () => { $('online').hidden = !$('online').hidden; };
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
    if (key === 'size' || key === 'first') { if (!net) newGame(); } else build();
  };
}

// ---- Online play -----------------------------------------------------------
// Protocol (JSON):
//   host -> guest  { type: 'state', size, rules, pieces, turn, hostColor, score, over }
//                  sent at the start of every game and after every (re)connection
//   either         { type: 'move', from: [r, c], path: [[r, c], ...] }
//   guest -> host  { type: 'rematch' }   ask the host to start a new game
//   guest -> host  { type: 'resync' }    ask for the state again (after a mismatch)
// The host owns the colours: it plays white first and they swap every game.
// Each side validates incoming moves with the same rules engine.

function startOnline(role, code) {
  leaveOnline(false);
  net = { role, me: null, ready: false, started: false, hostColor: 'white',
          score: { host: 0, guest: 0 }, counted: false, rules: null, link: null, code };
  net.link = new Online({
    onCode: c => { net.code = c; setOnlineState('waiting'); $('net-code-show').textContent = c; setNetStatus(''); },
    onConnect: () => {
      net.ready = true;
      setOnlineState('live');
      setNetStatus(role === 'host' ? '' : 'Ligado. À espera do anfitrião…');
      if (role === 'host') net.started ? sendState() : startOnlineGame(false);
      else render();
    },
    onDisconnect: () => {
      net.ready = false;
      setNetStatus(role === 'host' ? 'O teu amigo desligou-se. À espera que volte…' : 'Ligação perdida.');
      deselect();
      render();
    },
    onStatus: setNetStatus,
    onFatal: msg => { leaveOnline(true); setNetStatus(msg); $('online').hidden = false; },
    onMessage: onNetMessage,
  });
  setNetStatus(role === 'host' ? 'A criar jogo…' : 'A ligar…');
  role === 'host' ? net.link.host() : net.link.join(code);
}

function leaveOnline(reset) {
  if (!net) return;
  net.link.close();
  net = null;
  setOnlineState('idle');
  setNetStatus('');
  if (reset) { flipped = false; newGame(); }
}

function setOnlineState(state) { $('online').dataset.state = state; }
function setNetStatus(text) { $('net-status').textContent = text; }

function renderOnline() {
  $('undo').disabled = !!net;
  if (!net || !net.started) return;
  const mine = net.role === 'host' ? net.score.host : net.score.guest;
  const theirs = net.role === 'host' ? net.score.guest : net.score.host;
  $('net-score').innerHTML =
    `Tu <span class="dot ${net.me}"></span> <strong>${mine} – ${theirs}</strong> Adversário`;
}

// Host: start a fresh game (colours swap after the first one).
function startOnlineGame(swap = net.started) {
  if (swap) net.hostColor = net.hostColor === 'white' ? 'black' : 'white';
  const rules = { mode: 'portuguese', mandatory: settings.mandatory, majority: settings.majority, menBackward: settings.menBackward };
  const g = new Game(settings.size, settings.first, rules);
  applyState({ size: g.size, rules, pieces: g.pieces, turn: g.turn, hostColor: net.hostColor, score: net.score, over: false });
  sendState();
}

function sendState() {
  net.link.send({ type: 'state', size: game.size, rules: net.rules, hostColor: net.hostColor,
    pieces: game.pieces.map(p => ({ ...p })), turn: game.turn, score: net.score, over: !!game.winner() });
}

function applyState(msg) {
  net.rules = msg.rules;
  net.hostColor = msg.hostColor;
  net.me = net.role === 'host' ? msg.hostColor : (msg.hostColor === 'white' ? 'black' : 'white');
  net.score = msg.score;
  net.counted = msg.over;
  net.started = true;
  game = new Game(msg.size, msg.turn, msg.rules);
  game.pieces = msg.pieces.map(p => ({ ...p }));
  game.turn = msg.turn;
  deselect();
  flipped = net.me === 'black';
  setNetStatus('');
  // Start already facing the right way instead of spinning into place.
  boardEl.style.transition = 'none';
  build();
  void boardEl.offsetWidth;
  boardEl.style.transition = '';
}

function checkEnd() {
  const w = game.winner();
  if (!w || net.counted) return;
  net.counted = true;
  net.score[w === net.hostColor ? 'host' : 'guest']++;
}

function onNetMessage(msg) {
  if (!msg || !net) return;
  if (msg.type === 'state' && net.role === 'guest') applyState(msg);
  else if (msg.type === 'rematch' && net.role === 'host') startOnlineGame();
  else if (msg.type === 'resync' && net.role === 'host') sendState();
  else if (msg.type === 'move') onRemoteMove(msg);
}

function onRemoteMove(msg) {
  const ok = net.started && game.turn !== net.me && !game.winner() &&
    Array.isArray(msg.from) && Array.isArray(msg.path);
  const move = ok && game.legalMoves().find(m =>
    m.piece.r === msg.from[0] && m.piece.c === msg.from[1] &&
    m.steps.length === msg.path.length && m.steps.every((st, i) => same(st.to, msg.path[i])));
  if (!move) {
    // Out of step: the host's copy is the truth.
    net.role === 'host' ? sendState() : net.link.send({ type: 'resync' });
    return;
  }
  game.play(move);
  afterMove();
}

$('net-create').onclick = () => startOnline('host');
$('net-join-form').onsubmit = e => {
  e.preventDefault();
  const code = normaliseCode($('net-code').value);
  if (code.length < 4) { setNetStatus('Escreve o código que o teu amigo te enviou.'); return; }
  startOnline('guest', code);
};
$('net-leave').onclick = () => leaveOnline(true);
const copy = (text, label) => {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
    .then(() => setNetStatus(label + ' copiado.'), () => setNetStatus('Copia manualmente: ' + text));
};
$('net-copy-code').onclick = () => copy(net.code, 'Código');
$('net-copy-link').onclick = () => copy(`${location.origin}${location.pathname}?join=${net.code}`, 'Ligação');
window.addEventListener('beforeunload', () => net && net.link.close());

newGame();

// A shared link (?join=CODE) joins straight away.
const joinParam = normaliseCode(new URLSearchParams(location.search).get('join') || '');
if (joinParam) { $('online').hidden = false; startOnline('guest', joinParam); }
