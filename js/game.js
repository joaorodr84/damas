// Pure game state and rules: no DOM here.
// Coordinates: row 0 is the bottom (rank 1), col 0 is file "a".
// Dark squares are those where (row + col) is even, so a1 is dark.
//
// A move is { piece, steps: [{ to: [r, c], captured: piece | null }] }.
// A capture move has one step per landing square; captured pieces stay on
// the board (blocking) until the whole move is done (rule 2.2.10).

let nextId = 1;
const DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

class Game {
  // `rules` is read live: { mode: 'portuguese' | 'free', mandatory, majority, menBackward }
  constructor(size = 8, first = 'white', rules = { mode: 'portuguese', mandatory: true, majority: true, menBackward: false }) {
    this.size = size;
    this.turn = first;
    this.rules = rules;
    this.pieces = [];
    this.history = [];
    const rows = size === 10 ? 4 : 3;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!Game.isDark(r, c)) continue;
        if (r < rows) this.pieces.push({ id: nextId++, color: 'white', king: false, r, c });
        else if (r >= size - rows) this.pieces.push({ id: nextId++, color: 'black', king: false, r, c });
      }
    }
  }

  static isDark(r, c) { return (r + c) % 2 === 0; }

  inside(r, c) { return r >= 0 && c >= 0 && r < this.size && c < this.size; }
  pieceAt(r, c) { return this.pieces.find(p => p.r === r && p.c === c); }
  count(color) { return this.pieces.filter(p => p.color === color).length; }
  other(color) { return color === 'white' ? 'black' : 'white'; }

  // Occupant of a square, ignoring the moving piece (it has left its origin).
  occ(r, c, mover) {
    const p = this.pieceAt(r, c);
    return p === mover ? undefined : p;
  }

  // All complete capture sequences for one piece (rules 2.2.8 and 2.2.9).
  captureMoves(piece) {
    const out = [];
    const dfs = (r, c, taken, steps) => {
      let extended = false;
      for (const [dr, dc] of DIRS) {
        if (!piece.king) {
          // Men capture forwards only, unless rules.menBackward is on.
          if (!this.rules.menBackward && dr !== (piece.color === 'white' ? 1 : -1)) continue;
          const v = this.occ(r + dr, c + dc, piece);
          const lr = r + 2 * dr, lc = c + 2 * dc;
          if (v && v.color !== piece.color && !taken.includes(v) &&
              this.inside(lr, lc) && !this.occ(lr, lc, piece)) {
            extended = true;
            dfs(lr, lc, [...taken, v], [...steps, { to: [lr, lc], captured: v }]);
          }
        } else {
          // Flying king: slide over empty squares, jump the first piece met,
          // land on any empty square beyond it.
          let mr = r + dr, mc = c + dc;
          while (this.inside(mr, mc) && !this.occ(mr, mc, piece)) { mr += dr; mc += dc; }
          if (!this.inside(mr, mc)) continue;
          const v = this.occ(mr, mc, piece);
          if (v.color === piece.color || taken.includes(v)) continue;
          let lr = mr + dr, lc = mc + dc;
          while (this.inside(lr, lc) && !this.occ(lr, lc, piece)) {
            extended = true;
            dfs(lr, lc, [...taken, v], [...steps, { to: [lr, lc], captured: v }]);
            lr += dr; lc += dc;
          }
        }
      }
      if (!extended && steps.length) out.push({ piece, steps });
    };
    dfs(piece.r, piece.c, [], []);
    return out;
  }

  // Non-capturing moves for one piece.
  plainMoves(piece) {
    const out = [];
    for (const [dr, dc] of DIRS) {
      if (!piece.king && dr !== (piece.color === 'white' ? 1 : -1)) continue;
      let r = piece.r + dr, c = piece.c + dc;
      while (this.inside(r, c) && !this.pieceAt(r, c)) {
        out.push({ piece, steps: [{ to: [r, c], captured: null }] });
        if (!piece.king) break;
        r += dr; c += dc;
      }
    }
    return out;
  }

  legalMoves(color = this.turn) {
    const mine = this.pieces.filter(p => p.color === color);
    let caps = mine.flatMap(p => this.captureMoves(p));
    if (caps.length && this.rules.majority) {
      const best = Math.max(...caps.map(m => m.steps.length));
      caps = caps.filter(m => m.steps.length === best);
    }
    if (caps.length && this.rules.mandatory) return caps;
    return [...caps, ...mine.flatMap(p => this.plainMoves(p))];
  }

  // Winner colour once the side to move has no legal move, else null.
  winner() {
    if (this.rules.mode === 'free') return null;
    return this.legalMoves().length ? null : this.other(this.turn);
  }

  snapshot() {
    this.history.push({ pieces: this.pieces.map(p => ({ ...p })), turn: this.turn });
  }

  undo() {
    const s = this.history.pop();
    if (!s) return false;
    this.pieces = s.pieces;
    this.turn = s.turn;
    return true;
  }

  // Play a move from legalMoves(). Captured pieces leave only now.
  play(move) {
    this.snapshot();
    const { piece, steps } = move;
    const [r, c] = steps[steps.length - 1].to;
    piece.r = r; piece.c = c;
    const gone = steps.map(s => s.captured).filter(Boolean);
    this.pieces = this.pieces.filter(p => !gone.includes(p));
    if (r === (piece.color === 'white' ? this.size - 1 : 0)) piece.king = true;
    this.turn = this.other(this.turn);
  }

  // Free-play helpers (mode "free").
  move(piece, r, c) {
    if (!Game.isDark(r, c) || this.pieceAt(r, c)) return false;
    this.snapshot();
    piece.r = r; piece.c = c;
    if (r === (piece.color === 'white' ? this.size - 1 : 0)) piece.king = true;
    this.turn = this.other(this.turn);
    return true;
  }
  toggleKing(piece) { this.snapshot(); piece.king = !piece.king; }
  remove(piece) { this.snapshot(); this.pieces = this.pieces.filter(p => p !== piece); }
}
