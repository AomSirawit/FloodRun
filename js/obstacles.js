/* ============================================================
 * obstacles.js — สิ่งกีดขวาง 4 แบบ: เกิดแบบสุ่ม, เคลื่อนที่, ชน, วาด
 *
 * การันตีว่าผ่านได้เสมอ: วางชิ้นใหม่โดยคำนวณ "เวลาที่จะมาถึงตัวผู้เล่น"
 * ให้ห่างจากชิ้นก่อนหน้าอย่างน้อย gap วินาที (พอให้ลงพื้นแล้วกระโดดใหม่)
 * คิดรวมความเร็วที่เร็วกว่าฉากของตัวเงินตัวทองด้วย
 * ============================================================ */
window.FR = window.FR || {};

FR.Obstacles = (function () {
  'use strict';
  const C = FR.CONFIG, W = C.WIDTH, G = C.GROUND_Y, D = FR.Draw;
  let list = [];

  function rand(a, b) { return a + Math.random() * (b - a); }

  function pickWeighted(weights) {
    const keys = Object.keys(weights);
    let total = 0;
    keys.forEach(function (k) { total += weights[k]; });
    let r = Math.random() * total;
    for (let i = 0; i < keys.length; i++) {
      r -= weights[keys[i]];
      if (r <= 0) return keys[i];
    }
    return keys[keys.length - 1];
  }

  function chooseType(meters) {
    const S = C.spawn;
    const w = { foam: S.weights.foam, manhole: S.weights.manhole };
    if (meters >= S.unlock.lizard) w.lizard = S.weights.lizard;
    if (meters >= S.unlock.cable) w.cable = S.weights.cable;
    return pickWeighted(w);
  }

  function create(type, speed) {
    const cfg = FR.Assets.spec('obs', type); // ค่าตอนมีภาพ หรือค่า fallback ตอนวาดเอง
    const o = { type: type, cfg: cfg, x: 0, y: 0, w: cfg.drawW, h: cfg.drawH, extra: 0, phase: Math.random() * 6.28 };
    if (type === 'foam') {
      const lw = C.spawn.foamLayerWeights;
      o.layers = pickWeighted({ 1: lw[0], 2: lw[1], 3: lw[2] }) | 0;
      o.cols = speed >= C.spawn.foamTwoColumnsFromSpeed && Math.random() < 0.35 ? 2 : 1;
      if (o.cols === 2 && o.layers === 3) o.layers = 2;
      o.w = cfg.drawW * o.cols;
      o.h = cfg.drawH * o.layers;
      o.y = G + cfg.sink - o.h;
      o.boxes = [];
      for (let c = 0; c < o.cols; c++) {
        for (let l = 0; l < o.layers; l++) {
          o.boxes.push({
            c: c, l: l, tilt: rand(-0.06, 0.06), dx: rand(-2, 2),
            label: FR.STRINGS.foamLabels[Math.floor(Math.random() * FR.STRINGS.foamLabels.length)],
          });
        }
      }
    } else if (type === 'manhole') {
      o.y = G - cfg.surfaceY * o.h;
    } else if (type === 'lizard') {
      o.y = G + cfg.sink - o.h;
      o.extra = rand(C.spawn.lizardExtraSpeed[0], C.spawn.lizardExtraSpeed[1]);
    } else if (type === 'cable') {
      o.y = G - cfg.bottomAboveGround - cfg.bottomAt * o.h;
    }
    return o;
  }

  function hitbox(o) {
    const hb = o.cfg.hitbox;
    const r = { x: o.x + o.w * hb.x, y: o.y + o.h * hb.y, w: o.w * hb.w, h: o.h * hb.h };
    if (o.type === 'cable') { // ยืดขึ้นไปถึงนอกจอ: กระโดดข้ามไม่ได้ ต้องก้มอย่างเดียว
      const bottom = r.y + r.h;
      r.y = -100;
      r.h = bottom + 100;
    }
    return r;
  }

  function reset() {
    list = [];
  }

  // pl = hitbox ของผู้เล่นตอนยืน {x, w}
  function spawnNext(speed, meters, pl) {
    const S = C.spawn;
    const o = create(chooseType(meters), speed);
    const rNew = speed + o.extra;
    const offset = hitbox(o).x - o.x;
    const last = list[list.length - 1];
    if (!last) {
      o.x = W + S.firstDelayPx;
    } else {
      const lb = hitbox(last);
      const lastEnd = (lb.x + lb.w - pl.x) / (speed + last.extra);
      let gap = S.gapBase + S.gapPx / speed + Math.random() * S.gapRandom;
      if (Math.random() < S.bigGapChance) gap += S.bigGapExtra;
      o.x = pl.x + pl.w + (lastEnd + gap) * rNew - offset;
      o.x = Math.max(o.x, W + 20);
    }
    list.push(o);
  }

  function update(dt, speed, meters, pl) {
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      o.x -= (speed + o.extra) * dt;
      o.phase += dt;
    }
    while (list.length && list[0].x + list[0].w < -160) list.shift();
    const last = list[list.length - 1];
    if (!last || last.x < W + 20) spawnNext(speed, meters, pl);
  }

  function collide(box) {
    for (let i = 0; i < list.length; i++) {
      const h = hitbox(list[i]);
      if (box.x < h.x + h.w && box.x + box.w > h.x && box.y < h.y + h.h && box.y + box.h > h.y) return list[i];
    }
    return null;
  }

  /* ---------- การวาด ---------- */
  function drawFoamBox(ctx, bw, bh, label) {
    D.rrect(ctx, -bw / 2, -bh / 2, bw, bh, 4);
    ctx.fillStyle = '#f7f5ee';
    ctx.fill();
    ctx.strokeStyle = '#aaa596';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    D.limb(ctx, -bw / 2 + 3, -bh / 2 + bh * 0.32, bw / 2 - 3, -bh / 2 + bh * 0.32, 1.2, '#d0ccbd');
    ctx.fillStyle = 'rgba(214,120,40,0.55)';
    ctx.beginPath();
    ctx.ellipse(bw * 0.22, bh * 0.18, 5, 3, 0.3, 0, Math.PI * 2);
    ctx.fill();
    D.fitText(ctx, label, bw - 14, 10, '600');
    ctx.fillStyle = '#9a8f78';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, -3, bh * 0.08);
  }

  function drawFoam(ctx, o) {
    const cfg = o.cfg, img = FR.Assets.get('obs-foam');
    const bob = Math.sin(o.phase * 2.2) * 1.5;
    for (let i = 0; i < o.boxes.length; i++) {
      const b = o.boxes[i];
      const cx = o.x + b.c * cfg.drawW + cfg.drawW / 2 + b.dx;
      const cy = o.y + o.h - (b.l + 0.5) * cfg.drawH + bob;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(b.tilt + Math.sin(o.phase * 1.7 + i) * 0.02);
      if (img) FR.Assets.draw(ctx, 'obs-foam', cfg.crop, -cfg.drawW / 2, -cfg.drawH / 2, cfg.drawW, cfg.drawH);
      else drawFoamBox(ctx, cfg.drawW, cfg.drawH, b.label);
      ctx.restore();
    }
  }

  function drawWhirl(ctx, cx, cy, rx, ry, t, alpha) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.rotate(-t * 5);
    ctx.strokeStyle = 'rgba(205,176,126,' + alpha + ')';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      for (let k = 0; k <= 20; k++) {
        const r = 3 + (k / 20) * (rx - 4);
        const a = arm * Math.PI * 2 / 3 + k * 0.22;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawManhole(ctx, o) {
    const img = FR.Assets.get('obs-manhole');
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    if (img) {
      FR.Assets.draw(ctx, 'obs-manhole', o.cfg.crop, o.x, o.y, o.w, o.h);
      // น้ำวนหมุนทับภาพ ตรงกลาง hitbox ที่ระดับผิวน้ำ
      const hb = o.cfg.hitbox, rx = hb.w * o.w * 0.45;
      drawWhirl(ctx, o.x + (hb.x + hb.w / 2) * o.w, G, rx, rx * 0.32, o.phase, 0.5);
      return;
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, o.w / 2, o.h / 2, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, o.w / 2);
    g.addColorStop(0, '#120b05');
    g.addColorStop(0.6, '#3a2814');
    g.addColorStop(1, '#7a5b37');
    ctx.fillStyle = g;
    ctx.fill();
    drawWhirl(ctx, cx, cy, o.w / 2 - 2, o.h / 2 - 1, o.phase, 0.85);
    ctx.strokeStyle = 'rgba(240,225,195,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, o.w / 2, o.h / 2, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    // ฝาท่อที่หลุดออกมา ตั้งเอียงอยู่ข้างหลุม
    ctx.save();
    ctx.translate(o.x + o.w - 4, cy - 10);
    ctx.rotate(0.35 + Math.sin(o.phase * 2) * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 15, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5e6266';
    ctx.fill();
    ctx.strokeStyle = '#3a3d40';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    D.limb(ctx, -3, -8, -3, 8, 1, '#7c8186');
    D.limb(ctx, 2, -8, 2, 8, 1, '#7c8186');
    ctx.restore();
  }

  function drawLizardShape(ctx, w, h, t) {
    const BODY = '#3d4a2c', SPOT = '#d8c25a', BELLY = '#7d7a4a';
    // หาง (ส่ายไปมา)
    const tw = Math.sin(t * 10) * 6;
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(w * 0.18, -5);
    ctx.quadraticCurveTo(w * 0.36, -4 + tw, w * 0.52, 2 + tw * 1.4);
    ctx.quadraticCurveTo(w * 0.36, 6 + tw * 0.5, w * 0.18, 7);
    ctx.closePath();
    ctx.fill();
    // ขาตีน้ำ
    for (let k = 0; k < 4; k++) {
      const lx = (k < 2 ? -w * 0.14 : w * 0.1) + (k % 2) * 4;
      const a = Math.sin(t * 14 + k * 1.6) * 0.7;
      D.limb(ctx, lx, 4, lx + Math.sin(a) * 9, 4 + Math.cos(a) * 9, 4, BODY);
    }
    // ลำตัว
    ctx.beginPath();
    ctx.ellipse(0, 2, w * 0.27, h * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = BODY;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 7, w * 0.22, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fillStyle = BELLY;
    ctx.fill();
    ctx.fillStyle = SPOT;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.ellipse(-w * 0.18 + k * w * 0.07, -3 + (k % 2) * 3, 2.4, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // คอ + หัว (หันซ้าย)
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, -6);
    ctx.quadraticCurveTo(-w * 0.3, -14, -w * 0.38, -12);
    ctx.lineTo(-w * 0.36, -2);
    ctx.quadraticCurveTo(-w * 0.28, 2, -w * 0.2, 6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-w * 0.41, -10, 11, 6.5, -0.1, 0, Math.PI * 2);
    ctx.fill();
    D.circle(ctx, -w * 0.42, -13, 2.2, '#f4e7b0');
    D.circle(ctx, -w * 0.425, -13, 1.1, '#111');
    // ลิ้นแลบ
    if (Math.sin(t * 7) > 0.4) {
      ctx.strokeStyle = '#e0475b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const tx = -w * 0.41 - 11;
      ctx.moveTo(tx, -9);
      ctx.lineTo(tx - 7, -9);
      ctx.lineTo(tx - 10, -12);
      ctx.moveTo(tx - 7, -9);
      ctx.lineTo(tx - 10, -6);
      ctx.stroke();
    }
  }

  function drawLizard(ctx, o) {
    const cfg = o.cfg, img = FR.Assets.get('obs-lizard');
    const bob = Math.sin(o.phase * 6) * 1.5;
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2 + bob);
    ctx.rotate(Math.sin(o.phase * 6) * 0.03);
    if (cfg.flipX) ctx.scale(-1, 1);
    if (img) FR.Assets.draw(ctx, 'obs-lizard', cfg.crop, -o.w / 2, -o.h / 2, o.w, o.h);
    else drawLizardShape(ctx, o.w, o.h, o.phase);
    ctx.restore();
    // คลื่นน้ำแตกหลังตัวที่ว่ายเร็ว
    ctx.strokeStyle = 'rgba(240,230,210,0.5)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) {
      const x = o.x + o.w * 0.75 + k * 12;
      ctx.beginPath();
      ctx.moveTo(x, G + 2 + k);
      ctx.quadraticCurveTo(x + 8, G - 3 + k, x + 16, G + 2 + k);
      ctx.stroke();
    }
  }

  function drawSparks(ctx, x, y) {
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      if (Math.random() < 0.35) continue;
      const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 9;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.stroke();
    D.circle(ctx, x, y, 2 + Math.random() * 1.5, 'rgba(255,250,200,0.9)');
  }

  // ต่อเสาไฟในภาพลงไปให้ถึงน้ำ (ภาพเสาสั้นกว่าระยะถึงผิวน้ำ)
  function drawPoles(ctx, o) {
    const poles = o.cfg.poles || [];
    const top = o.y + o.h - 3;
    for (let i = 0; i < poles.length; i++) {
      const pw = poles[i].w * o.w, px = o.x + poles[i].x * o.w - pw / 2;
      const g = ctx.createLinearGradient(px, 0, px + pw, 0);
      g.addColorStop(0, '#7d776d');
      g.addColorStop(0.45, '#aaa397');
      g.addColorStop(1, '#6f695f');
      ctx.fillStyle = g;
      ctx.fillRect(px, top, pw, G + 12 - top);
      ctx.fillStyle = '#3a3631';
      ctx.fillRect(px - 1, top, 1.6, G + 12 - top);
      ctx.fillRect(px + pw - 0.6, top, 1.6, G + 12 - top);
    }
  }

  function drawCable(ctx, o) {
    const img = FR.Assets.get('obs-cable');
    const cx = o.x + o.w / 2, bottom = o.y + o.h;
    const sway = Math.sin(o.phase * 2) * 0.04;
    if (img) {
      drawPoles(ctx, o);
      FR.Assets.draw(ctx, 'obs-cable', o.cfg.crop, o.x, o.y, o.w, o.h);
      const hb = o.cfg.hitbox;
      drawSparks(ctx, o.x + (hb.x + hb.w / 2) * o.w, o.y + o.cfg.bottomAt * o.h - 6);
      return;
    }
    const swayX = Math.sin(o.phase * 2) * 6;
    // สายไฟห้อยจากนอกจอด้านบน เป็นรูปตัว U
    for (let k = 0; k < 5; k++) {
      const low = bottom - 4 - k * 6;
      ctx.strokeStyle = k === 2 ? '#3c3c3c' : '#141414';
      ctx.lineWidth = k === 0 ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(o.x - 40 + k * 6, -10);
      ctx.quadraticCurveTo(cx + swayX, 2 * (low + 5), o.x + o.w + 40 - k * 6, -10);
      ctx.stroke();
    }
    // ขดสายพันกัน
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.ellipse(cx + swayX * 0.5 + (k - 2.5) * 3, bottom - 14, 9 + k, 5 + (k % 3), k * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    // ป้ายเตือน
    ctx.save();
    ctx.translate(cx + swayX * 0.5 + 18, bottom - 34);
    ctx.rotate(0.12 + sway * 2);
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(-18, -8, 36, 16);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-18, -8, 36, 16);
    D.fitText(ctx, FR.STRINGS.cableTag, 32, 10, '600');
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(FR.STRINGS.cableTag, 0, 1);
    ctx.restore();
    // ปลายสายขาดมีไฟช็อต
    D.limb(ctx, cx + swayX * 0.5 - 8, bottom - 10, cx + swayX * 0.5 - 12, bottom, 2, '#141414');
    drawSparks(ctx, cx + swayX * 0.5 - 12, bottom);
  }

  const DRAW = { foam: drawFoam, manhole: drawManhole, lizard: drawLizard, cable: drawCable };

  function draw(ctx) {
    for (let i = 0; i < list.length; i++) DRAW[list[i].type](ctx, list[i]);
  }

  function drawHitboxes(ctx) {
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = 2;
    for (let i = 0; i < list.length; i++) {
      const h = hitbox(list[i]);
      ctx.strokeRect(h.x, h.y, h.w, h.h);
    }
  }

  // รายการสิ่งกีดขวางพร้อม hitbox (อ่านอย่างเดียว ไว้ดีบัก/ทดสอบ)
  function items() {
    return list.map(function (o) { return { type: o.type, extra: o.extra, hitbox: hitbox(o) }; });
  }

  return { reset: reset, update: update, collide: collide, draw: draw, drawHitboxes: drawHitboxes, items: items };
})();
