/* ============================================================
 * background.js — ฉากหลัง parallax 3 ชั้น, ผิวน้ำ, ฝน, ละอองน้ำ, ฟ้าแลบ
 * และฟังก์ชันวาดพื้นฐานที่ไฟล์อื่นใช้ร่วมกัน (FR.Draw)
 * ============================================================ */
window.FR = window.FR || {};

/* ---------- ฟังก์ชันวาดพื้นฐาน ---------- */
FR.Draw = (function () {
  'use strict';

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function circle(ctx, x, y, r, fill) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function limb(ctx, x1, y1, x2, y2, w, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // ปรับสี hex ให้เข้มขึ้น (amt < 0) หรืออ่อนลง (amt > 0)
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r);
    g = Math.round((t - g) * p + g);
    b = Math.round((t - b) * p + b);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // สุ่มแบบกำหนด seed ได้ (ฉากที่วาดแทนภาพจะออกมาเหมือนเดิมทุกครั้ง)
  function rng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function fitText(ctx, text, maxW, size, weight) {
    let s = size;
    ctx.font = weight + ' ' + s + 'px Kanit, sans-serif';
    while (s > 8 && ctx.measureText(text).width > maxW) {
      s -= 1;
      ctx.font = weight + ' ' + s + 'px Kanit, sans-serif';
    }
  }

  return { rrect: rrect, circle: circle, limb: limb, shade: shade, rng: rng, fitText: fitText };
})();

