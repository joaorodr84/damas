# Damas

A checkers game in plain HTML, CSS and JavaScript. No build step: open `index.html` in a browser.

Play against yourself with Portuguese rules (rules 2.2.8-2.2.10): men move and capture forward only (backward capture is an option), kings fly, captures are mandatory, multi-captures are played square by square and the captured pieces only leave the board when the move is complete. The law of majority (take the most pieces) is on by default and can be switched off, as can mandatory capture. A free-play mode is also available.

Still to do: draw rules.

- `js/config.js` – settings (saved in localStorage)
- `js/game.js` – game state (no DOM)
- `js/ui.js` – rendering and input

## Online play

Two people can play over the internet, no account needed: press **Online → Criar jogo**, send the 6-character code (or the link) to your friend, and they press **Entrar**. The host plays white first; colours swap on every **Novo jogo**, and the score is kept for the session. If the connection drops, the guest reconnects automatically and the game resumes.

It is peer-to-peer (WebRTC via [PeerJS](https://peerjs.com), vendored in `js/vendor/`). The public PeerJS broker is only used to introduce the two browsers; moves go directly between them. On some strict networks a direct connection may not be possible.

- `js/net.js` – connection handling (host / guest, reconnection)
- `js/ui.js` – the message protocol (`state`, `move`, `rematch`, `resync`) and online UI
