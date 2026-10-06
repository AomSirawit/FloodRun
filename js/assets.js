/* ============================================================
 * assets.js — โหลดภาพตาม FR.CONFIG.assets
 * ภาพที่โหลดไม่สำเร็จ (ยังไม่มีไฟล์) จะได้ค่า null และเกมจะวาดรูปแทนเอง
 * ============================================================ */
window.FR = window.FR || {};

FR.Assets = (function () {
  'use strict';
  const images = {};
  const missing = [];
  const cache = {};
  const GROUPS = { char: 'characters', obs: 'obstacles', bg: 'backgrounds' };

  function loadOne(key, src) {
    return new Promise(function (resolve) {
      const img = new Image();
      img.onload = function () {
        if (img.naturalWidth > 0) images[key] = img;
        else missing.push(src);
        resolve();
      };
      img.onerror = function () {
        missing.push(src);
        resolve();
      };
      img.src = src;
    });
  }

  function load() {
    const A = FR.CONFIG.assets;
    const jobs = [];
    Object.keys(GROUPS).forEach(function (prefix) {
      const group = A[GROUPS[prefix]];
      Object.keys(group).forEach(function (id) {
        if (group[id].src) jobs.push(loadOne(prefix + '-' + id, A.basePath + group[id].src));
      });
    });
    return Promise.all(jobs).then(function () {
      const loaded = Object.keys(images);
      console.info('[วิ่งหนีน้ำท่วม] ภาพที่ใช้: ' + (loaded.length ? loaded.join(', ') : '(ยังไม่มี)') +
        (missing.length ? ' · วาดแทนด้วยโค้ด: ' + missing.join(', ') : ''));
    });
  }

  // key เช่น 'char-office', 'obs-lizard', 'bg-sky'
  function get(key) {
    return images[key] || null;
  }

  // ค่า config ที่ใช้จริง: ถ้ามีภาพใช้ค่าหลัก ถ้าไม่มีภาพใช้ค่าใน fallback ทับ
  function spec(prefix, id) {
    const cfg = FR.CONFIG.assets[GROUPS[prefix]][id];
    if (images[prefix + '-' + id] || !cfg.fallback) return cfg;
    return Object.assign({}, cfg, cfg.fallback);
  }

  // ย่อภาพขนาดใหญ่ครั้งเดียวแล้วเก็บไว้ (คมกว่าและเร็วกว่าย่อใหม่ทุกเฟรม)
  function scaled(key, crop, w, h, tint, blur) {
    const img = images[key];
    const pr = Math.min(FR.pixelRatio || 1, 3);
    const tw = Math.max(1, Math.round(w * pr)), th = Math.max(1, Math.round(h * pr));
    const ck = key + '|' + tw + 'x' + th + '|' + (tint || '') + '|' + (blur || 0);
    if (cache[ck]) return cache[ck];
    const c = crop || { x: 0, y: 0, w: 1, h: 1 };
    let src = img;
    let sx = c.x * img.naturalWidth, sy = c.y * img.naturalHeight;
    let sw = c.w * img.naturalWidth, sh = c.h * img.naturalHeight;
    // ย่อทีละครึ่งจนใกล้ขนาดเป้าหมาย ภาพจะไม่แตก
    while (sw > tw * 2 && sh > th * 2) {
      const nw = Math.round(sw / 2), nh = Math.round(sh / 2);
      const step = document.createElement('canvas');
      step.width = nw;
      step.height = nh;
      const sc = step.getContext('2d');
      sc.imageSmoothingQuality = 'high';
      sc.drawImage(src, sx, sy, sw, sh, 0, 0, nw, nh);
      src = step;
      sx = 0;
      sy = 0;
      sw = nw;
      sh = nh;
    }
    const out = document.createElement('canvas');
    out.width = tw;
    out.height = th;
    const oc = out.getContext('2d');
    oc.imageSmoothingQuality = 'high';
    if (blur && 'filter' in oc) oc.filter = 'blur(' + (blur * pr).toFixed(2) + 'px)';
    oc.drawImage(src, sx, sy, sw, sh, 0, 0, tw, th);
    oc.filter = 'none';
    if (tint) { // ย้อมสีเฉพาะส่วนที่มีภาพ (ไม่ทับส่วนโปร่งใส)
      oc.globalCompositeOperation = 'source-atop';
      oc.fillStyle = tint;
      oc.fillRect(0, 0, tw, th);
    }
    cache[ck] = out;
    return out;
  }

  // วาดภาพ (ตัดขอบตาม crop, ย้อมสี tint, เบลอ blur ถ้ามี) ลงกรอบ dx, dy, dw, dh
  function draw(ctx, key, crop, dx, dy, dw, dh, tint, blur) {
    ctx.drawImage(scaled(key, crop, dw, dh, tint, blur), dx, dy, dw, dh);
  }

  return { load: load, get: get, spec: spec, draw: draw, scaled: scaled };
})();