/* ---------- ฉากหลัง ---------- */
FR.Background = (function () {
  'use strict';
  const C = FR.CONFIG, W = C.WIDTH, H = C.HEIGHT, G = C.GROUND_Y;
  const D = FR.Draw;
  const TILE_SCALE = 2; // วาด tile สำรองที่ความละเอียด 2 เท่า ให้คมบนจอ high-DPI
  const SKY = { w: 960, y: 0, h: H };
  const BLD = { w: 1440, y: 140, h: 340 };
  const FG = { w: 960, y: 0, h: 480 };
  let tiles = null;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * TILE_SCALE);
    c.height = Math.ceil(h * TILE_SCALE);
    const x = c.getContext('2d');
    x.scale(TILE_SCALE, TILE_SCALE);
    return { c: c, x: x };
  }

  function snap(v) {
    const pr = FR.pixelRatio || 1;
    return Math.round(v * pr) / pr;
  }

  /* ----- ท้องฟ้า: ฟ้าครึ้ม เมฆฝน ตึกสูงไกลๆ ----- */
  function buildSky() {
    const t = makeCanvas(SKY.w, SKY.h), x = t.x, w = SKY.w;
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#46535f');
    g.addColorStop(0.55, '#7a8793');
    g.addColorStop(1, '#a3abb1');
    x.fillStyle = g;
    x.fillRect(0, 0, w, H);

    const r = D.rng(11);
    // ตึกสูงไกลๆ
    let px = 12;
    while (px < w - 90) {
      const bw = 34 + r() * 60, bh = 110 + r() * 170;
      x.fillStyle = 'rgba(92,106,120,0.6)';
      x.fillRect(px, 470 - bh, bw, bh);
      if (r() < 0.4) x.fillRect(px + bw / 2 - 1, 470 - bh - 18, 2, 18);
      x.fillStyle = 'rgba(160,172,182,0.25)';
      for (let wy = 470 - bh + 10; wy < 460; wy += 14) {
        for (let wx = px + 5; wx < px + bw - 6; wx += 10) x.fillRect(wx, wy, 4, 6);
      }
      px += bw + 10 + r() * 40;
    }
    // เมฆฝน (วาดซ้ำซ้าย/ขวาให้ต่อกันได้ไม่มีรอย)
    for (let i = 0; i < 16; i++) {
      const cx = r() * w, cy = 20 + r() * 130, s = 50 + r() * 80;
      const col = i % 3 === 0 ? 'rgba(120,130,140,0.7)' : 'rgba(58,67,78,0.75)';
      [-w, 0, w].forEach(function (dx) {
        x.fillStyle = col;
        for (let k = 0; k < 5; k++) {
          x.beginPath();
          x.ellipse(cx + dx + (k - 2) * s * 0.35, cy + Math.sin(k * 1.7) * s * 0.12, s * 0.42, s * 0.28, 0, 0, Math.PI * 2);
          x.fill();
        }
      });
    }
    return t.c;
  }

  /* ----- ตึกแถว ----- */
  function buildBuildings() {
    const t = makeCanvas(BLD.w, BLD.h), x = t.x, w = BLD.w;
    const base = BLD.h - 6; // พื้นของตึก (y บนจอ ~474)
    const r = D.rng(3);
    const palette = ['#e8d9b5', '#cfe0c8', '#f0c9b8', '#c9d7e6', '#efe1a0', '#d9c2e0', '#bfe0dc', '#f2d0a4'];
    const signColors = [['#c0392b', '#ffffff'], ['#1f5fa8', '#ffffff'], ['#f1c40f', '#7a1b0c'],
      ['#1e8449', '#ffffff'], ['#ffffff', '#c0392b'], ['#7d3c98', '#ffffff']];
    const signs = FR.STRINGS.shopSigns;
    const FH = 54;
    let px = 0, i = 0;

    while (px < w) {
      let bw = 120 + Math.floor(r() * 60);
      if (w - px < bw + 110) bw = w - px;
      const floors = 3 + Math.floor(r() * 3);
      const top = base - floors * FH - 18;
      const col = palette[Math.floor(r() * palette.length)];

      x.fillStyle = col;
      x.fillRect(px, top, bw, base - top + 6);
      x.fillStyle = D.shade(col, -0.2);
      x.fillRect(px, top, bw, 9);
      x.fillStyle = D.shade(col, -0.1);
      x.fillRect(px, top, 5, base - top + 6);
      x.fillRect(px + bw - 5, top, 5, base - top + 6);

      // ชั้นบน: หน้าต่าง ระเบียง แอร์
      for (let f = 1; f < floors; f++) {
        const fTop = base - (f + 1) * FH;
        const n = bw > 150 ? 3 : 2;
        const ww = (bw - 24 - (n - 1) * 10) / n, wh = FH * 0.55;
        for (let k = 0; k < n; k++) {
          const wx = px + 12 + k * (ww + 10), wy = fTop + 10;
          x.fillStyle = '#5b4a3a';
          x.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
          x.fillStyle = r() < 0.25 ? '#ffe39a' : '#7f99a8';
          x.fillRect(wx, wy, ww, wh);
          x.fillStyle = 'rgba(255,255,255,0.18)';
          x.fillRect(wx + 3, wy + 3, ww * 0.3, wh - 6);
          x.fillStyle = '#5b4a3a';
          x.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        }
        if (r() < 0.45) { // ระเบียงเหล็ก
          const ry = fTop + FH - 14;
          x.strokeStyle = 'rgba(50,50,50,0.7)';
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(px + 8, ry);
          x.lineTo(px + bw - 8, ry);
          for (let bx = px + 10; bx < px + bw - 8; bx += 6) {
            x.moveTo(bx, ry);
            x.lineTo(bx, ry + 12);
          }
          x.stroke();
        }
        if (r() < 0.5) { // แอร์
          const ax = px + 10 + r() * (bw - 40);
          x.fillStyle = '#dedad2';
          x.fillRect(ax, fTop + FH - 16, 22, 13);
          x.strokeStyle = '#9a958c';
          x.lineWidth = 1;
          x.strokeRect(ax, fTop + FH - 16, 22, 13);
          D.circle(x, ax + 15, fTop + FH - 9.5, 4, '#a7a29a');
        }
      }

      // ชั้นล่าง: ประตูเหล็กม้วน
      x.fillStyle = '#9aa3a8';
      x.fillRect(px + 10, base - FH + 18, bw - 20, FH - 18);
      x.strokeStyle = 'rgba(70,78,84,0.55)';
      x.lineWidth = 1;
      for (let sy = base - FH + 21; sy < base; sy += 4) {
        x.beginPath();
        x.moveTo(px + 10, sy);
        x.lineTo(px + bw - 10, sy);
        x.stroke();
      }

      // ป้ายร้าน
      const sc = signColors[Math.floor(r() * signColors.length)];
      const sx = px + 8, sy2 = base - FH - 14, sw = bw - 16, sh = 26;
      x.fillStyle = sc[0];
      x.fillRect(sx, sy2, sw, sh);
      x.strokeStyle = 'rgba(0,0,0,0.25)';
      x.strokeRect(sx + 0.5, sy2 + 0.5, sw - 1, sh - 1);
      D.fitText(x, signs[i % signs.length], sw - 12, 16, '600');
      x.fillStyle = sc[1];
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(signs[i % signs.length], sx + sw / 2, sy2 + sh / 2 + 1);

      x.fillStyle = 'rgba(40,40,40,0.35)';
      x.fillRect(px, top, 1.5, base - top);
      px += bw;
      i++;
    }
    // คราบฝน + หมอกให้ดูอยู่ไกล
    const g = x.createLinearGradient(0, 0, 0, BLD.h);
    g.addColorStop(0, 'rgba(70,85,100,0.32)');
    g.addColorStop(1, 'rgba(50,60,70,0.42)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, BLD.h);
    return t.c;
  }

  /* ----- ฉากหน้า: เสาไฟ สายไฟพันกัน ป้าย กระสอบทราย รถจมน้ำ ----- */
  function buildForeground() {
    const t = makeCanvas(FG.w, FG.h), x = t.x, w = FG.w;
    const r = D.rng(5);
    const poleX = 140;

    // สายไฟระหว่างเสา (เสาต้นถัดไปอยู่ที่ poleX + w)
    for (let k = 0; k < 9; k++) {
      const y1 = 66 + k * 5 + r() * 4, sag = 40 + r() * 70;
      x.strokeStyle = k % 4 === 0 ? '#3b3b3b' : '#171717';
      x.lineWidth = 1.2 + r() * 1.6;
      [poleX - w, poleX].forEach(function (b) {
        x.beginPath();
        x.moveTo(b, y1);
        x.quadraticCurveTo(b + w / 2, y1 + sag * 2, b + w, y1);
        x.stroke();
      });
    }
    // ก้อนสายไฟพันกัน
    x.strokeStyle = '#151515';
    x.lineWidth = 1.4;
    for (let k = 0; k < 14; k++) {
      x.beginPath();
      x.ellipse(poleX + 48 + r() * 30, 104 + r() * 12, 8 + r() * 14, 5 + r() * 8, r() * 3, 0, Math.PI * 2);
      x.stroke();
    }

    // เสาไฟฟ้า
    const pg = x.createLinearGradient(poleX - 9, 0, poleX + 9, 0);
    pg.addColorStop(0, '#8d877e');
    pg.addColorStop(0.5, '#b9b3a9');
    pg.addColorStop(1, '#7c766d');
    x.fillStyle = pg;
    x.fillRect(poleX - 9, 30, 18, FG.h - 30);
    x.fillStyle = '#6f695f';
    x.fillRect(poleX - 50, 62, 100, 7);
    [-42, -24, 24, 42].forEach(function (dx) { D.circle(x, poleX + dx, 59, 4, '#e8e2d4'); });
    D.rrect(x, poleX + 10, 118, 30, 48, 5);
    x.fillStyle = '#8f9599';
    x.fill();
    x.fillStyle = '#6c7276';
    x.fillRect(poleX + 10, 130, 30, 3);
    x.fillRect(poleX + 10, 150, 30, 3);

    // ป้ายซอย
    x.fillStyle = '#1d4f9c';
    x.fillRect(poleX - 52, 205, 104, 28);
    x.strokeStyle = '#ffffff';
    x.lineWidth = 2;
    x.strokeRect(poleX - 49, 208, 98, 22);
    D.fitText(x, FR.STRINGS.streetSign, 90, 15, '600');
    x.fillStyle = '#ffffff';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(FR.STRINGS.streetSign, poleX, 220);

    // รถจมน้ำครึ่งคัน
    x.fillStyle = '#b8322a';
    x.beginPath();
    x.moveTo(330, 470);
    x.lineTo(336, 432);
    x.quadraticCurveTo(372, 426, 384, 404);
    x.lineTo(468, 404);
    x.quadraticCurveTo(486, 426, 516, 432);
    x.lineTo(522, 470);
    x.closePath();
    x.fill();
    x.fillStyle = '#25384a';
    x.beginPath();
    x.moveTo(390, 410);
    x.lineTo(424, 410);
    x.lineTo(424, 428);
    x.lineTo(378, 428);
    x.closePath();
    x.fill();
    x.beginPath();
    x.moveTo(430, 410);
    x.lineTo(464, 410);
    x.lineTo(476, 428);
    x.lineTo(430, 428);
    x.closePath();
    x.fill();
    x.fillStyle = 'rgba(255,255,255,0.25)';
    x.fillRect(396, 413, 10, 4);
    D.limb(x, 470, 404, 486, 386, 1.5, '#222');

    // ป้ายเตือนน้ำท่วม
    x.fillStyle = '#6d6d6d';
    x.fillRect(612, 300, 5, FG.h - 300);
    x.save();
    x.translate(614.5, 300);
    x.rotate(Math.PI / 4);
    x.fillStyle = '#f5c518';
    x.fillRect(-24, -24, 48, 48);
    x.strokeStyle = '#1a1a1a';
    x.lineWidth = 3;
    x.strokeRect(-20, -20, 40, 40);
    x.restore();
    x.strokeStyle = '#1a1a1a';
    x.lineWidth = 2;
    for (let k = 0; k < 2; k++) {
      x.beginPath();
      for (let dx = -14; dx <= 14; dx += 2) {
        const yy = 300 + 4 + k * 7 + Math.sin(dx * 0.45) * 2;
        if (dx === -14) x.moveTo(614.5 + dx, yy);
        else x.lineTo(614.5 + dx, yy);
      }
      x.stroke();
    }
    D.fitText(x, FR.STRINGS.warnSign, 26, 10, '600');
    x.fillStyle = '#1a1a1a';
    x.fillText(FR.STRINGS.warnSign, 614.5, 291);

    // กระสอบทราย
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 6 - row; k++) {
        const bx = 700 + row * 15 + k * 30, by = 462 - row * 15;
        x.beginPath();
        x.ellipse(bx, by, 16, 9, 0, 0, Math.PI * 2);
        x.fillStyle = row % 2 ? '#d8c59b' : '#cdb98f';
        x.fill();
        x.strokeStyle = '#8f7d55';
        x.lineWidth = 1.2;
        x.stroke();
      }
    }
    return t.c;
  }

  function init() {
    tiles = { sky: buildSky(), buildings: buildBuildings(), foreground: buildForeground() };
  }

  // วาดชั้นภาพซ้ำต่อกันแนวนอน ใช้ภาพจริงถ้ามี ไม่งั้นใช้ tile ที่วาดเอง
  function drawLayer(ctx, name, box, scroll) {
    const cfg = C.assets.backgrounds[name];
    const img = FR.Assets.get('bg-' + name);
    let y, h, tw;
    if (img) {
      y = cfg.y;
      h = cfg.h;
      tw = Math.round(cfg.w || img.naturalWidth * (h / img.naturalHeight));
    } else {
      y = box.y;
      h = box.h;
      tw = box.w;
    }
    const off = snap(-((scroll * C.parallax[name]) % tw));
    for (let x = off; x < W; x += tw) {
      if (img) FR.Assets.draw(ctx, 'bg-' + name, cfg.crop, x, y, tw + 0.5, h, cfg.tint, cfg.blur);
      else ctx.drawImage(tiles[name], x, y, tw + 0.5, h);
    }
  }

  function waterY(meters) {
    const wr = C.waterRise;
    const k = Math.min(1, Math.max(0, meters / wr.fullAtMeters));
    const e = k * k * (3 - 2 * k);
    return wr.startY + (wr.endY - wr.startY) * e;
  }

  function wavePath(ctx, top, scroll, time, a1, f1, a2, f2, speed) {
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 12; x += 12) {
      const sx = x + scroll;
      ctx.lineTo(x, top + Math.sin(sx * f1 + time * speed) * a1 + Math.sin(sx * f2 - time * speed * 1.4) * a2);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
  }

  function waveLine(ctx, top, scroll, time, a1, f1, a2, f2, speed) {
    ctx.beginPath();
    for (let x = 0; x <= W + 12; x += 12) {
      const sx = x + scroll;
      const y = top + Math.sin(sx * f1 + time * speed) * a1 + Math.sin(sx * f2 - time * speed * 1.4) * a2;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  // ท้องฟ้า → ตึกแถว → น้ำท่วมฉากหลัง (สูงขึ้นตามระยะทาง) → ฉากหน้า
  function drawBack(ctx, scroll, time, meters) {
    if (!tiles) return;
    drawLayer(ctx, 'sky', SKY, scroll);
    drawLayer(ctx, 'buildings', BLD, scroll);

    const top = waterY(meters);
    const s = scroll * C.parallax.buildings;
    wavePath(ctx, top, s, time, 2.2, 0.03, 1.2, 0.07, 1.4);
    ctx.fillStyle = 'rgba(112,86,54,0.93)';
    ctx.fill();
    waveLine(ctx, top, s, time, 2.2, 0.03, 1.2, 0.07, 1.4);
    ctx.strokeStyle = 'rgba(225,205,165,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    drawLayer(ctx, 'foreground', FG, scroll);
  }

  // น้ำชั้นหลังตัวละคร (ทึบ)
  function drawMainWater(ctx, scroll, time) {
    const top = G - 6;
    wavePath(ctx, top, scroll, time, 3.2, 0.022, 1.6, 0.051, 1.8);
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#8c6a43');
    g.addColorStop(1, '#4b3620');
    ctx.fillStyle = g;
    ctx.fill();
    // ริ้วน้ำไหลไปพร้อมฉาก
    ctx.strokeStyle = 'rgba(230,205,160,' + C.comfort.waterStreakAlpha + ')';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    const span = W + 120;
    for (let i = 0; i < 16; i++) {
      const x = ((i * 157.3 - scroll) % span + span) % span - 60;
      const y = top + 16 + ((i * 37) % 70);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 18, y - 3, x + 36, y);
      ctx.stroke();
    }
  }

  // ขยะลอยน้ำเล็กๆ ให้ฉากดูมีชีวิต (ไม่มีผลกับการเล่น)
  const DEBRIS = [
    { x0: 80, dy: 30, type: 'slipper' }, { x0: 430, dy: 58, type: 'bottle' },
    { x0: 760, dy: 22, type: 'duck' }, { x0: 1010, dy: 66, type: 'slipper2' },
    { x0: 1250, dy: 40, type: 'bottle' },
  ];
  function drawDebris(ctx, scroll, time) {
    const span = W + 400;
    for (let i = 0; i < DEBRIS.length; i++) {
      const d = DEBRIS[i];
      const x = ((d.x0 - scroll) % span + span) % span - 120;
      const y = G + d.dy + Math.sin(time * 2 + i) * 2;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time * 1.5 + i) * 0.15);
      if (d.type === 'slipper' || d.type === 'slipper2') {
        D.rrect(ctx, -11, -4, 22, 8, 4);
        ctx.fillStyle = d.type === 'slipper' ? '#2f7fd8' : '#e05a8a';
        ctx.fill();
        D.limb(ctx, -2, -1, 6, -1, 2, '#f2f2f2');
      } else if (d.type === 'bottle') {
        D.rrect(ctx, -10, -4, 18, 8, 3);
        ctx.fillStyle = 'rgba(190,225,240,0.85)';
        ctx.fill();
        ctx.fillStyle = '#2b8a3e';
        ctx.fillRect(8, -2.5, 4, 5);
      } else {
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#f7d038';
        ctx.fill();
        D.circle(ctx, 7, -6, 4.5, '#f7d038');
        ctx.fillStyle = '#f08a24';
        ctx.fillRect(10, -7, 4, 2.5);
        D.circle(ctx, 8, -7, 1, '#222');
      }
      ctx.restore();
    }
  }

  // น้ำชั้นหน้าตัวละคร (โปร่งแสง ทับเท้าให้ดูเหมือนลุยน้ำ)
  function drawFrontWater(ctx, scroll, time) {
    const top = G + 6;
    wavePath(ctx, top, scroll, -time, 3, 0.03, 1.4, 0.08, 2.2);
    ctx.fillStyle = 'rgba(122,92,56,0.55)';
    ctx.fill();
    waveLine(ctx, top, scroll, -time, 3, 0.03, 1.4, 0.08, 2.2);
    ctx.strokeStyle = 'rgba(255,240,210,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  return {
    init: init,
    drawBack: drawBack,
    drawMainWater: drawMainWater,
    drawDebris: drawDebris,
    drawFrontWater: drawFrontWater,
  };
})();

