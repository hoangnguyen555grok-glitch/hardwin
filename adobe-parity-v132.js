/* Geed Hardwin Adobe-parity helpers v1.32 — cutout animation workflow */
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
    if (!k) {
      k = { frame: f, x: o.x, y: o.y, scaleX: o.scaleX ?? 1, scaleY: o.scaleY ?? 1, rotation: o.rotation ?? 0, opacity: o.opacity ?? 1 };
      o.keys.push(k); o.keys.sort((a, b) => a.frame - b.frame);
    } else {
      k.x = o.x; k.y = o.y; k.scaleX = o.scaleX ?? 1; k.scaleY = o.scaleY ?? 1; k.rotation = o.rotation ?? 0; k.opacity = o.opacity ?? 1;
    }
    return k;
  }
  function render() { try { if (typeof window.renderAll === 'function') window.renderAll(); } catch (e) {} }
  function objSize(o) { return { w: +(o.w || o.width || 100), h: +(o.h || o.height || 100) }; }
  function alignSelected(axis) {
    const items = selectedList();
    if (items.length < 2) { toast('Chọn từ 2 layer trở lên để căn'); return; }
    const bounds = items.map((o) => { const s = objSize(o); return { o, x: +(o.x || 0), y: +(o.y || 0), w: s.w, h: s.h }; });
    const f = frameNow();
    if (axis === 'left') { const m = Math.min(...bounds.map((b) => b.x)); bounds.forEach((b) => { b.o.x = m; ensureKey(b.o, f); }); }
    if (axis === 'right') { const m = Math.max(...bounds.map((b) => b.x + b.w)); bounds.forEach((b) => { b.o.x = m - b.w; ensureKey(b.o, f); }); }
    if (axis === 'center') { const minX = Math.min(...bounds.map((b) => b.x)), maxX = Math.max(...bounds.map((b) => b.x + b.w)); const c = (minX + maxX) / 2; bounds.forEach((b) => { b.o.x = c - b.w / 2; ensureKey(b.o, f); }); }
    if (axis === 'top') { const m = Math.min(...bounds.map((b) => b.y)); bounds.forEach((b) => { b.o.y = m; ensureKey(b.o, f); }); }
    if (axis === 'bottom') { const m = Math.max(...bounds.map((b) => b.y + b.h)); bounds.forEach((b) => { b.o.y = m - b.h; ensureKey(b.o, f); }); }
    if (axis === 'mid') { const minY = Math.min(...bounds.map((b) => b.y)), maxY = Math.max(...bounds.map((b) => b.y + b.h)); const c = (minY + maxY) / 2; bounds.forEach((b) => { b.o.y = c - b.h / 2; ensureKey(b.o, f); }); }
    render(); toast('Đã căn ' + items.length + ' layer');
  }
  function centerOnStage() {
    const items = selectedList(); if (!items.length) { toast('Chọn object'); return; }
    const f = frameNow();
    items.forEach((o) => { const s = objSize(o); o.x = (STAGE_W - s.w) / 2; o.y = (STAGE_H - s.h) / 2; ensureKey(o, f); });
    render(); toast('Căn giữa sân khấu');
  }
  function groupSel() {
    const items = selectedList(); if (items.length < 2) { toast('Chọn từ 2 layer'); return; }
    window.nextGroupId = window.nextGroupId || 1; const id = 'grp-' + window.nextGroupId++;
    items.forEach((x) => (x.groupId = id)); render(); toast(items.length + ' layer đã group');
  }
  function ungroupSel() {
    const items = selectedList(); if (!items.length) { toast('Chọn layer'); return; }
    items.forEach((x) => delete x.groupId); render(); toast('Ungroup');
  }
  function distribute() {
    (scene().objects || []).forEach((o) => { if (o.groupId) delete o.groupId; });
    render(); toast('Distribute to layers');
  }
  function classicTween() {
    const items = selectedList(); if (!items.length) { toast('Chọn object'); return; }
    const f = frameNow();
    items.forEach((o) => {
      const k = ensureKey(o, f); k.easing = 'easeInOut';
      const nextF = f + 8;
      if (!(o.keys || []).some((x) => x.frame === nextF)) {
        o.keys.push({ frame: nextF, x: o.x, y: o.y, scaleX: o.scaleX ?? 1, scaleY: o.scaleY ?? 1, rotation: o.rotation ?? 0, opacity: o.opacity ?? 1, easing: 'easeInOut' });
        o.keys.sort((a, b) => a.frame - b.frame);
      }
    });
    render(); toast('Classic Tween · easeInOut @ ' + f + ' → ' + (f + 8));
  }
  function flip(axis) {
    const items = selectedList(); if (!items.length) { toast('Chọn object'); return; }
    const f = frameNow();
    items.forEach((o) => { if (axis === 'h') o.scaleX = -(o.scaleX ?? 1); else o.scaleY = -(o.scaleY ?? 1); ensureKey(o, f); });
    render(); toast(axis === 'h' ? 'Lật ngang' : 'Lật dọc');
  }
  function reorder(dir) {
    const objs = scene().objects; if (!objs || !objs.length) return;
    const items = selectedList(); if (!items.length) { toast('Chọn layer'); return; }
    const ids = new Set(items.map((o) => o.id));
    const indices = objs.map((o, i) => (ids.has(o.id) ? i : -1)).filter((i) => i >= 0);
    if (!indices.length) return;
    if (dir === 'front') { const picked = indices.map((i) => objs[i]); for (let i = indices.length - 1; i >= 0; i--) objs.splice(indices[i], 1); objs.push(...picked); toast('Lên trên cùng'); }
    else if (dir === 'back') { const picked = indices.map((i) => objs[i]); for (let i = indices.length - 1; i >= 0; i--) objs.splice(indices[i], 1); objs.unshift(...picked); toast('Xuống dưới cùng'); }
    else if (dir === 'forward') { const max = Math.max(...indices); if (max < objs.length - 1) { const t = objs[max]; objs[max] = objs[max + 1]; objs[max + 1] = t; } toast('Bring forward'); }
    else if (dir === 'backward') { const min = Math.min(...indices); if (min > 0) { const t = objs[min]; objs[min] = objs[min - 1]; objs[min - 1] = t; } toast('Send backward'); }
    render();
  }
  function toggleLock() {
    const items = selectedList(); if (!items.length) { toast('Chọn layer'); return; }
    const lock = !items.every((o) => o.locked); items.forEach((o) => (o.locked = lock)); render(); toast(lock ? 'Khóa layer' : 'Mở khóa');
  }
  function toggleVisible() {
    const items = selectedList(); if (!items.length) { toast('Chọn layer'); return; }
    const hide = items.every((o) => o.visible !== false); items.forEach((o) => (o.visible = !hide)); render(); toast(hide ? 'Ẩn layer' : 'Hiện layer');
  }
  function centerPivot() {
    const items = selectedList(); if (!items.length) { toast('Chọn object'); return; }
    items.forEach((o) => { const s = objSize(o); o.pivotX = s.w / 2; o.pivotY = s.h / 2; o.regX = s.w / 2; o.regY = s.h / 2; });
    render(); toast('Pivot giữa object');
  }
  function duplicateSel() {
    const items = selectedList(); if (!items.length) { toast('Chọn object'); return; }
    const objs = scene().objects; window.nextId = window.nextId || 1000; const created = [];
    items.forEach((o) => {
      const copy = JSON.parse(JSON.stringify(o)); copy.id = window.nextId++; copy.name = (o.name || o.type || 'obj') + ' copy';
      copy.x = (o.x || 0) + 24; copy.y = (o.y || 0) + 24; if (copy.groupId) delete copy.groupId; objs.push(copy); created.push(copy.id);
    });
    if (typeof window.selectOne === 'function' && created.length === 1) window.selectOne(created[0]);
    else if (window.selectedIds) window.selectedIds = created;
    render(); toast('Nhân bản ' + created.length);
  }
  function nudge(dx, dy) {
    const items = selectedList(); if (!items.length) return;
    const f = frameNow(); const step = window.__nudgeStep || 1;
    items.forEach((o) => { if (o.locked) return; o.x = (o.x || 0) + dx * step; o.y = (o.y || 0) + dy * step; ensureKey(o, f); });
    render();
  }
  function setMode(mode) {
    window.toolMode = mode;
    const stageHint = $('stageHint');
    if (stageHint) {
      if (mode === 'eraser') stageHint.textContent = 'Eraser · Click object để xóa · Shift+click xóa fill';
      else if (mode === 'bucket') stageHint.textContent = 'Paint bucket · Click shape để tô màu';
      else if (mode === 'pivot') stageHint.textContent = 'Pivot · Điểm quay giữa object';
    }
    toast(mode === 'eraser' ? 'Eraser' : mode === 'bucket' ? 'Paint bucket' : mode === 'pivot' ? 'Đặt pivot' : 'Tool ' + mode);
  }
  window.__bucketColor = window.__bucketColor || '#4f8cff';
  function onStagePointer(ev) {
    const mode = window.toolMode;
    if (mode !== 'eraser' && mode !== 'bucket' && mode !== 'pivot') return;
    setTimeout(() => {
      const obj = selectedList()[0]; if (!obj) { toast('Click chọn object trước'); return; }
      const f = frameNow();
      if (mode === 'eraser') {
        if (ev.shiftKey) { obj.color = 'transparent'; obj.fill = 'transparent'; ensureKey(obj, f); toast('Đã xóa fill'); }
        else if (typeof window.removeObjectsByIds === 'function') { window.removeObjectsByIds(new Set([obj.id])); if (typeof window.selectOne === 'function') window.selectOne(null); toast('Đã xóa'); }
        else { const arr = scene().objects; const i = arr.findIndex((x) => x.id === obj.id); if (i >= 0) arr.splice(i, 1); toast('Đã xóa'); }
        render();
      } else if (mode === 'bucket') {
        const col = window.__bucketColor || '#4f8cff'; if (obj.color !== undefined) obj.color = col; if (obj.fill !== undefined) obj.fill = col; ensureKey(obj, f); render(); toast('Bucket ' + col);
      } else if (mode === 'pivot') { const s = objSize(obj); obj.pivotX = s.w / 2; obj.pivotY = s.h / 2; obj.regX = s.w / 2; obj.regY = s.h / 2; render(); toast('Pivot giữa'); }
    }, 30);
  }
  function ensureToolbar() {
    if (document.getElementById('adobeParityPanel')) return;
    const left = document.querySelector('.left') || document.querySelector('.toolgrid')?.parentElement; if (!left) return;
    const panel = document.createElement('div'); panel.id = 'adobeParityPanel'; panel.className = 'section';
    panel.innerHTML = '<div class="sectiontitle">Animate tools · v1.32</div><div class="toolgrid" id="adobeParityGrid">'
      + '<button class="tool" id="addEraser"><span class="ico">⌫</span>Eraser</button><button class="tool" id="addBucket"><span class="ico">🪣</span>Bucket</button>'
      + '<button class="tool" id="alignLeftBtn">⫷ L</button><button class="tool" id="alignCenterBtn">☰ C</button><button class="tool" id="alignRightBtn">⫸ R</button>'
      + '<button class="tool" id="alignTopBtn">⤒ T</button><button class="tool" id="alignMidBtn">☰ M</button><button class="tool" id="alignBotBtn">⤓ B</button>'
      + '<button class="tool" id="centerStageBtn" style="grid-column:1/-1">Center on stage</button>'
      + '<button class="tool" id="toolbarGroup">Group</button><button class="tool" id="toolbarUngroup">Ungroup</button>'
      + '<button class="tool" id="distributeLayersBtn" style="grid-column:1/-1">Distribute layers</button>'
      + '<button class="tool" id="classicTweenBtn" style="grid-column:1/-1">Classic Tween</button>'
      + '<button class="tool" id="flipHBtn">Flip H</button><button class="tool" id="flipVBtn">Flip V</button>'
      + '<button class="tool" id="bringFrontBtn">To front</button><button class="tool" id="sendBackBtn">To back</button>'
      + '<button class="tool" id="bringFwdBtn">Forward</button><button class="tool" id="sendBackOneBtn">Backward</button>'
      + '<button class="tool" id="lockBtn">Lock</button><button class="tool" id="hideBtn">Hide</button>'
      + '<button class="tool" id="pivotCenterBtn">Pivot ⌖</button><button class="tool" id="dupBtn">Duplicate</button></div>'
      + '<div class="smallmuted" style="margin-top:8px;line-height:1.4">Phím: ←↑→↓ 1px · Shift+mũi tên 10px · D nhân bản</div>';
    const grid = left.querySelector('.toolgrid');
    if (grid && grid.parentElement) grid.parentElement.insertAdjacentElement('afterend', panel); else left.appendChild(panel);
    const meta = document.querySelector('.topmeta'); if (meta) meta.textContent = meta.textContent.replace(/v\d+\.\d+/, 'v1.32');
    const st = document.querySelector('.status'); if (st) st.textContent = st.textContent.replace(/v\d+\.\d+/, 'v1.32');
  }
  function wire() {
    ensureToolbar();
    const map = {
      addEraser: () => setMode('eraser'), addBucket: () => setMode('bucket'),
      alignLeftBtn: () => alignSelected('left'), alignCenterBtn: () => alignSelected('center'), alignRightBtn: () => alignSelected('right'),
      alignTopBtn: () => alignSelected('top'), alignMidBtn: () => alignSelected('mid'), alignBotBtn: () => alignSelected('bottom'),
      centerStageBtn: centerOnStage, toolbarGroup: groupSel, toolbarUngroup: ungroupSel, distributeLayersBtn: distribute, classicTweenBtn: classicTween,
      flipHBtn: () => flip('h'), flipVBtn: () => flip('v'), bringFrontBtn: () => reorder('front'), sendBackBtn: () => reorder('back'),
      bringFwdBtn: () => reorder('forward'), sendBackOneBtn: () => reorder('backward'), lockBtn: toggleLock, hideBtn: toggleVisible,
      pivotCenterBtn: () => { setMode('pivot'); centerPivot(); }, dupBtn: duplicateSel
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
