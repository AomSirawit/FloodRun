/* ============================================================
 * ui.js — หน้าจอ DOM (เมนู / หยุดเกม / Game Over), การ์ดตัวละคร และ HUD บน canvas
 * ============================================================ */
window.FR = window.FR || {};

FR.UI = (function () {
  'use strict';
  const C = FR.CONFIG, S = FR.STRINGS, W = C.WIDTH;
  const $ = function (id) { return document.getElementById(id); };
  const CHAR_IDS = Object.keys(C.assets.characters);
  const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  const screens = {
    loading: $('screen-loading'),
    menu: $('screen-menu'),
    pause: $('screen-pause'),
    over: $('screen-over'),
  };
  let cards = [];
  let selected = 0;
  let current = 'loading';

  function t(path) {
    return path.split('.').reduce(function (o, k) { return o ? o[k] : undefined; }, S);
  }

  function fmt(n) {
    return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function applyTexts() {
    document.title = S.pageTitle;
    document.querySelectorAll('[data-t]').forEach(function (el) {
      const v = t(el.getAttribute('data-t'));
      if (typeof v === 'string') el.textContent = v;
    });
    $('game').setAttribute('aria-label', S.canvasLabel);
    $('btn-pause').setAttribute('aria-label', S.hud.pause);
    $('btn-pause').title = S.hud.pause;
    $('howto').textContent = isTouch ? S.menu.howtoTouch : S.menu.howtoKeys;
    $('howto-select').textContent = isTouch ? '' : S.menu.howtoKeysSelect;
    $('over-hint').textContent = isTouch ? S.over.hintTouch : S.over.hintKeys;
  }

  function buildCards(onSelect) {
    const wrap = $('cards');
    wrap.innerHTML = '';
    cards = CHAR_IDS.map(function (id, i) {
      const info = S.characters[id];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.setAttribute('role', 'radio');
      const cv = document.createElement('canvas');
      cv.className = 'card-preview';
      const name = document.createElement('span');
      name.className = 'card-name';
      name.textContent = info.name;
      const desc = document.createElement('span');
      desc.className = 'card-desc';
      desc.textContent = info.desc;
      btn.appendChild(cv);
      btn.appendChild(name);
      btn.appendChild(desc);
      btn.addEventListener('click', function () { onSelect(i); });
      wrap.appendChild(btn);
      return { id: id, el: btn, canvas: cv, ctx: cv.getContext('2d') };
    });
  }

  function init(h) {
    applyTexts();
    buildCards(h.onSelect);
    $('btn-start').addEventListener('click', h.onStart);
    $('btn-resume').addEventListener('click', h.onResume);
    $('btn-pause-menu').addEventListener('click', h.onMenu);
    $('btn-retry').addEventListener('click', h.onRetry);
    $('btn-over-menu').addEventListener('click', h.onMenu);
    $('btn-pause').addEventListener('click', h.onPause);
    $('btn-mute').addEventListener('click', h.onMute);
  }

  function show(name) {
    current = name;
    Object.keys(screens).forEach(function (k) {
      screens[k].classList.toggle('show', k === name);
    });
    $('btn-pause').hidden = name !== null;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (name === 'pause') $('btn-resume').focus({ preventScroll: true });
  }

  function setSelected(i) {
    selected = i;
    cards.forEach(function (c, k) {
      c.el.classList.toggle('selected', k === i);
      c.el.setAttribute('aria-checked', k === i ? 'true' : 'false');
    });
  }

  function setBest(m) {
    $('menu-best').textContent = fmt(m);
  }

  function setMuted(m) {
    const b = $('btn-mute');
    b.classList.toggle('muted', m);
    b.setAttribute('aria-label', m ? S.hud.unmute : S.hud.mute);
    b.title = m ? S.hud.unmute : S.hud.mute;
  }

  // d = { type, charId, meters, best, newRecord }
  function showGameOver(d) {
    $('over-msg').textContent = pick(S.crash[d.type]);
    $('over-late').textContent = pick(S.late[d.charId]);
    $('over-distance').textContent = fmt(d.meters) + ' ' + S.hud.unit;
    $('over-best').textContent = fmt(d.best) + ' ' + S.hud.unit;
    $('over-record').hidden = !d.newRecord;
    show('over');
  }

  /* ----- ภาพตัวละครวิ่งบนการ์ด ----- */
  const PV_W = 150, PV_H = 134, PV_FEET = 112;
  function renderPreviews(time) {
    if (current !== 'menu') return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    cards.forEach(function (c, k) {
      const cw = c.canvas.clientWidth, ch = c.canvas.clientHeight;
      if (!cw || !ch) return;
      const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
      if (c.canvas.width !== pw || c.canvas.height !== ph) {
        c.canvas.width = pw;
        c.canvas.height = ph;
      }
      const ctx = c.ctx;
      const sc = Math.min(pw / PV_W, ph / PV_H);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      ctx.setTransform(sc, 0, 0, sc, (pw - PV_W * sc) / 2, ph - PV_H * sc);
      const active = k === selected;
      FR.drawCharacter(ctx, c.id, PV_W / 2, PV_FEET, {
        phase: active ? time * 11 : time * 2.5 + k,
        airborne: false, ducking: false, dead: false, vy: 0, squash: 0,
      });
      // น้ำท่วมเท้า
      ctx.beginPath();
      ctx.moveTo(-200, PV_H + 50);
      for (let x = -200; x <= PV_W + 200; x += 8) {
        ctx.lineTo(x, PV_FEET + 4 + Math.sin(x * 0.08 + time * (active ? 6 : 2)) * 2);
      }
      ctx.lineTo(PV_W + 200, PV_H + 50);
      ctx.closePath();
      ctx.fillStyle = 'rgba(122,92,56,0.75)';
      ctx.fill();
    });
  }

  /* ----- HUD บน canvas -----
   * d = { meters, best, flashTimer, flashValue, hintTime, toast } */
  function drawHUD(ctx, d) {
    ctx.save();
    ctx.textBaseline = 'top';
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    const flashing = d.flashTimer > 0;
    const value = flashing ? d.flashValue : d.meters;
    const curText = S.hud.distance + ' ' + fmt(value) + ' ' + S.hud.unit;
    const x = W - 22, y = 14;
    ctx.font = '600 26px Kanit, sans-serif';
    // วัดความกว้างจากตัวเลข 0 ทั้งหมด ตำแหน่งสถิติจะได้ไม่ขยับตามตัวเลข
    const curW = ctx.measureText(S.hud.distance + ' ' + fmt(value).replace(/\d/g, '0') + ' ' + S.hud.unit).width;
    if (!flashing || Math.floor(d.flashTimer * 8) % 2 === 0) {
      ctx.fillStyle = flashing ? '#ffd23f' : '#ffffff';
      ctx.fillText(curText, x, y);
    }
    ctx.font = '400 20px Kanit, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.78)';
    ctx.fillText(S.hud.best + ' ' + fmt(d.best) + ' ' + S.hud.unit, x - curW - 22, y + 5);

    ctx.shadowColor = 'transparent';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // คำแนะนำช่วงแรก
    if (d.hintTime > 0) {
      const a = Math.min(1, d.hintTime / 0.8);
      const txt = isTouch ? S.hud.hintTouch : S.hud.hintKeys;
      ctx.globalAlpha = a;
      ctx.font = '400 18px Kanit, sans-serif';
      const tw = ctx.measureText(txt).width + 36;
      FR.Draw.rrect(ctx, W / 2 - tw / 2, 78, tw, 36, 18);
      ctx.fillStyle = 'rgba(15,24,32,0.62)';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(txt, W / 2, 97);
    }

    // ป้ายเตือนสิ่งกีดขวางใหม่
    if (d.toast) {
      const k = d.toast.t;
      const a = Math.min(1, k / 0.25, (d.toast.life - k) / 0.4);
      const yy = 150 - Math.max(0, 0.25 - k) * 60;
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = '600 24px Kanit, sans-serif';
      const tw = ctx.measureText(d.toast.text).width + 44;
      FR.Draw.rrect(ctx, W / 2 - tw / 2, yy - 23, tw, 46, 23);
      ctx.fillStyle = '#ffd23f';
      ctx.fill();
      ctx.strokeStyle = '#7a4a12';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#3a2208';
      ctx.fillText(d.toast.text, W / 2, yy + 1);
    }
    ctx.restore();
  }

  return {
    init: init,
    show: show,
    setSelected: setSelected,
    setBest: setBest,
    setMuted: setMuted,
    showGameOver: showGameOver,
    renderPreviews: renderPreviews,
    drawHUD: drawHUD,
    current: function () { return current; },
  };
})();
