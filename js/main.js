/* ============================================================
 * main.js — จุดเริ่มเกม: game loop, สลับ state, รับ input, ปรับขนาดจอ
 * state: loading → menu → playing ⇄ paused → over → playing / menu
 * ============================================================ */
(function () {
  'use strict';
  const C = FR.CONFIG, W = C.WIDTH, H = C.HEIGHT, G = C.GROUND_Y;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const stage = document.getElementById('stage');
  const CHAR_IDS = Object.keys(C.assets.characters);
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- localStorage (ใช้ไม่ได้ก็เล่นต่อได้) ---------- */
  const Store = {
    get: function (k, d) {
      try {
        const v = window.localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set: function (k, v) {
      try {
        window.localStorage.setItem(k, JSON.stringify(v));
      } catch (e) { /* โหมดส่วนตัว / ถูกบล็อก: ข้ามไป */ }
    },
  };
  const KEY_BEST = 'floodrun.best', KEY_CHAR = 'floodrun.char', KEY_MUTE = 'floodrun.muted';

  const game = {
    state: 'loading',
    selected: Math.max(0, CHAR_IDS.indexOf(Store.get(KEY_CHAR, 'office'))),
    best: Math.max(0, Number(Store.get(KEY_BEST, 0)) || 0),
    speed: 0, distance: 0, meters: 0, scroll: 0, time: 0,
    milestone: 0, flashTimer: 0, flashValue: 0,
    overTimer: 0, overShown: false, overData: null,
    shake: 0, hintTime: 0, runSplash: 0,
    toast: null, toastQueue: [], notified: {},
  };
  const player = new FR.Player();
  const input = { jumpPressed: false, jumpHeld: false, duckHeld: false };
  let touch = null;

  function clearInput() {
    input.jumpPressed = input.jumpHeld = input.duckHeld = false;
    touch = null;
  }

  /* ---------- สลับ state ---------- */
  function toMenu() {
    game.state = 'menu';
    clearInput();
    FR.Obstacles.reset();
    FR.FX.clear();
    game.meters = 0;
    FR.UI.setBest(game.best);
    FR.UI.setSelected(game.selected);
    FR.UI.show('menu');
  }

  function startGame() {
    if (game.state === 'playing' || game.state === 'loading') return;
    FR.Audio.unlock();
    clearInput();
    player.reset(CHAR_IDS[game.selected]);
    FR.Obstacles.reset();
    FR.FX.clear();
    Object.assign(game, {
      state: 'playing', speed: C.speed.start, distance: 0, meters: 0,
      milestone: 0, flashTimer: 0, flashValue: 0, overTimer: 0, overShown: false, overData: null,
      shake: 0, hintTime: 5, runSplash: 0, toast: null, toastQueue: [], notified: {},
    });
    FR.UI.show(null);
    FR.Audio.play('start');
  }

  function pauseGame() {
    if (game.state !== 'playing') return;
    game.state = 'paused';
    clearInput();
    FR.UI.show('pause');
    FR.Audio.play('pause');
  }

  function resumeGame() {
    if (game.state !== 'paused') return;
    game.state = 'playing';
    clearInput();
    FR.UI.show(null);
  }

  function gameOver(obstacle) {
    game.state = 'over';
    clearInput();
    player.dead = true;
    game.shake = reduceMotion ? 0 : 0.3;
    game.overTimer = 0;
    game.overShown = false;
    FR.Audio.play('hit');
    FR.FX.splash(player.x + 10, G, 26, 1.3);
    const meters = Math.floor(game.meters);
    const old = game.best;
    const newRecord = meters > old && old > 0;
    if (meters > game.best) {
      game.best = meters;
      Store.set(KEY_BEST, meters);
    }
    game.overData = { type: obstacle.type, charId: player.charId, meters: meters, best: game.best, newRecord: newRecord };
  }

  function tryRestart() {
    if (game.state === 'over' && game.overTimer > 0.7) startGame();
  }

  function selectChar(i) {
    if (game.state !== 'menu') return;
    game.selected = (i + CHAR_IDS.length) % CHAR_IDS.length;
    Store.set(KEY_CHAR, CHAR_IDS[game.selected]);
    FR.UI.setSelected(game.selected);
    FR.Audio.unlock();
    FR.Audio.play('select');
  }

  function toggleMute() {
    FR.Audio.unlock();
    const m = !FR.Audio.isMuted();
    FR.Audio.setMuted(m);
    Store.set(KEY_MUTE, m);
    FR.UI.setMuted(m);
  }

  function showToast(text) {
    if (game.toast) game.toastQueue.push(text);
    else game.toast = { text: text, t: 0, life: 2.8 };
  }

  /* ---------- อัปเดต ---------- */
  function stepPlaying(dt) {
    // แตะค้างไว้ ~70ms โดยยังไม่ปัดลง = กระโดด
    if (touch && touch.decided === null && performance.now() - touch.t0 >= 70) {
      touch.decided = 'jump';
      input.jumpPressed = true;
      input.jumpHeld = true;
    }

    game.time += dt;
    game.speed = Math.min(C.speed.max, game.speed + C.speed.accel * dt);
    const dx = game.speed * dt;
    game.scroll += dx;
    game.distance += dx;
    game.meters = game.distance / C.PX_PER_METER;

    const events = [];
    player.update(dt, input, game.speed, events);
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e === 'jump') {
        FR.Audio.play('jump');
        FR.FX.splash(player.x, G, 8, 0.7);
      } else if (e === 'land') {
        FR.Audio.play('land');
        FR.FX.splash(player.x, G, 16, 1);
      } else if (e === 'duck') {
        FR.Audio.play('duck');
      }
    }
    // ละอองน้ำตอนวิ่งลุยน้ำ
    if (player.onGround) {
      game.runSplash -= dt;
      if (game.runSplash <= 0) {
        const rider = player.charId === 'rider';
        FR.FX.splash(player.x + (rider ? -26 : -6), G, 3, rider ? 0.55 : 0.45);
        game.runSplash = rider ? 0.09 : 0.07;
      }
    }

    const hb = C.player.hitbox;
    FR.Obstacles.update(dt, game.speed, game.meters, { x: player.x - hb.w / 2, w: hb.w });

    const m = Math.floor(game.meters / C.milestoneEvery);
    if (m > game.milestone) {
      game.milestone = m;
      game.flashTimer = 1.2;
      game.flashValue = m * C.milestoneEvery;
      FR.Audio.play('milestone');
    }
    if (game.flashTimer > 0) game.flashTimer -= dt;
    if (game.hintTime > 0) game.hintTime -= dt;

    const U = C.spawn.unlock;
    if (game.meters >= U.lizard && !game.notified.lizard) {
      game.notified.lizard = true;
      showToast(FR.STRINGS.toasts.lizard);
    }
    if (game.meters >= U.cable && !game.notified.cable) {
      game.notified.cable = true;
      showToast(FR.STRINGS.toasts.cable);
    }
    if (game.toast) {
      game.toast.t += dt;
      if (game.toast.t >= game.toast.life) {
        const next = game.toastQueue.shift();
        game.toast = next ? { text: next, t: 0, life: 2.8 } : null;
      }
    }

    FR.FX.update(dt, game.speed, true);

    const hit = FR.Obstacles.collide(player.getHitbox());
    if (hit) gameOver(hit);
  }

  function update(dt) {
    switch (game.state) {
      case 'menu':
        game.time += dt;
        game.scroll += C.speed.menu * dt;
        FR.FX.update(dt, C.speed.menu, true);
        break;
      case 'playing':
        stepPlaying(dt);
        break;
      case 'over':
        game.time += dt;
        game.overTimer += dt;
        if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);
        FR.FX.update(dt, 0, false);
        if (!game.overShown && game.overTimer > 0.45) {
          game.overShown = true;
          FR.UI.showGameOver(game.overData);
          if (game.overData.newRecord) FR.Audio.play('record');
        }
        break;
      default:
        break; // loading / paused: หยุดทุกอย่าง
    }
  }

  /* ---------- วาด ---------- */
  function render() {
    const pr = FR.pixelRatio || 1;
    ctx.setTransform(pr, 0, 0, pr, 0, 0);
    if (game.state === 'loading') {
      ctx.fillStyle = '#1b2733';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    ctx.save();
    if (game.shake > 0) {
      const s = game.shake * C.comfort.shake * 3;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }
    const inGame = game.state !== 'menu';
    FR.Background.drawBack(ctx, game.scroll, game.time, game.meters);
    FR.Background.drawMainWater(ctx, game.scroll, game.time);
    FR.FX.drawRipples(ctx);
    FR.Background.drawDebris(ctx, game.scroll, game.time);
    if (inGame) {
      FR.Obstacles.draw(ctx);
      player.draw(ctx);
    }
    FR.FX.drawSplash(ctx);
    FR.Background.drawFrontWater(ctx, game.scroll, game.time);
    FR.FX.drawRain(ctx);
    FR.FX.drawFlash(ctx);
    if (inGame && C.debugHitboxes) {
      FR.Obstacles.drawHitboxes(ctx);
      const h = player.getHitbox();
      ctx.strokeStyle = '#3bff6b';
      ctx.lineWidth = 2;
      ctx.strokeRect(h.x, h.y, h.w, h.h);
    }
    ctx.restore();
    if (inGame) {
      FR.UI.drawHUD(ctx, {
        meters: game.meters, best: game.best,
        flashTimer: game.flashTimer, flashValue: game.flashValue,
        hintTime: game.state === 'playing' ? game.hintTime : 0,
        toast: game.state === 'playing' ? game.toast : null,
      });
    }
  }

  /* ---------- game loop: fixed step ฟิสิกส์ + วาดทุกเฟรม ---------- */
  let last = 0, acc = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = last ? (now - last) / 1000 : 0;
    last = now;
    if (dt > 0.1) dt = 0.1; // กลับมาจากแท็บอื่น/เครื่องค้าง ไม่ให้กระโดดข้ามเวลา
    acc += dt;
    let steps = 0;
    while (acc >= C.STEP && steps < 20) {
      update(C.STEP);
      acc -= C.STEP;
      steps++;
    }
    render();
    if (game.state === 'menu') FR.UI.renderPreviews(game.time);
  }

  /* ---------- ปรับขนาดจอ + high-DPI ---------- */
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / H);
    const cssW = Math.floor(W * scale), cssH = Math.floor(H * scale);
    stage.style.width = cssW + 'px';
    stage.style.height = cssH + 'px';
    stage.style.left = Math.floor((vw - cssW) / 2) + 'px';
    stage.style.top = Math.floor((vh - cssH) / 2) + 'px';
    stage.style.setProperty('--btn', Math.round(Math.max(28, Math.min(42, cssW * 0.044))) + 'px');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    FR.pixelRatio = canvas.width / W;
  }

  /* ---------- Input ---------- */
  const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
  const DUCK_KEYS = ['ArrowDown', 'KeyS'];
  const PREVENT_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'];

  window.addEventListener('keydown', function (e) {
    const k = e.code;
    if (PREVENT_KEYS.indexOf(k) >= 0) e.preventDefault();
    FR.Audio.unlock();
    if (k === 'KeyH' && !e.repeat) C.debugHitboxes = !C.debugHitboxes;

    switch (game.state) {
      case 'menu':
        if (e.repeat) break;
        if (k === 'ArrowLeft') selectChar(game.selected - 1);
        else if (k === 'ArrowRight') selectChar(game.selected + 1);
        else if (k === 'Enter' || k === 'Space') startGame();
        break;
      case 'playing':
        if (JUMP_KEYS.indexOf(k) >= 0) {
          if (!e.repeat) input.jumpPressed = true;
          input.jumpHeld = true;
        } else if (DUCK_KEYS.indexOf(k) >= 0) {
          input.duckHeld = true;
        } else if ((k === 'KeyP' || k === 'Escape') && !e.repeat) {
          pauseGame();
        }
        break;
      case 'paused':
        if (!e.repeat && (k === 'KeyP' || k === 'Escape' || k === 'Enter' || k === 'Space')) resumeGame();
        break;
      case 'over':
        if (e.repeat) break;
        if (k === 'Space' || k === 'Enter' || k === 'ArrowUp') tryRestart();
        else if (k === 'Escape' && game.overTimer > 0.7) toMenu();
        break;
      default:
        break;
    }
  });

  window.addEventListener('keyup', function (e) {
    if (PREVENT_KEYS.indexOf(e.code) >= 0) e.preventDefault();
    if (JUMP_KEYS.indexOf(e.code) >= 0) input.jumpHeld = false;
    if (DUCK_KEYS.indexOf(e.code) >= 0) input.duckHeld = false;
  });

  const SWIPE_PX = 28;
  document.addEventListener('pointerdown', function (e) {
    if (e.target.closest && e.target.closest('button')) return;
    if (game.state === 'playing') {
      e.preventDefault();
      if (touch) return;
      if (e.pointerType === 'mouse') {
        if (e.button !== 0) return;
        touch = { id: e.pointerId, y0: e.clientY, t0: performance.now(), decided: 'jump', mouse: true };
        input.jumpPressed = true;
        input.jumpHeld = true;
      } else {
        touch = { id: e.pointerId, y0: e.clientY, t0: performance.now(), decided: null, mouse: false };
      }
    } else if (game.state === 'over') {
      e.preventDefault();
      tryRestart();
    }
  }, { passive: false });

  document.addEventListener('pointermove', function (e) {
    if (!touch || touch.mouse || e.pointerId !== touch.id || game.state !== 'playing') return;
    if (e.clientY - touch.y0 > SWIPE_PX && touch.decided !== 'duck') {
      touch.decided = 'duck';
      input.duckHeld = true;
      input.jumpHeld = false;
    }
  });

  function endPointer(e) {
    FR.Audio.unlock();
    if (!touch || e.pointerId !== touch.id) return;
    if (game.state === 'playing') {
      if (touch.decided === null) { // แตะสั้นๆ = กระโดดเตี้ย
        input.jumpPressed = true;
        input.jumpHeld = false;
      } else if (touch.decided === 'jump') {
        input.jumpHeld = false;
      } else {
        input.duckHeld = false;
      }
    }
    touch = null;
  }
  document.addEventListener('pointerup', endPointer);
  document.addEventListener('pointercancel', endPointer);

  // กันซูม/เลื่อนหน้าบนมือถือ (ยกเว้นเลื่อนในหน้าเมนูถ้าจอเตี้ยมาก)
  document.addEventListener('touchmove', function (e) {
    if (game.state === 'playing' || !(e.target.closest && e.target.closest('.overlay.show'))) e.preventDefault();
  }, { passive: false });
  ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { e.preventDefault(); }, { passive: false });
  });

  // หยุดเกมอัตโนมัติเมื่อสลับแท็บ / ออกจากหน้าต่าง
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) pauseGame();
  });
  window.addEventListener('blur', pauseGame);

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', function () { setTimeout(resize, 150); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  /* ---------- เริ่มต้น ---------- */
  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // ข้อความบน canvas ต้องรอฟอนต์ไทยโหลดเสร็จก่อน
  function loadFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['400', '600', '800'].map(function (w) {
      return document.fonts.load(w + ' 20px Kanit', 'กขค');
    })).then(function () { return document.fonts.ready; }).catch(function () {});
  }

  function boot() {
    FR.Audio.setMuted(!!Store.get(KEY_MUTE, false));
    FR.UI.init({
      onSelect: function (i) { selectChar(i); },
      onStart: function () { if (game.state === 'menu') startGame(); },
      onResume: resumeGame,
      onRetry: function () { tryRestart(); },
      onMenu: function () {
        if (game.state === 'paused' || (game.state === 'over' && game.overShown)) toMenu();
      },
      onPause: pauseGame,
      onMute: toggleMute,
    });
    FR.UI.setMuted(FR.Audio.isMuted());
    resize();
    requestAnimationFrame(loop);

    // รอฟอนต์ + ภาพ (ไม่เกิน 4 วินาที ถ้าเน็ตช้าก็เริ่มด้วยฟอนต์สำรองไปก่อน)
    Promise.race([Promise.all([loadFonts(), FR.Assets.load()]), wait(4000)]).then(function () {
      FR.Background.init();
      FR.FX.init();
      toMenu();
    });
  }

  boot();
})();
