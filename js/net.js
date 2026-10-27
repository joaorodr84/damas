// Peer-to-peer link for two players, on top of PeerJS (js/vendor/peerjs.min.js).
// The host registers a short code as its PeerJS id; the guest connects to it.
// Only the public PeerJS broker is used, to introduce the two browsers.
// Messages are plain JSON objects; see ui.js for the protocol.

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const PEER_PREFIX = 'damas-';
const RECONNECT_TRIES = 10;
const RECONNECT_MS = 2000;
const CONNECT_TIMEOUT_MS = 12000;

function randomCode(len = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

function normaliseCode(text) {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// handlers: onCode(code) · onConnect() · onDisconnect() · onMessage(msg)
//           onStatus(text) · onFatal(text)
class Online {
  constructor(handlers) {
    this.h = handlers;
    this.role = null;
    this.code = null;
    this.peer = null;
    this.conn = null;
    this.guestId = null;   // host: the one peer allowed to (re)connect
    this.closed = false;
    this.everConnected = false;
  }

  get connected() { return !!(this.conn && this.conn.open); }

  send(msg) { if (this.connected) this.conn.send(msg); }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    try { this.conn && this.conn.close(); } catch {}
    try { this.peer && this.peer.destroy(); } catch {}
  }

  // ---- host -------------------------------------------------------------
  host() {
    this.role = 'host';
    this.code = randomCode();
    const peer = this.peer = new Peer(PEER_PREFIX + this.code);
    peer.on('open', () => this.h.onCode(this.code));
    peer.on('connection', conn => this.accept(conn));
    peer.on('disconnected', () => { if (!this.closed) peer.reconnect(); });
    peer.on('error', err => {
      if (err.type === 'unavailable-id') { peer.destroy(); this.host(); return; }
      if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        this.h.onFatal('Não foi possível ligar ao servidor de emparelhamento. Verifica a ligação à internet.');
      }
    });
  }

  accept(conn) {
    // Once a guest has joined, only that same guest may come back.
    if (this.guestId && conn.peer !== this.guestId) {
      conn.on('open', () => conn.close());
      return;
    }
    this.guestId = conn.peer;
    const old = this.conn;
    this.conn = conn;
    if (old) try { old.close(); } catch {}
    this.wire(conn);
  }

  // ---- guest ------------------------------------------------------------
  join(code) {
    this.role = 'guest';
    this.code = code;
    this.h.onStatus('A ligar…');
    const peer = this.peer = new Peer();
    peer.on('open', () => this.dial());
    peer.on('disconnected', () => { if (!this.closed && !peer.destroyed) peer.reconnect(); });
    peer.on('error', err => {
      if (err.type === 'peer-unavailable') {
        if (!this.everConnected) this.h.onFatal('Código não encontrado. Confirma-o com o teu amigo.');
        else this.retry();
      } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
        this.h.onFatal('Não foi possível ligar ao servidor de emparelhamento. Verifica a ligação à internet.');
      }
    });
  }

  dial() {
    if (this.closed) return;
    const conn = this.peer.connect(PEER_PREFIX + this.code, { reliable: true, serialization: 'json' });
    this.conn = conn;
    this.wire(conn);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!conn.open && this.conn === conn) {
        try { conn.close(); } catch {}
        this.everConnected ? this.retry() : this.h.onFatal('Sem resposta. Confirma o código e tenta outra vez.');
      }
    }, CONNECT_TIMEOUT_MS);
  }

  retry() {
    if (this.closed || this.role !== 'guest') return;
    if (this.tries >= RECONNECT_TRIES) {
      this.h.onFatal('Perdeu-se a ligação ao anfitrião.');
      return;
    }
    this.tries = (this.tries || 0) + 1;
    this.h.onStatus(`A reconectar… (${this.tries}/${RECONNECT_TRIES})`);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.dial(), RECONNECT_MS);
  }

  // ---- shared -----------------------------------------------------------
  wire(conn) {
    conn.on('open', () => {
      clearTimeout(this.timer);
      this.tries = 0;
      this.everConnected = true;
      this.h.onConnect();
    });
    conn.on('data', msg => { if (this.conn === conn) this.h.onMessage(msg); });
    conn.on('close', () => {
      if (this.conn !== conn || this.closed) return;
      this.h.onDisconnect();
      if (this.role === 'guest') this.retry();
    });
    conn.on('error', () => {});
  }
}
