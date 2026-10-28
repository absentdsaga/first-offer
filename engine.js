/* FIRST OFFER voice + scoring engine. Plain browser JS, no build. Exposes window.FirstOffer. */
(function () {
  'use strict';
  var config = { url: 'https://dioni.zo.space/api/first-offer', timeoutMs: 8000, offline: false, retryAfterMs: 30000,
    contentType: 'text/plain;charset=UTF-8' };   // JSON body; text/plain skips the CORS preflight round trip
  var handlers = {};
  var S = null;               // game state
  var gen = 0;                // bumps on start(); drops stale async results
  var remoteDownUntil = 0;
  var rec = null, wantListen = false, recRunning = false, bossTalking = false, talkTimer = null;

  function emit(ev, data) {
    (handlers[ev] || []).slice().forEach(function (cb) {
      try { cb(data); } catch (e) { if (window.console) console.warn('[FirstOffer] handler error', ev, e); }
    });
  }
  function on(ev, cb) { (handlers[ev] = handlers[ev] || []).push(cb); return api; }
  function off(ev, cb) { handlers[ev] = (handlers[ev] || []).filter(function (f) { return f !== cb; }); return api; }
  function carts() { return window.FIRST_OFFER_CARTRIDGES || {}; }
  function clamp(n) { return Math.max(0, Math.min(100, n)); }
  function pick(arr, avoid) {
    if (!arr || !arr.length) return '';
    var c = arr[Math.floor(Math.random() * arr.length)];
    if (c === avoid && arr.length > 1) return pick(arr, avoid);
    return c;
  }
  function toRe(r) { return r instanceof RegExp ? r : new RegExp(String(r), 'i'); }

  // ---------- numbers (digits, k/thousand/grand, simple English words) ----------
  var ONES = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
  var TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  function wordsToDigits(t) {
    return t.replace(/\b((?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and|a)\b[\s-]*)+/gi, function (m) {
      var words = m.toLowerCase().split(/[\s-]+/).filter(Boolean), total = 0, cur = 0, any = false;
      words.forEach(function (w) {
        if (w in ONES) { cur += ONES[w]; any = true; } else if (w in TENS) { cur += TENS[w]; any = true; }
        else if (w === 'hundred') { cur = (cur || 1) * 100; any = true; }
        else if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; any = true; }
      });
      if (!any) return m;
      var lead = /^\s/.test(m) ? ' ' : '', tail = /\s$/.test(m) ? ' ' : '';
      return lead + (total + cur) + tail;
    });
  }
  function numbersIn(text, anchor) {
    var out = [], re = /\$?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k\b|thousand|grand)?/gi, m;
    var t = wordsToDigits(text);
    while ((m = re.exec(t))) {
      var n = parseFloat(m[1].replace(/,/g, ''));
      if (m[2]) n *= 1000; else if (anchor >= 1000 && n >= 10 && n < 1000) n *= 1000;
      if (isFinite(n)) out.push(n);
    }
    return out;
  }
  function betterNumbers(text, boss) {
    if (!boss || !boss.anchor) return [];
    var lo = boss.range ? boss.range[0] : boss.anchor * 0.5, hi = boss.range ? boss.range[1] : boss.anchor * 2;
    return numbersIn(text, boss.anchor).filter(function (n) {
      var better = boss.direction === 'down' ? n < boss.anchor : n > boss.anchor;
      return better && n >= lo && n <= hi;
    });
  }

  // ---------- offline fallback scorer ----------
  function scoreOffline(line) {
    var cart = S.cart, boss = S.boss, words = line.trim().split(/\s+/).filter(Boolean).length;
    var lastBoss = ''; for (var i = S.history.length - 1; i >= 0; i--) if (S.history[i].who === 'boss') { lastBoss = S.history[i].text; break; }
    var moves = [], ko = false, nums = betterNumbers(line, boss);
    (cart.offlineMoves || []).forEach(function (r) {
      if (r.match && !toRe(r.match).test(line)) return;
      if (r.notMatch && toRe(r.notMatch).test(line)) return;
      if (r.minWords && words < r.minWords) return;
      if (r.maxWords && words > r.maxWords) return;
      if (r.bossAsked && lastBoss.indexOf('?') < 0) return;
      if (r.betterNumber && !nums.length) return;
      moves.push({ name: r.name, dmg: r.dmg, target: r.target });
      if (r.ko) ko = true;
    });
    if (!moves.length && cart.offlineDefault) moves.push(cart.offlineDefault);
    var toBoss = 0, toPlayer = 0;
    moves.forEach(function (m) { if (m.target === 'player') toPlayer += m.dmg; else toBoss += m.dmg; });
    var bossHPAfter = clamp(S.bossHP - toBoss), value;
    if (cart.valueMode === 'dollars') {
      if (nums.length) {
        var best = boss.direction === 'down' ? Math.min.apply(null, nums) : Math.max.apply(null, nums);
        if (S.bestAsk == null || (boss.direction === 'down' ? best < S.bestAsk : best > S.bestAsk)) S.bestAsk = best;
      }
      value = S.bestAsk == null ? 0 : Math.round(Math.abs(S.bestAsk - boss.anchor) * (100 - bossHPAfter) / 100);
    } else {
      value = Math.max(0, S.value + toBoss * 10 - toPlayer * 5);
    }
    var R = boss.replies || {}, pool = toBoss > toPlayer ? R.hurt : toPlayer > toBoss ? R.strong : R.neutral;
    var reply = pick(pool || R.neutral, S.lastCanned) || '...';
    S.lastCanned = reply;
    return { boss_reply: reply, moves: moves, value: value, ko: ko, tip: pick(boss.tips || cart.tips), offline: true };
  }

  // ---------- remote scorer ----------
  function scoreRemote(line, history) {
    if (config.offline || !window.fetch || Date.now() < remoteDownUntil) return Promise.reject(new Error('offline mode'));
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, config.timeoutMs);
    return fetch(config.url, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': config.contentType },
      body: JSON.stringify({ cartridge: S.cart.id, boss: S.boss.name, bossIndex: S.bossIndex, history: history, line: line }),
      signal: ctl ? ctl.signal : undefined
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (d) {
      if (!d || typeof d.boss_reply !== 'string' || !Array.isArray(d.moves)) throw new Error('bad response shape');
      d.moves = d.moves.filter(function (m) { return m && isFinite(Number(m.dmg)); }).map(function (m) {
        return { name: String(m.name || 'HIT'), dmg: Math.max(0, Math.min(100, Number(m.dmg))), target: m.target === 'player' ? 'player' : 'boss' };
      });
      return d;
    }).then(function (d) { clearTimeout(timer); return d; }, function (e) {
      clearTimeout(timer);
      throw (e && e.name === 'AbortError') ? new Error('timeout after ' + config.timeoutMs + 'ms') : e;
    });
  }

  // ---------- game flow ----------
  function start(cartridgeId, bossIndex) {
    var cart = carts()[cartridgeId];
    if (!cart) { emit('error', { message: 'Unknown cartridge: ' + cartridgeId }); return; }
    var bi = Math.max(0, Math.min(cart.bosses.length - 1, bossIndex | 0));
    gen++;
    if (window.speechSynthesis) speechSynthesis.cancel();
    S = { cart: cart, cartId: cartridgeId, bossIndex: bi, boss: cart.bosses[bi], history: [], bossHP: 100, playerHP: 100,
          value: 0, over: false, busy: false, queued: null, bestAsk: null, lastCanned: null, tip: '' };
    if (rec) rec.lang = cart.lang;
    emit('score', { bossHP: 100, playerHP: 100, value: 0 });
    bossSay(S.boss.opening);
  }

  function say(text) {
    text = String(text == null ? '' : text).trim();
    if (!text) return;
    if (!S) { emit('error', { message: 'Call start() first' }); return; }
    if (S.over) return;
    if (S.busy) { S.queued = text; return; }
    var g = gen, history = S.history.slice();
    S.busy = true;
    if (window.speechSynthesis && bossTalking) speechSynthesis.cancel();
    S.history.push({ who: 'player', text: text });
    emit('playerLine', { text: text });
    emit('thinking', { on: true });
    scoreRemote(text, history).catch(function (e) {
      if (g !== gen) throw e;
      if (!config.offline && Date.now() >= remoteDownUntil) {
        remoteDownUntil = Date.now() + config.retryAfterMs;
        emit('error', { message: 'Scoring server unavailable (' + (e && e.message) + '); using offline scorer', quiet: true });
      }
      return scoreOffline(text);
    }).then(function (r) {
      if (g !== gen) return;
      emit('thinking', { on: false });
      apply(r);
      S.busy = false;
      if (S.queued && !S.over) { var q = S.queued; S.queued = null; say(q); }
    }).catch(function (e) {
      if (g !== gen) return;
      S.busy = false;
      emit('thinking', { on: false });
      emit('error', { message: 'Engine error: ' + (e && e.message) });
    });
  }

  function apply(r) {
    (r.moves || []).forEach(function (m) {
      if (m.target === 'player') S.playerHP = clamp(S.playerHP - m.dmg); else S.bossHP = clamp(S.bossHP - m.dmg);
      emit('hit', { move: m.name, dmg: m.dmg, target: m.target });
    });
    if (isFinite(Number(r.value))) S.value = Math.round(Number(r.value));
    if (r.tip) S.tip = String(r.tip);
    emit('score', { bossHP: S.bossHP, playerHP: S.playerHP, value: S.value, tip: S.tip, offline: !!r.offline });
    var ko = S.bossHP <= 0 || S.playerHP <= 0 || !!r.ko;
    if (r.boss_reply) bossSay(r.boss_reply);
    if (ko) {
      S.over = true;
      var winner = S.bossHP <= 0 ? 'player' : S.playerHP <= 0 ? 'boss' : (S.bossHP <= S.playerHP ? 'player' : 'boss');
      var unit = S.cart.valueMode === 'dollars' ? '$' + S.value.toLocaleString() + ' above the first offer' : S.value + ' ' + (S.cart.valueLabel || 'points');
      var summary = (winner === 'player' ? 'K.O.! You beat ' : 'K.O.! You lost to ') + S.boss.name + ': ' + unit + '.' + (S.tip ? ' Tip: ' + S.tip : '');
      emit('ko', { winner: winner, value: S.value, summary: summary });
    }
  }

  // ---------- boss voice (speechSynthesis) ----------
  function pickVoice(lang) {
    if (!window.speechSynthesis) return null;
    var vs = speechSynthesis.getVoices() || [], l = (lang || '').toLowerCase(), base = l.split('-')[0];
    var norm = function (v) { return (v.lang || '').toLowerCase().replace('_', '-'); };
    return vs.filter(function (v) { return norm(v) === l; })[0] || vs.filter(function (v) { return norm(v).split('-')[0] === base; })[0] || null;
  }
  function bossSay(text) {
    S.history.push({ who: 'boss', text: text });
    emit('bossLine', { text: text });
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    try {
      var u = new SpeechSynthesisUtterance(text), v = pickVoice(S.cart.lang);
      u.lang = S.cart.lang; u.pitch = 0.4; u.rate = 1.05;
      if (v) u.voice = v;
      var done = function () { if (u._done) return; u._done = true; clearTimeout(talkTimer); bossTalking = false; resumeRec(); };
      u.onend = done; u.onerror = done;
      bossTalking = true;
      pauseRec();
      clearTimeout(talkTimer);
      talkTimer = setTimeout(done, 2500 + text.length * 90);   // safety net if onend never fires
      speechSynthesis.speak(u);
    } catch (e) { bossTalking = false; resumeRec(); }
  }
  if (window.speechSynthesis && speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', function () {});

  // ---------- mic (Web Speech API) ----------
  function makeRec() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    var r = new SR();
    r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
    r.onstart = function () { recRunning = true; };
    r.onresult = function (e) {
      if (bossTalking) return;
      var interim = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        var t = e.results[i][0].transcript;
        if (e.results[i].isFinal) { emit('interim', { text: '' }); say(t); } else interim += t;
      }
      if (interim) emit('interim', { text: interim });
    };
    r.onerror = function (e) {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') wantListen = false;
      emit('error', { message: 'Mic: ' + e.error });
    };
    r.onend = function () {
      recRunning = false;
      if (wantListen && !bossTalking) setTimeout(resumeRec, 250);   // Chrome stops after silence; keep it alive
    };
    return r;
  }
  function listen() {
    if (!rec) rec = makeRec();
    if (!rec) { emit('error', { message: 'Speech recognition not supported in this browser (use Chrome). Typing still works.' }); return false; }
    wantListen = true;
    if (S) rec.lang = S.cart.lang;
    resumeRec();
    return true;
  }
  function stopListening() { wantListen = false; pauseRec(); emit('interim', { text: '' }); }
  function pauseRec() { if (rec && recRunning) { try { rec.abort(); } catch (e) {} } }
  function resumeRec() {
    if (!rec || !wantListen || bossTalking || recRunning || (S && S.over)) return;
    try { if (S) rec.lang = S.cart.lang; rec.start(); recRunning = true; } catch (e) { /* already started */ }
  }

  var api = {
    start: start, say: say, listen: listen, stopListening: stopListening, on: on, off: off, config: config,
    isListening: function () { return wantListen; },
    state: function () { return S && { cartridge: S.cartId, bossIndex: S.bossIndex, boss: S.boss.name, bossHP: S.bossHP, playerHP: S.playerHP, value: S.value, over: S.over, history: S.history.slice() }; },
    cartridges: carts,
    _scoreOffline: function (line) { return S ? scoreOffline(line) : null; }
  };
  window.FirstOffer = api;
})();
