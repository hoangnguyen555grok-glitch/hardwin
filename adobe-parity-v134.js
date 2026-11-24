/* Geed Hardwin v1.34 — character control + background / character layering */
(function () {
  const STAGE_W = 1280, STAGE_H = 720;
  function $(id) { return document.getElementById(id); }
  function toast(msg) { try { if (typeof window.toast === 'function') window.toast(msg); else console.log(msg); } catch (e) {} }
  function scene() { return (window.scenes || [])[window.sceneIndex || 0] || { objects: [] }; }
  function selectedList() {
    const ids = window.selectedIds || [];
    const objs = scene().objects || [];
    if (ids.length) return ids.map((id) => objs.find((o) => o.id === id)).filter(Boolean);
    if (window.selectedId != null) { const o = objs.find((x) => x.id === window.selectedId); return o ? [o] : []; }
    return [];
  }
  function frameNow() { return typeof window.frame === 'number' ? window.frame : 0; }
  function ensureKey(o, f) {
    if (!o.keys) o.keys = [];
    let k = o.keys.find((x) => x.frame === f);
    if (!k) { k = { frame: f, x: o.x, y: o.y, scaleX: o.scaleX ?? 1, scaleY: o.scaleY ?? 1, rotation: o.rotation ?? 0, opacity: o.opacity ?? 1 }; o.keys.push(k); o.keys.sort((a, b) => a.frame - b.frame); }
    else { k.x = o.x; k.y = o.y; k.scaleX = o.scaleX ?? 1; k.scaleY = o.scaleY ?? 1; k.rotation = o.rotation ?? 0; k.opacity = o.opacity ?? 1; }
    return k;
  }
  function render() { try { if (typeof window.renderAll === 'function') window.renderAll(); } catch (e) {} }
  function objSize(o) { return { w: +(o.w || o.width || 100), h: +(o.h || o.height || 100) }; }
  function needSel(min) { const items = selectedList(); if (items.length < (min || 1)) { toast(min > 1 ? 'Chon tu ' + min + ' layer' : 'Chon object / nhan vat'); return null; } return items; }

  function setRole(role) {
    const items = needSel(1); if (!items) return;
    items.forEach((o) => {
      o.filmRole = role;
      if (role === 'background') o.name = (o.name && !/^BG/i.test(o.name)) ? ('BG \u00b7 ' + o.name) : (o.name || 'Background');
      if (role === 'character') o.name = (o.name && !/^NV/i.test(o.name) && !/^Char/i.test(o.name)) ? ('NV \u00b7 ' + o.name) : (o.name || 'Character');
    });
    if (role === 'background') sortFilmStack();
    else if (role === 'character') {
      const objs = scene().objects;
      items.forEach((o) => { const i = objs.indexOf(o); if (i >= 0) { objs.splice(i, 1); objs.push(o); } });
    }
    render();
    toast(role === 'background' ? 'Dat lam HINH NEN (duoi)' : 'Dat lam NHAN VAT (tren nen)');
  }

  function sortFilmStack() {
    const objs = scene().objects; if (!objs || !objs.length) return;
    const bg = [], char = [], other = [];
    objs.forEach((o) => { if (o.filmRole === 'background') bg.push(o); else if (o.filmRole === 'character') char.push(o); else other.push(o); });
    objs.length = 0; objs.push(...bg, ...other, ...char);
    render(); toast('Xep lop: Nen \u2192 Dao cu \u2192 Nhan vat');
  }

  function characterOverBg() {
    const objs = scene().objects; if (!objs) return;
    const chars = objs.filter((o) => o.filmRole === 'character');
    chars.forEach((o) => { const i = objs.indexOf(o); if (i >= 0) { objs.splice(i, 1); objs.push(o); } });
    render(); toast('Nhan vat nam tren hinh nen');
  }

  function characterParts(from) {
    const objs = scene().objects || [];
    const seed = from || selectedList(); if (!seed.length) return [];
    const groupIds = new Set(seed.map((o) => o.groupId).filter(Boolean));
    const ids = new Set(seed.map((o) => o.id));
    if (groupIds.size) return objs.filter((o) => groupIds.has(o.groupId) || ids.has(o.id));
    if (seed.some((o) => o.filmRole === 'character')) return objs.filter((o) => o.filmRole === 'character' || ids.has(o.id));
    return seed;
  }

  function assembleCharacter() {
    const items = needSel(1); if (!items) return;
    window.nextGroupId = window.nextGroupId || 1;
    const gid = 'char-' + window.nextGroupId++;
    items.forEach((o) => { o.groupId = gid; o.filmRole = 'character'; if (o.name && !/^NV/i.test(o.name)) o.name = 'NV \u00b7 ' + o.name; });
    let root = items[0], best = Infinity;
    items.forEach((o) => { const cy = (o.y || 0) + objSize(o).h / 2; if (cy < best) { best = cy; root = o; } });
    items.forEach((o) => { if (o === root) { o.charRoot = true; o.parentId = null; } else { o.charRoot = false; o.parentId = root.id; } });
    window.__activeCharacterGroup = gid; window.__activeCharacterRoot = root.id;
    if (window.selectedIds) window.selectedIds = items.map((o) => o.id);
    characterOverBg(); render();
    toast('Ghep nhan vat \u00b7 ' + items.length + ' phan \u00b7 dieu khien duoc');
  }

  function enterCharacterControl() {
    const parts = characterParts();
    if (!parts.length) { toast('Chon nhan vat (tu kho) roi bam lai'); return; }
    if (!parts.some((p) => p.groupId)) {
      window.nextGroupId = window.nextGroupId || 1;
      const gid = 'char-' + window.nextGroupId++;
      parts.forEach((o) => { o.groupId = gid; o.filmRole = 'character'; });
    }
    window.__activeCharacterGroup = parts.find((p) => p.groupId)?.groupId;
    window.__charControl = true;
    if (window.selectedIds) window.selectedIds = parts.map((p) => p.id);
    parts.forEach((o) => { o.filmRole = 'character'; });
    characterOverBg(); render();
    toast('DIEU KHIEN NHAN VAT \u00b7 mui ten di chuyen ca bo');
    const hint = $('stageHint');
    if (hint) hint.textContent = 'Character control \u00b7 mui ten di chuyen \u00b7 [ ] xoay \u00b7 Shift=10px';
  }

  function exitCharacterControl() {
    window.__charControl = false;
    toast('Thoat dieu khien nhan vat');
    const hint = $('stageHint');
    if (hint) hint.textContent = 'Select and drag objects \u00b7 Add keyframes to animate';
  }

  function moveCharacter(dx, dy) {
    const parts = characterParts(); if (!parts.length) return;
    const f = frameNow(); const step = window.__nudgeStep || 1;
    parts.forEach((o) => { if (o.locked) return; o.x = (o.x || 0) + dx * step; o.y = (o.y || 0) + dy * step; ensureKey(o, f); });
    render();
  }

  function rotateCharacter(deg) {
    const parts = characterParts(); if (!parts.length) return;
    const f = frameNow();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    parts.forEach((o) => { const s = objSize(o); minX = Math.min(minX, o.x || 0); minY = Math.min(minY, o.y || 0); maxX = Math.max(maxX, (o.x || 0) + s.w); maxY = Math.max(maxY, (o.y || 0) + s.h); });
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const rad = (deg * Math.PI) / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    parts.forEach((o) => {
      const s = objSize(o);
      const ox = (o.x || 0) + s.w / 2 - cx, oy = (o.y || 0) + s.h / 2 - cy;
      o.x = ox * cos - oy * sin + cx - s.w / 2;
      o.y = ox * sin + oy * cos + cy - s.h / 2;
      o.rotation = ((o.rotation || 0) + deg) % 360;
      ensureKey(o, f);
    });
    render(); toast('Xoay NV ' + deg + '\u00b0');
  }

  function classicTween() {
    const items = needSel(1); if (!items) return; const f = frameNow();
    items.forEach((o) => { const k = ensureKey(o, f); k.easing = 'easeInOut'; const nextF = f + 8; if (!(o.keys || []).some((x) => x.frame === nextF)) { o.keys.push({ frame: nextF, x: o.x, y: o.y, scaleX: o.scaleX ?? 1, scaleY: o.scaleY ?? 1, rotation: o.rotation ?? 0, opacity: o.opacity ?? 1, easing: 'easeInOut' }); o.keys.sort((a, b) => a.frame - b.frame); } });
    render(); toast('Classic Tween');
  }
  function flip(axis) { const items = needSel(1); if (!items) return; const f = frameNow(); items.forEach((o) => { if (axis === 'h') o.scaleX = -(o.scaleX ?? 1); else o.scaleY = -(o.scaleY ?? 1); ensureKey(o, f); }); render(); }
  function reorder(dir) {
    const objs = scene().objects; if (!objs) return; const items = needSel(1); if (!items) return;
    const ids = new Set(items.map((o) => o.id)); const indices = objs.map((o, i) => (ids.has(o.id) ? i : -1)).filter((i) => i >= 0);
    if (dir === 'front') { const picked = indices.map((i) => objs[i]); for (let i = indices.length - 1; i >= 0; i--) objs.splice(indices[i], 1); objs.push(...picked); }
    else if (dir === 'back') { const picked = indices.map((i) => objs[i]); for (let i = indices.length - 1; i >= 0; i--) objs.splice(indices[i], 1); objs.unshift(...picked); }
    render();
  }
  function centerOnStage() { const items = needSel(1); if (!items) return; const f = frameNow(); items.forEach((o) => { const s = objSize(o); o.x = (STAGE_W - s.w) / 2; o.y = (STAGE_H - s.h) / 2; ensureKey(o, f); }); render(); }
  function duplicateSel() {
    const items = needSel(1); if (!items) return; const objs = scene().objects; window.nextId = window.nextId || 1000;
    items.forEach((o) => { const copy = JSON.parse(JSON.stringify(o)); copy.id = window.nextId++; copy.name = (o.name || 'obj') + ' copy'; copy.x = (o.x || 0) + 24; copy.y = (o.y || 0) + 24; objs.push(copy); });
    render(); toast('Duplicate');
  }
  function nudge(dx, dy) {
    if (window.__charControl) { moveCharacter(dx, dy); return; }
    const items = selectedList(); if (!items.length) return; const f = frameNow(); const step = window.__nudgeStep || 1;
    items.forEach((o) => { if (o.locked) return; o.x = (o.x || 0) + dx * step; o.y = (o.y || 0) + dy * step; ensureKey(o, f); });
    render();
  }

  function ensureToolbar() {
    const old = document.getElementById('adobeParityPanel'); if (old) old.remove();
    const left = document.querySelector('.left') || document.querySelector('.toolgrid')?.parentElement; if (!left) return;
    const panel = document.createElement('div'); panel.id = 'adobeParityPanel'; panel.className = 'section';
    panel.innerHTML = '<div class="sectiontitle">Phim gau \u00b7 v1.34</div><div class="toolgrid">'
      + '<button class="tool" id="setBgBtn" style="grid-column:1/-1">Dat HINH NEN</button>'
      + '<button class="tool" id="setCharBtn" style="grid-column:1/-1">Dat NHAN VAT</button>'
      + '<button class="tool" id="sortStackBtn" style="grid-column:1/-1">Nen duoi \u00b7 NV tren</button>'
      + '<button class="tool" id="charOverBtn">NV tren nen</button>'
      + '<button class="tool" id="bgUnderBtn">Nen duoi</button>'
      + '<button class="tool" id="assembleCharBtn" style="grid-column:1/-1">Ghep nhan vat</button>'
      + '<button class="tool" id="charControlBtn" style="grid-column:1/-1">Dieu khien NV</button>'
      + '<button class="tool" id="exitCharBtn">Thoat DK</button>'
      + '<button class="tool" id="charRotL">NV xoay -</button><button class="tool" id="charRotR">NV xoay +</button>'
      + '<button class="tool" id="classicTweenBtn" style="grid-column:1/-1">Classic Tween</button>'
      + '<button class="tool" id="flipHBtn">Flip H</button><button class="tool" id="flipVBtn">Flip V</button>'
      + '<button class="tool" id="centerStageBtn" style="grid-column:1/-1">Center stage</button>'
      + '<button class="tool" id="bringFrontBtn">Front</button><button class="tool" id="sendBackBtn">Back</button>'
      + '<button class="tool" id="dupBtn">Dup</button></div>'
      + '<div class="smallmuted" style="margin-top:8px;line-height:1.45">1) Anh nen \u2192 Dat HINH NEN<br/>2) Bo phan gau \u2192 Ghep NV<br/>3) Dieu khien NV \u00b7 mui ten</div>';
    const grid = left.querySelector('.toolgrid');
    if (grid && grid.parentElement) grid.parentElement.insertAdjacentElement('afterend', panel); else left.appendChild(panel);
    const meta = document.querySelector('.topmeta'); if (meta) meta.textContent = meta.textContent.replace(/v\d+\.\d+/, 'v1.34');
    const st = document.querySelector('.status'); if (st) st.textContent = st.textContent.replace(/v\d+\.\d+/, 'v1.34');
  }

  function wire() {
    ensureToolbar();
    const map = {
      setBgBtn: () => setRole('background'), setCharBtn: () => setRole('character'), sortStackBtn: sortFilmStack,
      charOverBtn: characterOverBg, bgUnderBtn: () => setRole('background'), assembleCharBtn: assembleCharacter,
      charControlBtn: enterCharacterControl, exitCharBtn: exitCharacterControl,
      charRotL: () => rotateCharacter(-15), charRotR: () => rotateCharacter(15),
      classicTweenBtn: classicTween, flipHBtn: () => flip('h'), flipVBtn: () => flip('v'),
      centerStageBtn: centerOnStage, bringFrontBtn: () => reorder('front'), sendBackBtn: () => reorder('back'), dupBtn: duplicateSel
    };
    Object.entries(map).forEach(([id, fn]) => { const el = $(id); if (el) el.onclick = fn; });
    if (!window.__adobeParityKeys) {
      window.__adobeParityKeys = true;
      document.addEventListener('keydown', (ev) => {
        const tag = (ev.target && ev.target.tagName) || ''; if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
        window.__nudgeStep = ev.shiftKey ? 10 : 1;
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); nudge(-1, 0); }
        if (ev.key === 'ArrowRight') { ev.preventDefault(); nudge(1, 0); }
        if (ev.key === 'ArrowUp') { ev.preventDefault(); nudge(0, -1); }
        if (ev.key === 'ArrowDown') { ev.preventDefault(); nudge(0, 1); }
        if (ev.key === '[') { ev.preventDefault(); rotateCharacter(-15); }
        if (ev.key === ']') { ev.preventDefault(); rotateCharacter(15); }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(wire, 50));
  else setTimeout(wire, 80);
})();
