/* Geed Hardwin Adobe-parity helpers v1.31 */
(function(){
  function $(id){return document.getElementById(id)}
  function toast(msg){try{if(typeof window.toast==='function')window.toast(msg);else console.log(msg)}catch(e){}}
  function scene(){return (window.scenes||[])[window.sceneIndex||0]||{objects:[]}}
  function selectedList(){
    const ids=window.selectedIds||[];
    const objs=scene().objects||[];
    if(ids.length)return ids.map(id=>objs.find(o=>o.id===id)).filter(Boolean);
    if(window.selectedId!=null){const o=objs.find(x=>x.id===window.selectedId);return o?[o]:[]}
    return [];
  }
  function ensureKey(o,f){
    if(!o.keys)o.keys=[];
    let k=o.keys.find(x=>x.frame===f);
    if(!k){k={frame:f,x:o.x,y:o.y,scaleX:o.scaleX??1,scaleY:o.scaleY??1,rotation:o.rotation??0,opacity:o.opacity??1};o.keys.push(k);o.keys.sort((a,b)=>a.frame-b.frame)}
    else{k.x=o.x;k.y=o.y;k.scaleX=o.scaleX??1;k.scaleY=o.scaleY??1;k.rotation=o.rotation??0;k.opacity=o.opacity??1}
  }
  function render(){try{if(typeof window.renderAll==='function')window.renderAll()}catch(e){}}
  function alignSelected(axis){
    const items=selectedList();
    if(items.length<2){toast('Select 2+ layers to align');return}
    const bounds=items.map(o=>({o,x:+(o.x||0),y:+(o.y||0),w:+(o.w||o.width||100),h:+(o.h||o.height||100)}));
    const f=window.frame||0;
    if(axis==='left'){const m=Math.min(...bounds.map(b=>b.x));bounds.forEach(b=>{b.o.x=m;ensureKey(b.o,f)})}
    if(axis==='right'){const m=Math.max(...bounds.map(b=>b.x+b.w));bounds.forEach(b=>{b.o.x=m-b.w;ensureKey(b.o,f)})}
    if(axis==='center'){const minX=Math.min(...bounds.map(b=>b.x)),maxX=Math.max(...bounds.map(b=>b.x+b.w));const c=(minX+maxX)/2;bounds.forEach(b=>{b.o.x=c-b.w/2;ensureKey(b.o,f)})}
    if(axis==='top'){const m=Math.min(...bounds.map(b=>b.y));bounds.forEach(b=>{b.o.y=m;ensureKey(b.o,f)})}
    if(axis==='bottom'){const m=Math.max(...bounds.map(b=>b.y+b.h));bounds.forEach(b=>{b.o.y=m-b.h;ensureKey(b.o,f)})}
    if(axis==='mid'){const minY=Math.min(...bounds.map(b=>b.y)),maxY=Math.max(...bounds.map(b=>b.y+b.h));const c=(minY+maxY)/2;bounds.forEach(b=>{b.o.y=c-b.h/2;ensureKey(b.o,f)})}
    render();toast('Aligned '+items.length+' layers');
  }
  function groupSel(){
    const items=selectedList();
    if(items.length<2){toast('Select 2+ layers');return}
    window.nextGroupId=window.nextGroupId||1;
    const id='grp-'+(window.nextGroupId++);
    items.forEach(x=>x.groupId=id);render();toast(items.length+' layers grouped');
  }
  function ungroupSel(){
    const items=selectedList();
    if(!items.length){toast('Select layers');return}
    items.forEach(x=>delete x.groupId);render();toast('Ungrouped');
  }
  function distribute(){
    const objs=scene().objects||[];
    objs.forEach(o=>{if(o.groupId)delete o.groupId});
    render();toast('Distribute to layers · groups cleared');
  }
  function classicTween(){
    const items=selectedList();
    if(!items.length){toast('Select an object');return}
    const f=window.frame||0;
    items.forEach(o=>{ensureKey(o,f);const k=(o.keys||[]).find(x=>x.frame===f);if(k)k.easing='easeInOut'});
    render();toast('Classic Tween · easeInOut @ frame '+f);
  }
  function setMode(mode){
    try{
      window.toolMode=mode;
      const stageHint=$('stageHint');
      if(stageHint){
        if(mode==='eraser')stageHint.textContent='Eraser · Click object to delete · Shift+click clear fill';
        else if(mode==='bucket')stageHint.textContent='Paint bucket · Click shape to recolor';
      }
      toast(mode==='eraser'?'Eraser tool':mode==='bucket'?'Paint bucket':'Tool '+mode);
    }catch(e){console.error(e)}
  }
  window.__bucketColor=window.__bucketColor||'#4f8cff';
  function onStagePointer(ev){
    const mode=window.toolMode;
    if(mode!=='eraser'&&mode!=='bucket')return;
    setTimeout(()=>{
      const items=selectedList();
      const obj=items[0];
      if(!obj){toast('Click an object first');return}
      const f=window.frame||0;
      if(mode==='eraser'){
        if(ev.shiftKey){obj.color='transparent';obj.fill='transparent';ensureKey(obj,f);toast('Fill cleared')}
        else if(typeof window.removeObjectsByIds==='function'){window.removeObjectsByIds(new Set([obj.id]));if(typeof window.selectOne==='function')window.selectOne(null);toast('Erased')}
        else{const arr=scene().objects;const i=arr.findIndex(x=>x.id===obj.id);if(i>=0)arr.splice(i,1);toast('Erased')}
        render();
      }else{
        const col=window.__bucketColor||'#4f8cff';
        if(obj.color!==undefined)obj.color=col;
        if(obj.fill!==undefined)obj.fill=col;
        ensureKey(obj,f);render();toast('Bucket '+col);
      }
    },30);
  }
  function wire(){
    const map={
      addEraser:()=>setMode('eraser'),
      addBucket:()=>setMode('bucket'),
      alignLeftBtn:()=>alignSelected('left'),
      alignCenterBtn:()=>alignSelected('center'),
      alignRightBtn:()=>alignSelected('right'),
      alignTopBtn:()=>alignSelected('top'),
      alignMidBtn:()=>alignSelected('mid'),
      alignBotBtn:()=>alignSelected('bottom'),
      toolbarGroup:groupSel,
      toolbarUngroup:ungroupSel,
      distributeLayersBtn:distribute,
      classicTweenBtn:classicTween
    };
    Object.entries(map).forEach(([id,fn])=>{const el=$(id);if(el)el.onclick=fn});
    const stage=$('stage');
    if(stage)stage.addEventListener('pointerdown',onStagePointer,true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);
  else setTimeout(wire,0);
})();
