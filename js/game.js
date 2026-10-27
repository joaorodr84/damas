// Pure game state: no DOM here.
// Coordinates: row 0 is the bottom (rank 1), col 0 is file "a".
// Dark squares are those where (row + col) is even, so a1 is dark.

let nextId = 1;

class Game {
  constructor(size = 8, first = 'white') {
    this.size = size;
    this.turn = first;
    this.first = first;
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

  pieceAt(r, c) { return this.pieces.find(p => p.r === r && p.c === c); }

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

  // Free movement for now; swap in rule validation here later.
  move(piece, r, c) {
    if (!Game.isDark(r, c) || this.pieceAt(r, c)) return false;
    this.snapshot();
    piece.r = r; piece.c = c;
    const last = piece.color === 'white' ? this.size - 1 : 0;
    if (r === last) piece.king = true;
    this.turn = this.turn === 'white' ? 'black' : 'white';
    return true;
  }

  toggleKing(piece) { this.snapshot(); piece.king = !piece.king; }
  remove(piece) { this.snapshot(); this.pieces = this.pieces.filter(p => p !== piece); }

  count(color) { return this.pieces.filter(p => p.color === color).length; }
}
