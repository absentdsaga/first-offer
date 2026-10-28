# FIRST OFFER engine
Load order: `<script src="cartridges.js"></script><script src="engine.js"></script>` (no build). Global: `window.FirstOffer`.
- `start(cartridgeId, bossIndex)` reset HP to 100/100, boss speaks opening. Cartridges: `negotiate` (0 Car Dealer, 1 Landlord, 2 THE RECRUITER), `espanol` (0 Vendedor, 1 Taxista, 2 EL JEFE).
- `say(text)` submit a typed line (mic finals call this). Lines sent while scoring is in flight are queued (latest wins).
- `listen()` / `stopListening()` Web Speech mic in cartridge lang; auto-pauses while the boss talks, auto-restarts after silence. `isListening()`.
- `on(event, cb)` / `off(event, cb)`; `state()` returns {bossHP, playerHP, value, over, history...}.
- Events: `bossLine` {text} · `playerLine` {text} · `interim` {text} ('' = clear) · `hit` {move, dmg, target:'boss'|'player'} ·
  `score` {bossHP, playerHP, value, tip, offline} · `ko` {winner:'player'|'boss', value, summary} · `thinking` {on} · `error` {message}.
- Per turn order: playerLine, thinking on, thinking off, hit x N, score, bossLine, (ko).
- `FirstOffer.config`: `{url, timeoutMs:8000, offline:false, retryAfterMs:30000, contentType}`. Set `config.url` / `config.offline` before or during play.
- Scoring: POST config.url `{cartridge, boss(name), bossIndex, history, line}` expects `{boss_reply, moves[], value, ko, tip}`.
- On fail/timeout/bad JSON: one quiet `error`, then offline regex scorer (cartridge `offlineMoves`) + canned boss replies; server is skipped for 30s, then retried.
- Body is JSON sent as `text/plain` (no CORS preflight; server must parse body regardless of type). Needs `Access-Control-Allow-Origin: *` (file:// Origin is `null`).
- Add a subject: new key in `FIRST_OFFER_CARTRIDGES` with lang, bosses[{name, opening, replies, tips, anchor?}], offlineMoves. No engine change.
