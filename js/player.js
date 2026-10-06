/* ============================================================
 * player.js — ตัวละคร: ฟิสิกส์กระโดด/ก้ม, hitbox และการวาด
 * ============================================================ */
window.FR = window.FR || {};

(function () {
  'use strict';
  const C = FR.CONFIG, G = C.GROUND_Y, D = FR.Draw;

  /* ---------- รูปวาดแทนภาพ (การ์ตูนง่ายๆ) ----------
   * วาดในพิกัดของตัวเอง: จุด (0,0) = กึ่งกลางเท้า, สูง 120 หน่วย (y ติดลบ = ขึ้นบน)
   * แล้วค่อยย่อ/ขยายให้เท่ากับ drawW/drawH ใน config */
  const UNIT_H = 120;
  const UNIT_W = { office: 80, student: 80, rider: 96 };
  const SKIN = '#f0c08a', SKIN_DARK = '#d9a571';

  function leg(ctx, hipX, hipY, a, len, thigh, shin, foot) {
    const kx = hipX + Math.sin(a) * len, ky = hipY + Math.cos(a) * len;
    const b = a - 0.25 - Math.max(0, -a) * 1.3;
    const fx = kx + Math.sin(b) * len, fy = ky + Math.cos(b) * len;
    D.limb(ctx, hipX, hipY, kx, ky, 9, thigh);
    D.limb(ctx, kx, ky, fx, fy, 8, shin);
    ctx.beginPath();
    ctx.ellipse(fx + 3, fy, 6.5, 3.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = foot;
    ctx.fill();
    return { kx: kx, ky: ky, fx: fx, fy: fy, b: b };
  }

  function eyes(ctx, x, y, dead) {
    if (dead) {
      ctx.strokeStyle = '#1b1b1b';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x - 2.5, y - 2.5); ctx.lineTo(x + 2.5, y + 2.5);
      ctx.moveTo(x + 2.5, y - 2.5); ctx.lineTo(x - 2.5, y + 2.5);
      ctx.stroke();
    } else {
      D.circle(ctx, x, y, 2.6, '#ffffff');
      D.circle(ctx, x + 0.8, y, 1.5, '#1b1b1b');
    }
  }

  function sweat(ctx, x, y) {
    ctx.fillStyle = '#8fd0ff';
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.quadraticCurveTo(x + 4, y + 1, x, y + 3);
    ctx.quadraticCurveTo(x - 4, y + 1, x, y - 5);
    ctx.fill();
  }

  function drawOffice(ctx, p, air, dead) {
    const s = Math.sin(p);
    ctx.translate(0, air || dead ? 0 : -Math.abs(Math.cos(p)) * 3);
    const PANTS = '#3b4350', SHIRT = '#f7f9fc';

    // แขนหลัง แกว่งไปมา
    const armA = air ? -0.9 : -s * 0.9;
    const hx = -4 + Math.sin(armA) * 22, hy = -80 + Math.cos(armA) * 22;
    D.limb(ctx, -4, -80, hx, hy, 8, '#dfe5ee');
    D.circle(ctx, hx, hy, 3.6, SKIN_DARK);

    // ขา (พับขากางเกงถึงเข่า เท้าเปล่า)
    const aF = air ? 0.9 : s * 0.75, aB = air ? -0.5 : -s * 0.75;
    [[aB, '#2f3640', SKIN_DARK], [aF, PANTS, SKIN]].forEach(function (L) {
      const r = leg(ctx, 0, -50, L[0], 25, L[1], L[2], L[2]);
      D.limb(ctx, r.kx - 1, r.ky - 1, r.kx + Math.sin(r.b) * 4, r.ky + Math.cos(r.b) * 4, 11, '#59626f'); // ขากางเกงที่พับ
    });

    D.rrect(ctx, -13, -60, 26, 13, 4);
    ctx.fillStyle = PANTS;
    ctx.fill();

    // ลำตัว เชิ้ตขาว เนคไท
    D.rrect(ctx, -14, -89, 28, 34, 7);
    ctx.fillStyle = SHIRT;
    ctx.fill();
    ctx.strokeStyle = '#c3cdd9';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#2f6fd6';
    ctx.beginPath();
    ctx.moveTo(1, -87); ctx.lineTo(-3, -82); ctx.lineTo(1, -64); ctx.lineTo(5, -82);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#262626';
    ctx.fillRect(-13, -58, 26, 3);

    // หัว
    ctx.fillStyle = SKIN;
    ctx.fillRect(-2, -94, 7, 6);
    D.circle(ctx, 2, -101, 12, SKIN);
    ctx.fillStyle = '#1d1a17';
    ctx.beginPath();
    ctx.arc(2, -102, 12.6, Math.PI * 1.02, Math.PI * 2.05);
    ctx.quadraticCurveTo(8, -106, -9, -98);
    ctx.closePath();
    ctx.fill();
    eyes(ctx, 8, -101, dead);
    D.limb(ctx, 5, -107, 11, -105, 1.6, '#1d1a17');
    ctx.fillStyle = '#7a2e1f';
    ctx.beginPath();
    ctx.ellipse(10, -94, 2.2, dead ? 1 : 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!dead) sweat(ctx, -10, -103);

    // แขนหน้า ชูหิ้วรองเท้าหนัง
    D.limb(ctx, 6, -82, 15, -94, 8, '#e7ecf3');
    D.limb(ctx, 15, -94, 18, -109, 7, SKIN);
    D.circle(ctx, 18, -110, 4, SKIN);
    ctx.save();
    ctx.translate(18, -108);
    ctx.rotate(Math.sin(p * 2) * 0.35);
    ctx.fillStyle = '#1b1b1b';
    D.rrect(ctx, -3, 1, 16, 7, 3);
    ctx.fill();
    ctx.fillStyle = '#3a2a20';
    D.rrect(ctx, -7, 5, 16, 7, 3);
    ctx.fill();
    D.limb(ctx, 0, 1, 0, -1, 1.5, '#555');
    ctx.restore();
  }

  function drawStudent(ctx, p, air, dead) {
    const s = Math.sin(p);
    const bob = air || dead ? 0 : -Math.abs(Math.cos(p)) * 3;
    ctx.translate(0, bob);
    const NAVY = '#1f3a68';

    // ขา (กางเกงขาสั้น ถุงเท้าขาว รองเท้าดำ)
    const aF = air ? 0.9 : s * 0.8, aB = air ? -0.5 : -s * 0.8;
    [[aB, SKIN_DARK], [aF, SKIN]].forEach(function (L) {
      const r = leg(ctx, 0, -50, L[0], 25, L[1], L[1], '#1b1b1b');
      D.limb(ctx, r.fx - Math.sin(r.b) * 7, r.fy - Math.cos(r.b) * 7, r.fx - Math.sin(r.b) * 2, r.fy - Math.cos(r.b) * 2, 8, '#ffffff');
    });
    D.rrect(ctx, -13, -60, 26, 18, 5);
    ctx.fillStyle = NAVY;
    ctx.fill();

    // ลำตัว
    D.rrect(ctx, -13, -87, 26, 30, 7);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#c9d1db';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#2b4fa8';
    ctx.fillRect(3, -80, 7, 2);
    ctx.fillRect(3, -77, 5, 1.5);

    // หัว ผมทรงกะลา
    ctx.fillStyle = SKIN;
    ctx.fillRect(-2, -92, 6, 6);
    D.circle(ctx, 1, -96, 12, SKIN);
    ctx.fillStyle = '#16120f';
    ctx.beginPath();
    ctx.arc(1, -97, 12.8, Math.PI, Math.PI * 2);
    ctx.lineTo(13, -95);
    ctx.lineTo(-11, -95);
    ctx.closePath();
    ctx.fill();
    eyes(ctx, 7, -93, dead);
    D.limb(ctx, 6, -87, 11, dead ? -87 : -88, 1.6, '#7a2e1f');

    // แขนชูกระเป๋าคลุมหัว
    const bagBob = air ? -3 : Math.sin(p * 2) * 1.5;
    D.limb(ctx, -8, -82, -15, -103 + bagBob, 7, SKIN_DARK);
    D.limb(ctx, 9, -82, 16, -103 + bagBob, 7, SKIN);
    ctx.save();
    ctx.translate(0, -110 + bagBob);
    ctx.rotate(Math.sin(p) * 0.04);
    D.rrect(ctx, -23, -9, 46, 18, 6);
    ctx.fillStyle = NAVY;
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(-23, -2, 46, 4);
    D.rrect(ctx, -9, -6, 18, 11, 3);
    ctx.fillStyle = '#2a4b82';
    ctx.fill();
    D.limb(ctx, 18, 6, 21, 13, 1.5, '#888');
    D.circle(ctx, 21, 14, 2.5, '#f7d038');
    ctx.restore();
    if (!dead) sweat(ctx, -11, -92);
  }

  function wheel(ctx, x, y, r, p) {
    D.circle(ctx, x, y, r, '#1b1b1b');
    D.circle(ctx, x, y, r * 0.55, '#9aa1a6');
    ctx.strokeStyle = '#5c6266';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = p * 2 + k * Math.PI * 2 / 3;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55);
    }
    ctx.stroke();
  }

  function drawRider(ctx, p, air, dead) {
    ctx.translate(0, air || dead ? 0 : Math.sin(p * 1.3) * 1.5);
    const JACKET = '#2f9e55', JEANS = '#2c3e66', BODY = '#e8493b';

    // กล่องส่งของ
    D.rrect(ctx, -47, -82, 28, 30, 4);
    ctx.fillStyle = '#ff8a1f';
    ctx.fill();
    ctx.strokeStyle = '#c4600a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#c4600a';
    ctx.fillRect(-47, -74, 28, 2);
    D.fitText(ctx, FR.STRINGS.deliveryBox, 22, 9, '600');
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(FR.STRINGS.deliveryBox, -33, -63);

    // ล้อ + ตัวรถ
    wheel(ctx, -28, -12, 11, p);
    wheel(ctx, 30, -12, 11, p);
    D.rrect(ctx, -45, -42, 42, 22, 10);
    ctx.fillStyle = BODY;
    ctx.fill();
    D.rrect(ctx, -41, -48, 32, 8, 3);
    ctx.fillStyle = '#2a2a2a';
    ctx.fill();
    ctx.fillStyle = '#8b9297';
    ctx.fillRect(-6, -25, 28, 6);
    ctx.fillStyle = BODY;
    ctx.beginPath();
    ctx.moveTo(17, -22); ctx.lineTo(23, -62); ctx.lineTo(33, -62); ctx.lineTo(38, -22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = BODY;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(30, -12, 14, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    D.limb(ctx, 29, -62, 31, -73, 4, '#555');
    D.limb(ctx, 23, -73, 38, -73, 4, '#333');
    D.circle(ctx, 37, -62, 4, '#ffe9a3');
    D.limb(ctx, 25, -73, 21, -83, 2, '#444');
    D.circle(ctx, 21, -84, 3, '#9ab0bb');

    // ผู้ขับ: ยกขาสูงหนีน้ำ
    const kb = air ? -3 : Math.sin(p * 2) * 1.5;
    [['#22325a', -2], [JEANS, 2]].forEach(function (L) {
      const ox = L[1];
      D.limb(ctx, -16 + ox, -46, 6 + ox, -66 + kb, 9, L[0]);
      D.limb(ctx, 6 + ox, -66 + kb, 17 + ox, -55 + kb, 8, L[0]);
      ctx.beginPath();
      ctx.ellipse(20 + ox, -54 + kb, 6, 3.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1b1b1b';
      ctx.fill();
    });
    D.limb(ctx, -18, -48, -10, -76, 16, JACKET);
    D.limb(ctx, -10, -72, 10, -67, 7, JACKET);
    D.limb(ctx, 10, -67, 25, -72, 6, SKIN);
    D.circle(ctx, 25, -73, 3.5, '#222');

    // หัว + หมวกกันน็อก
    D.circle(ctx, -4, -87, 10.5, SKIN);
    ctx.fillStyle = JACKET;
    ctx.beginPath();
    ctx.arc(-6, -89, 12.5, Math.PI * 0.95, Math.PI * 2.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(30,40,50,0.85)';
    ctx.fillRect(-1, -92, 12, 4);
    eyes(ctx, 3, -85, dead);
    D.limb(ctx, 2, -79, 7, -79, 1.6, '#7a2e1f');
  }

  const FALLBACK = { office: drawOffice, student: drawStudent, rider: drawRider };

  /* ---------- ทำให้ภาพนิ่งดูเหมือนวิ่ง ----------
   * ตัดภาพเป็น 3 ชิ้น: ลำตัว / ขาหลัง / ขาหน้า แล้วแกว่งขาสลับกันรอบจุดเป้า
   * พร้อมเด้งตัวทุกก้าว ยุบตอนเท้าแตะน้ำ และเอนตัวไปข้างหน้า
   * (ค่าปรับอยู่ที่ anim ของตัวละครใน config.js) */
  function drawSprite(ctx, id, cfg, st, sx, sy) {
    const a = cfg.anim || {};
    const W = cfg.drawW, H = cfg.drawH;
    const running = !st.airborne && !st.dead;
    const p = st.phase * 1.6;            // หนึ่งรอบ = หนึ่งก้าว
    const s = Math.sin(p);               // +1 = ขาหุบ (เท้าแตะน้ำ), -1 = ขากาง (ลอยตัว)
    let lift = 0, swing = 0;

    if (a.ride) {
      // คนขี่รถ: รถโยกหน้า-หลัง + สั่นถี่ๆ ตามพื้นน้ำ
      if (running) {
        lift = (Math.sin(p * 1.5) * 0.5 + 0.5) * (a.bounce || 0) + Math.sin(st.phase * 23) * 0.5;
        ctx.rotate(Math.sin(p * 0.75) * 0.03);
      }
    } else if (running) {
      const up = (1 - s) / 2;                     // 0 ตอนแตะน้ำ, 1 ตอนลอยสุด
      lift = Math.pow(up, 0.7) * (a.bounce || 0);
      const contact = Math.pow(Math.max(0, s), 4); // ยุบตัวตอนเท้ากระแทกน้ำ
      sx *= 1 + 0.05 * contact;
      sy *= 1 - 0.07 * contact;
      swing = s;
    } else if (st.airborne) {
      swing = st.vy < 0 ? -1 : -0.5;              // กลางอากาศ: กางขา
    }

    if (!st.dead) ctx.rotate((a.lean || 0) + (running ? Math.sin(p * 2) * 0.012 : 0));
    ctx.scale(cfg.flipX ? -sx : sx, sy);
    if (!running && st.airborne && !a.ride) ctx.scale(0.97, 1.04); // ยืดตัวตอนลอย
    ctx.translate(0, -lift);

    const key = 'char-' + id;
    const c = FR.Assets.scaled(key, cfg.crop, W, H);
    const tw = c.width, th = c.height;
    if (a.ride || a.legY == null) {
      const fy = a.airFadeBelow;
      if (!fy || !st.airborne) {
        ctx.drawImage(c, -W / 2, -H, W, H);
        return;
      }
      // ลอยอยู่: ละอองน้ำที่ติดมากับภาพไม่ควรลอยตามไปด้วย
      ctx.drawImage(c, 0, 0, tw, fy * th, -W / 2, -H, W, fy * H);
      ctx.globalAlpha *= 0.25;
      ctx.drawImage(c, 0, fy * th, tw, (1 - fy) * th, -W / 2, -H + fy * H, W, (1 - fy) * H);
      return;
    }
    const ly = a.legY, px = a.pivotX;
    const ov = 0.05;                          // ขาแต่ละข้างเหลื่อมกันนิดหน่อย กันรอยแยกตรงเป้า
    const left = -W / 2, top = -H;
    const pivX = left + px * W, pivY = top + a.pivotY * H;
    const ang = (a.legSwing || 0.2) * swing;

    function leg(fromX, toX, angle) {
      ctx.save();
      ctx.translate(pivX, pivY);
      ctx.rotate(angle);
      ctx.translate(-pivX, -pivY);
      ctx.drawImage(c, fromX * tw, (ly - 0.02) * th, (toX - fromX) * tw, (1 - ly + 0.02) * th,
        left + fromX * W, top + (ly - 0.02) * H, (toX - fromX) * W, (1 - ly + 0.02) * H);
      ctx.restore();
    }
    leg(0, Math.min(1, px + ov), -ang);       // ขาหลัง (ซ้าย) หมุนสวนกับขาหน้า
    leg(Math.max(0, px - ov), 1, ang);        // ขาหน้า (ขวา)
    // ลำตัวท่อนบนวาดทับรอยต่อ
    ctx.drawImage(c, 0, 0, tw, ly * th, left, top, W, ly * H);
  }

  /* ---------- วาดตัวละคร (ใช้ทั้งในเกมและการ์ดเมนู) ----------
   * st = { phase, airborne, ducking, dead, vy, squash } */
  FR.drawCharacter = function (ctx, id, x, feetY, st) {
    const cfg = FR.Assets.spec('char', id);
    const img = FR.Assets.get('char-' + id);
    ctx.save();
    ctx.translate(x + (cfg.offsetX || 0), feetY + (cfg.sink || 0));
    if (st.dead) ctx.rotate(-0.4);
    else if (st.airborne) ctx.rotate(st.vy < 0 ? -0.06 : 0.05);
    let sx = 1, sy = 1;
    if (st.ducking) {
      sx = C.player.duckScaleX;
      sy = C.player.duckScaleY;
    }
    if (st.squash) {
      sx *= 1 + 0.08 * st.squash;
      sy *= 1 - 0.1 * st.squash;
    }
    if (img) {
      drawSprite(ctx, id, cfg, st, sx, sy);
    } else {
      ctx.scale(cfg.flipX ? -sx : sx, sy);
      ctx.scale(cfg.drawW / UNIT_W[id], cfg.drawH / UNIT_H);
      FALLBACK[id](ctx, st.phase, st.airborne, st.dead);
    }
    ctx.restore();
  };

  /* ---------- ผู้เล่น ---------- */
  function Player() {
    this.reset('office');
  }

  Player.prototype.reset = function (charId) {
    this.charId = charId;
    this.x = C.player.x;
    this.y = G;
    this.vy = 0;
    this.onGround = true;
    this.ducking = false;
    this.buffer = 0;
    this.phase = 0;
    this.squash = 0;
    this.dead = false;
  };

  // input = { jumpPressed, jumpHeld, duckHeld }, events = รายการเหตุการณ์ที่เกิด (ใช้เล่นเสียง/ละอองน้ำ)
  Player.prototype.update = function (dt, input, speed, events) {
    const P = C.physics;
    if (input.jumpPressed) {
      this.buffer = P.jumpBuffer;
      input.jumpPressed = false;
    } else if (this.buffer > 0) {
      this.buffer -= dt;
    }

    if (this.buffer > 0 && this.onGround) {
      this.vy = -P.jumpVelocity;
      this.onGround = false;
      this.buffer = 0;
      events.push('jump');
    }

    if (!this.onGround) {
      let g = P.gravityFall;
      if (input.duckHeld) g = P.gravityFastFall;
      else if (this.vy < 0 && input.jumpHeld) g = P.gravityHold;
      this.vy += g * dt;
      this.y += this.vy * dt;
      if (this.y >= G) {
        this.y = G;
        this.vy = 0;
        this.onGround = true;
        this.squash = 1;
        events.push('land');
      }
    }

    const wasDucking = this.ducking;
    this.ducking = this.onGround && input.duckHeld;
    if (this.ducking && !wasDucking) events.push('duck');

    this.phase += dt * (6 + speed / 55);
    if (this.squash > 0) this.squash = Math.max(0, this.squash - dt * 6);
  };

  Player.prototype.getHitbox = function () {
    const hb = this.ducking ? C.player.duckHitbox : C.player.hitbox;
    return { x: this.x - hb.w / 2, y: this.y - hb.h, w: hb.w, h: hb.h };
  };

  Player.prototype.draw = function (ctx) {
    // เงาบนผิวน้ำตอนลอยตัว
    if (!this.onGround) {
      const k = Math.max(0.3, 1 - (G - this.y) / 220);
      ctx.fillStyle = 'rgba(40,28,15,' + (0.35 * k).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(this.x, G + 2, 26 * k, 5 * k, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    FR.drawCharacter(ctx, this.charId, this.x, this.y, {
      phase: this.phase,
      airborne: !this.onGround,
      ducking: this.ducking,
      dead: this.dead,
      vy: this.vy,
      squash: this.squash,
    });
  };

  FR.Player = Player;
})();
