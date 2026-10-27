# Damas

A checkers game in plain HTML, CSS and JavaScript. No build step: open `index.html` in a browser.

Play against yourself with Portuguese rules (rules 2.2.8-2.2.10): men move and capture forward only (backward capture is an option), kings fly, captures are mandatory, multi-captures are played square by square and the captured pieces only leave the board when the move is complete. The law of majority (take the most pieces) is on by default and can be switched off, as can mandatory capture. A free-play mode is also available.

Still to do: draw rules.

- `js/config.js` – settings (saved in localStorage)
- `js/game.js` – game state (no DOM)
- `js/ui.js` – rendering and input