/* ---------- เอฟเฟกต์: ฝน, วงน้ำ, ละอองน้ำ, ฟ้าแลบ ---------- */
FR.FX = (function () {
  'use strict';
  const C = FR.CONFIG, W = C.WIDTH, H = C.HEIGHT, G = C.GROUND_Y;
  let drops = [], splashes = [], ripples = [];
  const CF = C.comfort;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let flash = 0, flash2 = -1, nextLightning = rand(CF.lightningEvery[0] / 2, CF.lightningEvery[1] / 2);
  const rainVX = CF.rainDrift;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function resetDrop(d, anywhere) {
    d.x = rand(-40, W + 320);
    d.y = anywhere ? rand(-40, G) : rand(-120, -10);
    d.vy = rand(820, 1100);
    d.len = rand(12, 22);
    d.floor = G + rand(-4, 80);
    return d;
  }

  function init() {
    drops = [];
    const n = reduceMotion ? Math.round(CF.rainCount / 2) : CF.rainCount;
    for (let i = 0; i < n; i++) drops.push(resetDrop({}, true));
    splashes = [];
    ripples = [];
  }

  function clear() {
    splashes = [];
    ripples = [];
  }

  // weatherActive = มีฟ้าแลบได้ (เมนู/ระหว่างเล่น)
  function update(dt, groundSpeed, weatherActive) {
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.x += rainVX * dt;
      d.y += d.vy * dt;
      if (d.y > d.floor) {
        if (ripples.length < 40 && Math.random() < 0.6) ripples.push({ x: d.x, y: d.floor, t: 0, life: rand(0.25, 0.45) });
        resetDrop(d, false);
      }
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const p = ripples[i];
      p.t += dt;
      p.x -= groundSpeed * dt;
      if (p.t >= p.life) ripples.splice(i, 1);
    }
    for (let i = splashes.length - 1; i >= 0; i--) {
      const p = splashes[i];
      p.t += dt;
      p.vy += 1500 * dt;
      p.x += (p.vx - groundSpeed * 0.9) * dt;
      p.y += p.vy * dt;
      if (p.t >= p.life || (p.vy > 0 && p.y > G + 10)) splashes.splice(i, 1);
    }

    if (flash > 0) flash = Math.max(0, flash - dt * 3.2);
    if (flash2 >= 0) {
      flash2 -= dt;
      if (flash2 < 0) flash = 0.8;
    }
    if (weatherActive) {
      nextLightning -= dt;
      if (nextLightning <= 0) {
        flash = 1;
        flash2 = 0.14;
        nextLightning = rand(CF.lightningEvery[0], CF.lightningEvery[1]);
        FR.Audio.play('thunder');
      }
    }
  }

  function splash(x, y, n, power) {
    for (let i = 0; i < n && splashes.length < 300; i++) {
      splashes.push({
        x: x + rand(-10, 10), y: y,
        vx: rand(-80, 140) * power, vy: -rand(140, 380) * power,
        t: 0, life: rand(0.35, 0.65), r: rand(1.4, 3.2),
        c: Math.random() < 0.55 ? 'rgba(150,114,70,0.9)' : 'rgba(214,188,144,0.85)',
      });
    }
  }

  function drawRipples(ctx) {
    ctx.strokeStyle = 'rgba(240,228,205,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < ripples.length; i++) {
      const p = ripples[i], k = p.t / p.life;
      ctx.globalAlpha = 1 - k;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 2 + k * 9, 0.8 + k * 2.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawSplash(ctx) {
    for (let i = 0; i < splashes.length; i++) {
      const p = splashes[i];
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRain(ctx) {
    ctx.strokeStyle = 'rgba(214,228,240,' + CF.rainAlpha + ')';
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      const k = d.len / d.vy;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - rainVX * k, d.y - d.len);
    }
    ctx.stroke();
  }

  function drawFlash(ctx) {
    if (flash <= 0 || reduceMotion || CF.lightningAlpha <= 0) return;
    ctx.fillStyle = 'rgba(235,240,255,' + (flash * CF.lightningAlpha).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  return {
    init: init, clear: clear, update: update, splash: splash,
    drawRipples: drawRipples, drawSplash: drawSplash, drawRain: drawRain, drawFlash: drawFlash,
  };
})();
