/* X quick entry: keep the original player and use the existing viewer controls. */
(() => {
  'use strict';
  if (!['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(location.hostname) || window.top !== window || globalThis.smartXVideoEntry) return;
  globalThis.smartXVideoEntry = true;
  const entries = new Map();
  let host, root, frame = 0, running = false, opening = false;
  let pointer = { x: -1, y: -1 };
  const label = '进入独立观影';
  function schedule() { if (running && !frame) frame = requestAnimationFrame(update); }
  function mount() {
    host = document.createElement('div');
    host.setAttribute('data-smart-x-video', '');
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483644!important;pointer-events:none!important;';
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      button { position:fixed;box-sizing:border-box;width:36px;height:36px;display:grid;place-items:center;padding:8px;border:1px solid #ffffff45;border-radius:10px;background:rgba(24,24,28,.72);color:#fff;box-shadow:0 2px 8px #0004;backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);cursor:pointer;opacity:0;pointer-events:none;transition:opacity 120ms ease; }
      button[data-hover],button:focus-visible { opacity:1;pointer-events:auto; }
      button:hover { background:rgba(55,55,60,.9); }
      button:focus-visible { outline:2px solid #94c6ff;outline-offset:3px; }
      button[hidden] { display:none; }
      img { width:20px;height:20px;filter:brightness(0) invert(1);pointer-events:none; }
      .status { position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#252527;color:#fff;font:14px system-ui;padding:10px 16px;border-radius:10px; }
      .status:empty { display:none; }
      @media(hover:none) { button { opacity:1;pointer-events:auto; } }
      @media(prefers-reduced-motion:reduce) { button { transition:none; } }
      @media(prefers-reduced-transparency:reduce),(prefers-contrast:more) { button { background:#252527;backdrop-filter:none;-webkit-backdrop-filter:none;border-color:#aaa; } }
    </style><div class="status" role="status" aria-live="polite"></div>`;
    // Do not place controls inside React-managed player nodes or clickable posts.
    document.documentElement.append(host);
  }
  function add(video) {
    const button = document.createElement('button');
    button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
    const img = document.createElement('img');
    img.alt = ''; img.src = browser.runtime.getURL('toolbar-dark-38.png');
    button.append(img);
    for (const type of ['pointerdown','mousedown','pointerup','mouseup','dblclick','keydown','keyup']) {
      button.addEventListener(type, event => event.stopPropagation());
    }
    button.addEventListener('click', async event => {
      event.preventDefault(); event.stopPropagation();
      if (opening || !video.isConnected) return;
      opening = true;
      root.querySelector('.status').textContent = '';
      try {
        const result = await globalThis.smartVideoViewer?.openVideo(video);
        if (!result?.ok) root.querySelector('.status').textContent = result?.error || '观影组件未加载，请刷新网页后重试。';
      } catch { root.querySelector('.status').textContent = '打开失败，请刷新网页后重试。'; }
      finally { opening = false; schedule(); }
    });
    entries.set(video, button); root.append(button); resize.observe(video);
  }
  function update() {
    frame = 0;
    if (!host?.isConnected) { entries.clear(); resize.disconnect(); mount(); }
    const videos = new Set(document.querySelectorAll('video'));
    for (const [video, button] of entries) if (!videos.has(video)) {
      resize.unobserve(video); button.remove(); entries.delete(video);
    }
    for (const video of videos) if (!entries.has(video)) add(video);
    const active = globalThis.smartVideoViewer?.active();
    for (const [video, button] of entries) {
      const r = video.getBoundingClientRect();
      const x = r.right - 44, y = r.top + 8;
      const style = getComputedStyle(video);
      let visible = !active && !document.fullscreenElement && r.width >= 100 && r.height >= 70 && x >= 0 && x + 36 <= innerWidth && y >= 0 && y + 36 <= Math.min(r.bottom, innerHeight) && style.visibility !== 'hidden' && style.display !== 'none';
      // Hide behind dialogs, sticky headers and clipped/covered players.
      if (visible) {
        const hit = document.elementFromPoint(x + 18, y + 18);
        const player = video.closest('[data-testid="videoPlayer"]') || video.parentElement;
        visible = hit === host || hit === video || Boolean(hit && player?.contains(hit));
      }
      button.hidden = !visible;
      button.style.left = `${x}px`; button.style.top = `${y}px`;
      button.toggleAttribute('data-hover', visible && pointer.x >= r.left && pointer.x <= r.right && pointer.y >= r.top && pointer.y <= r.bottom);
    }
  }
  const resize = new ResizeObserver(schedule);
  const observer = new MutationObserver(records => {
    if (records.some(record => record.target !== host && !host?.contains(record.target))) schedule();
  });
  const move = event => { pointer = { x: event.clientX, y: event.clientY }; schedule(); };
  const leave = event => { if (event.relatedTarget) return; pointer = { x: -1, y: -1 }; schedule(); };
  function start() {
    if (running) return;
    running = true; mount();
    observer.observe(document, { childList:true, subtree:true, attributes:true, attributeFilter:['style','class','hidden','src'] });
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    document.addEventListener('pointermove', move, { passive:true });
    document.addEventListener('pointerout', leave);
    document.addEventListener('fullscreenchange', schedule);
    schedule();
  }
  function stop() {
    running = false; cancelAnimationFrame(frame); frame = 0;
    observer.disconnect(); resize.disconnect(); entries.clear(); host?.remove();
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerout', leave);
    document.removeEventListener('fullscreenchange', schedule);
  }
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', start);
  start();
})();
