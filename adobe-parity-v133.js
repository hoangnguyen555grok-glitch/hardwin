/* Geed Hardwin Adobe-parity v1.33 — cutout / phim gau convenience */
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
  function needSel(min) { const items = selectedList(); if (items.length < (min || 1)) { toast(min > 1 ? 'Chon tu ' + min + ' layer' : 'Chon object'); return null; } return items; }
  function alignSelected(axis) {
    const items = needSel(2); if (!items) return;
    const bounds = items.map((o) => { const s = objSize(o); return { o, x: +(o.x || 0), y: +(o.y || 0), w: s.w, h: s.h }; });
    const f = frameNow();
    if (axis === 'left') { const m = Math.min(...bounds.map((b) => b.x)); bounds.forEach((b) => { b.o.x = m; ensureKey(b.o, f); }); }
    if (axis === 'right') { const m = Math.max(...bounds.map((b) => b.x + b.w)); bounds.forEach((b) => { b.o.x = m - b.w; ensureKey(b.o, f); }); }
    if (axis === 'center') { const minX = Math.min(...bounds.map((b) => b.x)), maxX = Math.max(...bounds.map((b) => b.x + b.w)); const c = (minX + maxX) / 2; bounds.forEach((b) => { b.o.x = c - b.w / 2; ensureKey(b.o, f); }); }
    if (axis === 'top') { const m = Math.min(...bounds.map((b) => b.y)); bounds.forEach((b) => { b.o.y = m; ensureKey(b.o, f); }); }
    if (axis === 'bottom') { const m = Math.max(...bounds.map((b) => b.y + b.h)); bounds.forEach((b) => { b.o.y = m - b.h; ensureKey(b.o, f); }); }
    if (axis === 'mid') { const minY = Math.min(...bounds.map((b) => b.y)), maxY = Math.max(...bounds.map((b) => b.y + b.h)); const c = (minY + maxY) / 2; bounds.forEach((b) => { b.o.y = c - b.h / 2; ensureKey(b.o, f); }); }
    render(); toast('Da can ' + items.length + ' layer');
  }
  function centerOnStage() { const items = needSel(1); if (!items) return; const f = frameNow(); items.forEach((o) => { const s = objSize(o); o.x = (STAGE_W - s.w) / 2; o.y = (STAGE_H - s.h) / 2; ensureKey(o, f); }); render(); toast('Can giua san khau'); }
  function groupSel() { const items = needSel(2); if (!items) return; window.nextGroupId = window.nextGroupId || 1; const id = 'grp-' + window.nextGroupId++; items.forEach((x) => (x.groupId = id)); render(); toast(items.length + ' layer group'); }
  function ungroupSel() { const items = needSel(1); if (!items) return; items.forEach((x) => delete x.groupId); render(); toast('Ungroup'); }
  function distribute() { (scene().objects || []).forEach((o) => { if (o.groupId) delete o.groupId; }); render(); toast('Distribute layers'); }
  function classicTween() {
    const items = needSel(1); if (!items) return; const f = frameNow();
    items.forEach((o) => { const k = ensureKey(o, f); k.easing = 'easeInOut'; const nextF = f + 8; if (!(o.keys || []).some((x) => x.frame === nextF)) { o.keys.push({ frame: nextF, x: o.x, y: o.y, scaleX: o.scaleX ?? 1, scaleY: o.scaleY ?? 1, rotation: o.rotation ?? 0, opacity: o.opacity ?? 1, easing: 'easeInOut' }); o.keys.sort((a, b) => a.frame - b.frame); } });
    render(); toast('Classic Tween @ ' + f);
  }
  function flip(axis) { const items = needSel(1); if (!items) return; const f = frameNow(); items.forEach((o) => { if (axis === 'h') o.scaleX = -(o.scaleX ?? 1); else o.scaleY = -(o.scaleY ?? 1); ensureKey(o, f); }); render(); toast(axis === 'h' ? 'Lat ngang' : 'Lat doc'); }
  function reorder(dir) {
    const objs = scene().objects; if (!objs || !objs.length) return; const items = needSel(1); if (!items) return;
    const ids = new Set(items.map((o) => o.id)); const indices = objs.map((o, i) => (ids.has(o.id) ? i : -1)).filter((i) => i >= 0); if (!indices.length) return;
    if (dir === 'front') { const picked = indices.map((i) => objs[i]); for (let i = indices.length - 1; i >= 0; i--) objs.splice(indices[i], 1); objs.push(...picked); }
    else if (dir === 'back') { const picked = indices.map((i) => objs[i]); for (let i = indices.length - 1; i >= 0; i--) objs.splice(indices[i], 1); objs.unshift(...picked); }
    else if (dir === 'forward') { const max = Math.max(...indices); if (max < objs.length - 1) { const t = objs[max]; objs[max] = objs[max + 1]; objs[max + 1] = t; } }
    else if (dir === 'backward') { const min = Math.min(...indices); if (min > 0) { const t = objs[min]; objs[min] = objs[min - 1]; objs[min - 1] = t; } }
    render();
  }
  function toggleLock() { const items = needSel(1); if (!items) return; const lock = !items.every((o) => o.locked); items.forEach((o) => (o.locked = lock)); render(); toast(lock ? 'Khoa layer' : 'Mo khoa'); }
  function toggleVisible() { const items = needSel(1); if (!items) return; const hide = items.every((o) => o.visible !== false); items.forEach((o) => (o.visible = !hide)); render(); toast(hide ? 'An layer' : 'Hien layer'); }
  function centerPivot() { const items = needSel(1); if (!items) return; items.forEach((o) => { const s = objSize(o); o.pivotX = s.w / 2; o.pivotY = s.h / 2; o.regX = s.w / 2; o.regY = s.h / 2; }); render(); toast('Pivot giua'); }
  function duplicateSel() {
    const items = needSel(1); if (!items) return; const objs = scene().objects; window.nextId = window.nextId || 1000; const created = [];
    items.forEach((o) => { const copy = JSON.parse(JSON.stringify(o)); copy.id = window.nextId++; copy.name = (o.name || o.type || 'obj') + ' copy'; copy.x = (o.x || 0) + 24; copy.y = (o.y || 0) + 24; if (copy.groupId) delete copy.groupId; objs.push(copy); created.push(copy.id); });
    if (typeof window.selectOne === 'function' && created.length === 1) window.selectOne(created[0]); else if (window.selectedIds) window.selectedIds = created;
    render(); toast('Nhan ban ' + created.length);
  }
  function mirrorDup() {
    const items = needSel(1); if (!items) return; const objs = scene().objects; window.nextId = window.nextId || 1000; const f = frameNow(); const created = [];
    items.forEach((o) => { const copy = JSON.parse(JSON.stringify(o)); copy.id = window.nextId++; copy.name = (o.name || o.type || 'obj') + ' mirror'; copy.scaleX = -(o.scaleX ?? 1); const s = objSize(o); copy.x = STAGE_W - (o.x || 0) - s.w; copy.y = o.y || 0; if (copy.groupId) delete copy.groupId; ensureKey(copy, f); objs.push(copy); created.push(copy.id); });
    if (window.selectedIds) window.selectedIds = created; render(); toast('Mirror copy (tay/chan doi xung)');
  }
  function rotateBy(deg) { const items = needSel(1); if (!items) return; const f = frameNow(); items.forEach((o) => { o.rotation = ((o.rotation || 0) + deg) % 360; ensureKey(o, f); }); render(); toast('Xoay ' + deg + ' do'); }
  function scaleBy(factor) { const items = needSel(1); if (!items) return; const f = frameNow(); items.forEach((o) => { o.scaleX = (o.scaleX ?? 1) * factor; o.scaleY = (o.scaleY ?? 1) * factor; ensureKey(o, f); }); render(); toast(factor > 1 ? 'Phong to' : 'Thu nho'); }
  function opacityBy(delta) { const items = needSel(1); if (!items) return; const f = frameNow(); items.forEach((o) => { o.opacity = Math.max(0, Math.min(1, (o.opacity ?? 1) + delta)); ensureKey(o, f); }); render(); toast('Opacity'); }
  function resetTransform() { const items = needSel(1); if (!items) return; const f = frameNow(); items.forEach((o) => { o.scaleX = 1; o.scaleY = 1; o.rotation = 0; o.opacity = 1; ensureKey(o, f); }); render(); toast('Reset transform'); }
  function holdFrames(n) { const items = needSel(1); if (!items) return; const f = frameNow(); items.forEach((o) => { ensureKey(o, f); ensureKey(o, f + n); }); render(); toast('Hold +' + n); }
  function addPoseKey() { const items = needSel(1); if (!items) return; const f = frameNow(); items.forEach((o) => ensureKey(o, f)); render(); toast('Pose key @ ' + f); }
  function pickBucketColor() { const input = document.createElement('input'); input.type = 'color'; input.value = window.__bucketColor || '#4f8cff'; input.oninput = () => { window.__bucketColor = input.value; toast('Mau: ' + input.value); }; input.click(); }
  function nudge(dx, dy) { const items = selectedList(); if (!items.length) return; const f = frameNow(); const step = window.__nudgeStep || 1; items.forEach((o) => { if (o.locked) return; o.x = (o.x || 0) + dx * step; o.y = (o.y || 0) + dy * step; ensureKey(o, f); }); render(); }
  function setMode(mode) { window.toolMode = mode; const h = $('stageHint'); if (h) { if (mode === 'eraser') h.textContent = 'Eraser'; else if (mode === 'bucket') h.textContent = 'Bucket'; else if (mode === 'pivot') h.textContent = 'Pivot'; } toast(mode); }
  window.__bucketColor = window.__bucketColor || '#4f8cff';
  function onStagePointer(ev) {
    const mode = window.toolMode; if (mode !== 'eraser' && mode !== 'bucket' && mode !== 'pivot') return;
    setTimeout(() => {
      const obj = selectedList()[0]; if (!obj) { toast('Chon object truoc'); return; } const f = frameNow();
      if (mode === 'eraser') {
        if (ev.shiftKey) { obj.color = 'transparent'; obj.fill = 'transparent'; ensureKey(obj, f); }
        else if (typeof window.removeObjectsByIds === 'function') { window.removeObjectsByIds(new Set([obj.id])); if (typeof window.selectOne === 'function') window.selectOne(null); }
        else { const arr = scene().objects; const i = arr.findIndex((x) => x.id === obj.id); if (i >= 0) arr.splice(i, 1); }
        render();
      } else if (mode === 'bucket') { const col = window.__bucketColor || '#4f8cff'; if (obj.color !== undefined) obj.color = col; if (obj.fill !== undefined) obj.fill = col; ensureKey(obj, f); render(); }
      else if (mode === 'pivot') { const s = objSize(obj); obj.pivotX = s.w / 2; obj.pivotY = s.h / 2; obj.regX = s.w / 2; obj.regY = s.h / 2; render(); }
    }, 30);
  }
  function ensureToolbar() {
    const old = document.getElementById('adobeParityPanel'); if (old) old.remove();
    const left = document.querySelector('.left') || document.querySelector('.toolgrid')?.parentElement; if (!left) return;
    const panel = document.createElement('div'); panel.id = 'adobeParityPanel'; panel.className = 'section';
    panel.innerHTML = '<div class="sectiontitle">Phim gau tools · v1.33</div><div class="toolgrid">'
      + '<button class="tool" id="addEraser">Eraser</button><button class="tool" id="addBucket">Bucket</button>'
      + '<button class="tool" id="bucketColorBtn">Color</button><button class="tool" id="poseKeyBtn">Pose</button>'
      + '<button class="tool" id="alignLeftBtn">L</button><button class="tool" id="alignCenterBtn">C</button><button class="tool" id="alignRightBtn">R</button>'
      + '<button class="tool" id="alignTopBtn">T</button><button class="tool" id="alignMidBtn">M</button><button class="tool" id="alignBotBtn">B</button>'
      + '<button class="tool" id="centerStageBtn" style="grid-column:1/-1">Center stage</button>'
      + '<button class="tool" id="toolbarGroup">Group</button><button class="tool" id="toolbarUngroup">Ungroup</button>'
      + '<button class="tool" id="distributeLayersBtn" style="grid-column:1/-1">Distribute</button>'
      + '<button class="tool" id="classicTweenBtn" style="grid-column:1/-1">Classic Tween</button>'
      + '<button class="tool" id="hold4Btn">Hold+4</button><button class="tool" id="hold8Btn">Hold+8</button>'
      + '<button class="tool" id="flipHBtn">Flip H</button><button class="tool" id="flipVBtn">Flip V</button>'
      + '<button class="tool" id="mirrorDupBtn" style="grid-column:1/-1">Mirror copy</button>'
      + '<button class="tool" id="rotLBtn">-15</button><button class="tool" id="rotRBtn">+15</button>'
      + '<button class="tool" id="rot90LBtn">-90</button><button class="tool" id="rot90RBtn">+90</button>'
      + '<button class="tool" id="scaleUpBtn">Scale+</button><button class="tool" id="scaleDownBtn">Scale-</button>'
      + '<button class="tool" id="opUpBtn">Op+</button><button class="tool" id="opDownBtn">Op-</button>'
      + '<button class="tool" id="resetXfBtn" style="grid-column:1/-1">Reset transform</button>'
      + '<button class="tool" id="bringFrontBtn">Front</button><button class="tool" id="sendBackBtn">Back</button>'
      + '<button class="tool" id="bringFwdBtn">Fwd</button><button class="tool" id="sendBackOneBtn">Bwd</button>'
      + '<button class="tool" id="lockBtn">Lock</button><button class="tool" id="hideBtn">Hide</button>'
      + '<button class="tool" id="pivotCenterBtn">Pivot</button><button class="tool" id="dupBtn">Dup</button></div>'
      + '<div class="smallmuted" style="margin-top:8px">Mui ten 1px · Shift+mui ten 10px · D dup · Mirror cho tay/chan</div>';
    const grid = left.querySelector('.toolgrid');
    if (grid && grid.parentElement) grid.parentElement.insertAdjacentElement('afterend', panel); else left.appendChild(panel);
    const meta = document.querySelector('.topmeta'); if (meta) meta.textContent = meta.textContent.replace(/v\d+\.\d+/, 'v1.33');
    const st = document.querySelector('.status'); if (st) st.textContent = st.textContent.replace(/v\d+\.\d+/, 'v1.33');
  }
  function wire() {
    ensureToolbar();
    const map = {
      addEraser: () => setMode('eraser'), addBucket: () => setMode('bucket'), bucketColorBtn: pickBucketColor, poseKeyBtn: addPoseKey,
      alignLeftBtn: () => alignSelected('left'), alignCenterBtn: () => alignSelected('center'), alignRightBtn: () => alignSelected('right'),
      alignTopBtn: () => alignSelected('top'), alignMidBtn: () => alignSelected('mid'), alignBotBtn: () => alignSelected('bottom'),
      centerStageBtn: centerOnStage, toolbarGroup: groupSel, toolbarUngroup: ungroupSel, distributeLayersBtn: distribute, classicTweenBtn: classicTween,
      hold4Btn: () => holdFrames(4), hold8Btn: () => holdFrames(8), flipHBtn: () => flip('h'), flipVBtn: () => flip('v'), mirrorDupBtn: mirrorDup,
      rotLBtn: () => rotateBy(-15), rotRBtn: () => rotateBy(15), rot90LBtn: () => rotateBy(-90), rot90RBtn: () => rotateBy(90),
      scaleUpBtn: () => scaleBy(1.1), scaleDownBtn: () => scaleBy(1 / 1.1), opUpBtn: () => opacityBy(0.1), opDownBtn: () => opacityBy(-0.1),
      resetXfBtn: resetTransform, bringFrontBtn: () => reorder('front'), sendBackBtn: () => reorder('back'), bringFwdBtn: () => reorder('forward'), sendBackOneBtn: () => reorder('backward'),
      lockBtn: toggleLock, hideBtn: toggleVisible, pivotCenterBtn: () => { setMode('pivot'); centerPivot(); }, dupBtn: duplicateSel
    };
    Object.entries(map).forEach(([id, fn]) => { const el = $(id); if (el) el.onclick = fn; });
    const stage = $('stage'); if (stage) stage.addEventListener('pointerdown', onStagePointer, true);
    if (!window.__adobeParityKeys) {
      window.__adobeParityKeys = true;
      document.addEventListener('keydown', (ev) => {
        const tag = (ev.target && ev.target.tagName) || ''; if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
        window.__nudgeStep = ev.shiftKey ? 10 : 1;
        if (ev.key === 'ArrowLeft') { ev.preventDefault(); nudge(-1, 0); }
        if (ev.key === 'ArrowRight') { ev.preventDefault(); nudge(1, 0); }
        if (ev.key === 'ArrowUp') { ev.preventDefault(); nudge(0, -1); }
        if (ev.key === 'ArrowDown') { ev.preventDefault(); nudge(0, 1); }
        if ((ev.key === 'd' || ev.key === 'D') && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); duplicateSel(); }
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(wire, 50));
  else setTimeout(wire, 80);
})();
