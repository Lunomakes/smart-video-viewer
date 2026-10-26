/* Keep the site's original media element connected: no URL extraction or reparenting. */
(() => {
  'use strict';
  if (globalThis.smartVideoViewer) return;
  const ids = new WeakMap();
  let serial = 0;
  let session = null;
  let generation = 0;
  let preparedToken = null;
  let promoted = null;
  const defaults = { rate: 1, seekSeconds: 5 };
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  const valid = (n, min, max, fallback) => Number.isFinite(Number(n)) && Number(n) >= min && Number(n) <= max ? Number(n) : fallback;
  const cleanSettings = (s = {}) => ({ rate: valid(s.rate, 0.1, 16, 1), seekSeconds: valid(s.seekSeconds, 0.1, 600, 5) });
  const parentElement = (el) => el.parentElement || el.getRootNode()?.host;
  function deepQuery(selector, root = document) {
    const result = [...root.querySelectorAll(selector)];
    for (const el of root.querySelectorAll('*')) if (el.shadowRoot) result.push(...deepQuery(selector, el.shadowRoot));
    return result;
  }
  const allVideos = () => deepQuery('video');
  // Only use explicit video metadata; document titles and uploader names are not cast.
  function metadata(video = null) {
    const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    const names = value => [...new Set([value].flat().map(item => text(typeof item === 'string' ? item : item?.name)).filter(name => name && !/^https?:/i.test(name)))].slice(0, 12);
    const meta = property => text(document.querySelector(`meta[property="${property}"]`)?.content);
    const records = [];
    function visit(value, depth = 0) {
      if (!value || typeof value !== 'object' || depth > 12) return;
      if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return; }
      if ([value['@type']].flat().some(type => ['VideoObject', 'Movie', 'TVEpisode'].includes(type))) records.push(value);
      for (const key of ['@graph', 'mainEntity', 'video', 'subjectOf']) visit(value[key], depth + 1);
    }
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      if (script.textContent.length > 500000) continue;
      try { visit(JSON.parse(script.textContent)); } catch { /* Malformed page metadata is optional. */ }
    }
    const absolute = value => { try { return new URL(value, location.href).href; } catch { return ''; } };
    const sources = video ? [video.currentSrc, video.getAttribute('src')].filter(Boolean).map(absolute) : [];
    const matched = records.filter(item => sources.includes(absolute(item.contentUrl)));
    const soleVideo = allVideos().length === (video ? 1 : 0);
    const record = matched.length === 1 ? matched[0] : soleVideo && records.length === 1 ? records[0] : null;
    const scope = video?.closest('[itemscope][itemtype*="VideoObject"], [itemscope][itemtype*="Movie"]');
    const scopedName = scope?.querySelector('[itemprop="name"]');
    let title = text(video?.getAttribute('title')) || text(scopedName?.content || scopedName?.textContent) || text(record?.name);
    let actors = names(record?.actor || record?.actors);
    if (scope) actors = names([...scope.querySelectorAll('[itemprop="actor"], [itemprop="actors"]')].map(el => {
      const name = el.querySelector('[itemprop="name"]'); return name?.content || name?.textContent || el.content || el.textContent;
    })).concat(actors);
    // Page-level Open Graph is safe only for a single-video detail page.
    if (soleVideo && /^video[.:]/i.test(meta('og:type'))) {
      title ||= meta('og:title');
      actors.push(...names([...document.querySelectorAll('meta[property="video:actor"]')].map(el => el.content)));
      for (const label of document.querySelectorAll('dt, strong, b, .label')) {
        if (!/^(演员|演員|出演|主演|cast|actors?|actresses?|models?)\s*[:：]?$/i.test(text(label.textContent))) continue;
        if (label.closest('aside, nav, footer')) continue;
        const field = label.tagName === 'DT' ? label.nextElementSibling : label.parentElement;
        if (!field || field.textContent.length > 1200) continue;
        const links = [...field.querySelectorAll('a')];
        actors.push(...names(links.map(el => el.textContent)));
      }
    }
    return { title, actors: [...new Set(actors)].slice(0, 12) };
  }
  function inventory() {
    return allVideos().map(video => {
      if (!ids.has(video)) ids.set(video, String(++serial));
      const r = video.getBoundingClientRect();
      const visible = r.width > 32 && r.height > 24 && getComputedStyle(video).visibility !== 'hidden';
      return { id: ids.get(video), visible, playing: !video.paused && !video.ended,
        area: r.width * r.height, duration: Number.isFinite(video.duration) ? video.duration : 0,
        score: (visible ? 100 : -1000) + (!video.paused ? 100 : 0) + Math.min(r.width * r.height / 10000, 90) + (video.duration > 120 ? 25 : 0) };
    }).filter(v => v.visible || v.playing);
  }
  // Restore only properties changed by us, preserving unrelated site updates.
  function elevate(element, isFrame = false) {
    const restorers = [];
    const originalScroll = { x: window.scrollX, y: window.scrollY };
    const parent = parentElement(element);
    const parentHeight = parent?.getBoundingClientRect().height;
    function set(el, properties) {
      for (const [key, value] of Object.entries(properties)) {
        const before = el.style.getPropertyValue(key), priority = el.style.getPropertyPriority(key);
        el.style.setProperty(key, value, 'important');
        const applied = el.style.getPropertyValue(key);
        restorers.push(() => {
          if (el.style.getPropertyValue(key) !== applied || el.style.getPropertyPriority(key) !== 'important') return;
          if (before) el.style.setProperty(key, before, priority); else el.style.removeProperty(key);
        });
      }
    }
    // Out-of-flow videos already have a site-owned aspect-ratio placeholder.
    // Adding a minimum height can double-count its padding-based height.
    const videoPosition = getComputedStyle(element).position;
    if (parent && parentHeight && !['absolute', 'fixed'].includes(videoPosition)) set(parent, { 'min-height': `${parentHeight}px` });
    let child = element;
    for (let ancestor = parentElement(child); ancestor; child = ancestor, ancestor = parentElement(child)) {
      // Relative/absolute positioning does not contain a fixed video. Preserve it:
      // making X's absolute player layers static inflates the feed's measured rows.
      // Fixed/sticky ancestors still need their unconditional stacking context removed.
      const position = getComputedStyle(ancestor).position;
      set(ancestor, { ...(['fixed', 'sticky'].includes(position) ? { position: 'static' } : {}),
        transform: 'none', translate: 'none', rotate: 'none', scale: 'none', filter: 'none',
        'backdrop-filter': 'none', perspective: 'none', contain: 'none', 'content-visibility': 'visible',
        'will-change': 'auto', overflow: 'visible', 'clip-path': 'none', clip: 'auto', opacity: '1',
        isolation: 'auto', 'z-index': 'auto', 'pointer-events': 'none' });
    }
    set(document.documentElement, { overflow: 'hidden' });
    set(element, { position: 'fixed', 'z-index': '2147483646', margin: '0px', padding: '0px', border: '0px',
      'min-width': '0px', 'min-height': '0px', 'max-width': 'none', 'max-height': 'none',
      transform: 'none', translate: 'none', rotate: 'none', scale: 'none', 'object-fit': 'contain',
      'box-sizing': 'border-box', 'pointer-events': 'auto', visibility: 'visible', opacity: '1',
      ...(isFrame ? { inset: '0px', width: '100vw', height: '100vh', background: '#08090b' } : {}) });
    return { set, restore: () => { restorers.reverse().forEach(fn => fn()); window.scrollTo(originalScroll.x, originalScroll.y); } };
  }
  function relay(active) {
    if (window.parent !== window && preparedToken) window.parent.postMessage({ type: 'smart-viewer-frame', token: preparedToken, active }, '*');
  }
  function restoreFrame() {
    if (!promoted) return;
    promoted.frame.removeEventListener('load', promoted.onLoad);
    promoted.observer.disconnect();
    promoted.styles.restore(); promoted = null; relay(false);
  }
  window.addEventListener('message', event => {
    const data = event.data;
    if (!preparedToken || data?.type !== 'smart-viewer-frame' || data.token !== preparedToken) return;
    const frame = deepQuery('iframe, frame').find(el => el.contentWindow === event.source);
    if (!frame) return;
    if (!data.active) { if (promoted?.frame === frame) restoreFrame(); return; }
    if (promoted?.frame === frame) return;
    restoreFrame();
    const onLoad = () => { restoreFrame(); browser.runtime.sendMessage({ type: 'close-viewer' }).catch(() => {}); };
    const observer = new MutationObserver(() => { if (!frame.isConnected) restoreFrame(); });
    observer.observe(document, { childList: true, subtree: true });
    promoted = { frame, styles: elevate(frame, true), onLoad, observer };
    frame.addEventListener('load', onLoad); relay(true);
  });
  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return '直播';
    const n = Math.max(0, Math.floor(seconds)), h = Math.floor(n / 3600);
    return `${h ? h + ':' : ''}${String(Math.floor(n / 60) % 60).padStart(h ? 2 : 1, '0')}:${String(n % 60).padStart(2, '0')}`;
  }
  function close() {
    generation += 1;
    if (!session) { restoreFrame(); return; }
    const s = session; session = null;
    s.abort.abort(); s.observer.disconnect(); clearInterval(s.timer); clearTimeout(s.saveTimer); clearTimeout(s.hideTimer);
    s.subtitles?.dispose(); s.host.remove(); s.styles.restore();
    if (s.video.controls === false) s.video.controls = s.originalControls;
    if (s.video.playbackRate === s.appliedRate) {
      try { s.video.playbackRate = s.originalRate; } catch { /* Site may have replaced media. */ }
    }
    if (s.video.preservesPitch === true) s.video.preservesPitch = s.originalPitch;
    if (s.previousFocus?.isConnected) s.previousFocus.focus({ preventScroll: true });
    relay(false);
    // Flush preferences even if the viewer is closed immediately after a drag.
    if (s.settingsDirty) browser.storage.local.set({ viewerSettings: s.settings }).catch(() => {});
  }
  async function open(id, token, pageMetadata = null) {
    if (session) close();
    const video = allVideos().find(v => ids.get(v) === id);
    if (!video?.isConnected) return { ok: false, error: '视频已经变化，请重新检测。' };
    const wasPlaying = !video.paused && !video.ended;
    preparedToken = token;
    const opening = ++generation;
    let stored = {};
    try { stored = (await browser.storage.local.get('viewerSettings')).viewerSettings || {}; } catch { /* Defaults work without storage. */ }
    if (opening !== generation || !video.isConnected) return { ok: false, error: '观影操作已取消，请重新打开。' };
    const settings = cleanSettings(stored);
    const info = metadata(video);
    if (!info.title && !info.actors.length && pageMetadata) {
      info.title = typeof pageMetadata.title === 'string' ? pageMetadata.title.slice(0, 300) : '';
      info.actors = Array.isArray(pageMetadata.actors) ? pageMetadata.actors.filter(v => typeof v === 'string').slice(0, 12).map(v => v.slice(0, 300)) : [];
    }
    const host = document.createElement('div');
    host.setAttribute('data-smart-video-viewer', '');
    host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;pointer-events:none!important;visibility:visible!important;font:14px -apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif!important;color:#f5f5f7!important;color-scheme:dark!important;';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
      :host { color-scheme:dark; font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#f5f5f7; }
      * { box-sizing:border-box; } button,input,select { font:inherit; }
      .backdrop { position:fixed;inset:0;background:rgba(0,0,0,.90);pointer-events:auto; }
      .cursor-shield { position:fixed;inset:0;width:100%;height:100%;pointer-events:none; }
      .cursor-shield path { fill:transparent;fill-rule:evenodd;pointer-events:fill;cursor:default; }
      .dock { position:fixed;bottom:24.31px;left:50%;transform:translateX(-50%) scale(.9326655944);transform-origin:center bottom;width:min(560px,calc(100vw - 32px));pointer-events:auto; }
      .panel { opacity:1;transition:opacity 180ms ease-out;padding:10px 14px 8px;background:#252527;border:1px solid rgba(255,255,255,.18);border-radius:12px;pointer-events:auto;box-shadow:inset 0 1px 0 rgba(255,255,255,.12),0 4px 8px rgba(0,0,0,.28); }
      @supports ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))) {
        .panel { background:linear-gradient(155deg,rgba(255,255,255,.12),rgba(255,255,255,.025) 48%,rgba(255,255,255,.055)),rgba(24,24,28,.58);-webkit-backdrop-filter:blur(28px) saturate(160%);backdrop-filter:blur(28px) saturate(160%); }
      }
      @media(prefers-reduced-transparency:reduce), (prefers-contrast:more) {
        .panel { background:#252527;-webkit-backdrop-filter:none;backdrop-filter:none;border-color:#8c8c93; }
      }
      .video-info { position:fixed;padding:14px 18px;max-height:120px;overflow:hidden;pointer-events:none;opacity:1;transition:opacity 180ms ease-out;background:linear-gradient(rgba(0,0,0,.65),transparent);text-shadow:0 1px 3px #000; }
      .video-info[hidden], .video-info [hidden] { display:none; }
      .focus-hint { position:fixed;top:24px;left:50%;transform:translateX(-50%);margin:0;padding:8px 14px;border-radius:10px;background:rgba(24,24,28,.78);border:1px solid rgba(255,255,255,.18);font-size:13px;pointer-events:none;white-space:nowrap; }
      .focus-hint[hidden] { display:none; }
      .video-info[data-hidden] { opacity:0; }
      .video-title { margin:0;font-size:16px;font-weight:600;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere; }
      .video-actors { margin:5px 0 0;font-size:12px;line-height:1.5;color:#e4e4e9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      @media(prefers-reduced-motion:reduce) { .video-info { transition:none; } }
      .dock[data-hidden] .panel { opacity:0;pointer-events:none; }
      @media(prefers-reduced-motion:reduce) { .panel { transition:none; } }
      .row { display:flex;align-items:center;gap:8px; } .main { justify-content:center; } .timeline { margin-top:6px;gap:8px; }
      .settings { margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.16);justify-content:space-between;flex-wrap:wrap;gap:8px; }
      button { min-width:28px;min-height:28px;padding:4px 7px;background:transparent;border:0;border-radius:8px;color:#f5f5f7;cursor:pointer;white-space:nowrap; }
      button:hover { background:#ffffff1c; } button:active { background:#ffffff30; } button:disabled { opacity:.45;cursor:default; }
      button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible { outline:2px solid #94c6ff;outline-offset:3px; }
      .play { font-size:18px;min-width:36px; } .secondary { color:#c4c4cc;font-size:12px; }
      input { accent-color:#e9e9ed;color:#f5f5f7;min-width:0; } input[type=range] { cursor:pointer; }
      #timeline { flex:1;width:50px; } #volume { width:54px; } #rate-range { width:76px; }
      input[type=number] { width:56px;padding:4px;background:rgba(0,0,0,.24);border:1px solid rgba(255,255,255,.28);border-radius:6px; }
      .subtitles { margin-top:6px;flex-wrap:wrap; } select { max-width:210px;min-width:100px;color:#f5f5f7;background:#252527;border:1px solid #ffffff47;border-radius:6px;padding:4px;min-height:28px; }
      label { display:flex;align-items:center;gap:5px;color:#d8d8df;white-space:nowrap; }
      .clock { font-size:12px;font-variant-numeric:tabular-nums;min-width:38px; }
      .spacer { flex:1; } .status { font-size:12px;min-height:15px;margin:5px 0 0;color:#c4c4cc;text-align:center; }
      details { font-size:12px;color:#c4c4cc;margin-top:4px; } summary { cursor:pointer; } details p { margin:8px 0 0;line-height:1.6; }
      @media(max-width:540px) { .dock { bottom:10px; }.panel { padding:8px 10px; }.row { gap:6px; }.main { gap:4px; }.main button { padding:4px;min-width:28px;font-size:12px; }.main .play { min-width:34px;font-size:18px; }#volume { display:none; }#rate-range { width:80px; } }
      @media(max-height:440px) { details,.settings { display:none; }.dock { bottom:6px; }.panel { padding:8px 12px; }.status { margin-top:4px; } }
      </style>
      <svg class="cursor-shield" aria-hidden="true" focusable="false"><path/></svg>
      <section class="video-info" aria-label="视频信息" hidden><h2 class="video-title"></h2><p class="video-actors"></p></section>
      <p class="focus-hint" role="status" hidden>点按画面以使用键盘快捷键</p>
      <div class="dock">
      <section class="panel" role="region" aria-label="视频播放控制">
        <div class="row main">
          <button id="mute" aria-label="静音">声音</button><input id="volume" type="range" min="0" max="1" step="0.01" aria-label="音量">
          <span class="spacer"></span><button id="back" aria-label="快退">−5秒</button><button id="play" class="play" aria-label="播放">▶</button><button id="forward" aria-label="快进">+5秒</button><span class="spacer"></span>
          <button id="pip" title="画中画" aria-label="画中画">画中画</button><button id="full" title="全屏" aria-label="全屏">⛶</button>
        </div>
        <div class="row timeline"><span id="elapsed" class="clock">0:00</span><input id="timeline" type="range" min="0" max="100" step="0.1" value="0" aria-label="播放进度"><span id="duration" class="clock">0:00</span></div>
        <div class="row settings"><label>倍速 <input id="rate-range" type="range" min="0.1" max="16" step="0.1" aria-label="连续倍速滑块"><input id="rate" type="number" min="0.1" max="16" step="0.1" aria-label="播放倍速">×</label><button id="reset">恢复 1×</button><label>每次跳转 <input id="seek" type="number" min="0.1" max="600" step="any" aria-label="每次跳转秒数">秒</label></div>
        <div class="row subtitles"><label>字幕 <select id="subtitles" aria-label="字幕轨道"></select></label><button id="import-subtitles">导入 SRT / VTT</button><input id="subtitle-file" type="file" accept=".srt,.vtt" hidden></div>
        <p id="status" class="status" role="status" aria-live="polite">← → 快退／快进 · 空格 暂停 · [ ] 调节倍速</p>
        <details><summary>快捷键与播放说明</summary><p>← / J 快退，→ / L 快进；空格 / K 播放暂停；[ / ] 调速 0.1×；R 恢复 1×；M 静音；F 全屏；Esc 退出。输入数值时不触发快捷键。极端倍速可能静音或不受浏览器支持。全屏使用 Safari 原生控制，退出全屏后继续使用这里的倍速与秒数设置。</p></details>
      </section></div>`;
    const information = root.querySelector('.video-info');
    const cursorShield = root.querySelector('.cursor-shield');
    const cursorRegion = cursorShield.querySelector('path');
    information.hidden = !info.title && !info.actors.length;
    const titleNode = root.querySelector('.video-title');
    titleNode.textContent = info.title; titleNode.hidden = !info.title;
    const actorsNode = root.querySelector('.video-actors');
    actorsNode.textContent = info.actors.length ? `演员：${info.actors.join(' · ')}` : '';
    actorsNode.hidden = !info.actors.length;
    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed!important;inset:0!important;background:rgba(0,0,0,.90)!important;z-index:2147483645!important;pointer-events:auto!important;cursor:default!important;';
    // The backdrop must sit below the original video, outside the controls' stacking context.
    const originalVideoRect = video.getBoundingClientRect();
    const fallbackRatio = originalVideoRect.width > 0 && originalVideoRect.height > 0 ? originalVideoRect.width / originalVideoRect.height : 16 / 9;
    const styles = elevate(video);
    (document.body || document.documentElement).append(backdrop, host);
    const originalRestore = styles.restore;
    styles.restore = () => { backdrop.remove(); originalRestore(); };
    const abort = new AbortController();
    const s = session = { video, host, root, settings, styles, abort, originalControls: video.controls,
      originalRate: video.playbackRate, originalPitch: video.preservesPitch, appliedRate: null,
      previousFocus: document.activeElement, saveTimer: null };
    const $ = name => root.getElementById(name);
    const on = (target, type, fn, opts = {}) => target.addEventListener(type, fn, { ...opts, signal: abort.signal });
    const status = text => { $('status').textContent = text; };
    s.subtitles = globalThis.smartVideoSubtitles.attach(video, $('subtitles'), status);
    on($('import-subtitles'), 'click', () => $('subtitle-file').click());
    on($('subtitle-file'), 'change', async () => {
      try { await s.subtitles.importFile($('subtitle-file').files[0]); }
      catch (error) { if (session === s) status(error.message); }
      $('subtitle-file').value = '';
    });
    const dock = root.querySelector('.dock');
    const panel = root.querySelector('.panel');
    let pointerInside = dock.matches(':hover');
    let draggingControl = false;
    function hideControls() {
      if (pointerInside || draggingControl) return;
      // Unfocus hidden inputs so arrows still control playback after editing settings.
      if (panel.contains(root.activeElement)) host.focus({ preventScroll: true });
      panel.inert = true;
      panel.setAttribute('aria-hidden', 'true');
      dock.setAttribute('data-hidden', '');
      information.setAttribute('data-hidden', '');
      information.setAttribute('aria-hidden', 'true');
    }
    function scheduleHide(delay = 800) {
      clearTimeout(s.hideTimer);
      s.hideTimer = setTimeout(hideControls, delay);
    }
    on(dock, 'pointerenter', event => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      pointerInside = true; clearTimeout(s.hideTimer);
      dock.removeAttribute('data-hidden');
      information.removeAttribute('data-hidden');
      information.removeAttribute('aria-hidden');
      panel.inert = false; panel.removeAttribute('aria-hidden');
    });
    on(dock, 'pointerleave', () => { pointerInside = false; scheduleHide(); });
    on(dock, 'pointerdown', () => { draggingControl = true; });
    on(window, 'pointerup', () => { draggingControl = false; if (!pointerInside) scheduleHide(); }, { capture: true });
    on(window, 'pointercancel', () => { draggingControl = false; if (!pointerInside) scheduleHide(); }, { capture: true });
    scheduleHide(2000);

    const save = () => { s.settingsDirty = true; clearTimeout(s.saveTimer); s.saveTimer = setTimeout(() => { s.saveTimer = null; browser.storage.local.set({ viewerSettings: { ...settings } }).then(() => { s.settingsDirty = false; }).catch(() => status('设置未能保存，本次播放仍可使用。')); }, 200); };
    function updateCursorShield() {
      // A transparent region above the video catches letterboxing without
      // clipping native captions or changing the original player's styles.
      cursorShield.style.display = nativePresentation() ? 'none' : 'block';
      const rect = video.getBoundingClientRect();
      const ratio = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : fallbackRatio;
      const width = Math.min(rect.width, rect.height * ratio);
      const height = width / ratio;
      const left = rect.left + (rect.width - width) / 2;
      const top = rect.top + (rect.height - height) / 2;
      cursorRegion.setAttribute('d', `M0 0H${innerWidth}V${innerHeight}H0Z M${left} ${top}H${left + width}V${top + height}H${left}Z`);
    }
    function layout() {
      // Fit the actual picture, not an oversized video box containing clickable letterboxing.
      const ratio = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : fallbackRatio;
      const width = Math.min(innerWidth, innerHeight * ratio);
      const height = width / ratio;
      information.style.left = `${(innerWidth - width) / 2}px`;
      information.style.top = `${(innerHeight - height) / 2}px`;
      information.style.width = `${width}px`;
      styles.set(video, { left: `${(innerWidth - width) / 2}px`, top: `${(innerHeight - height) / 2}px`,
        right: 'auto', bottom: 'auto', width: `${width}px`, height: `${height}px`,
        'object-position': '50% 50%', 'aspect-ratio': 'auto' });
      updateCursorShield();
    }
    function setRate(value) {
      const rate = Number(value);
      if (!Number.isFinite(rate) || rate < 0.1 || rate > 16) { status('请输入 0.1–16 之间的倍速。'); $('rate').value = video.playbackRate; return; }
      try {
        video.playbackRate = rate; video.preservesPitch = true;
        if (Math.abs(video.playbackRate - rate) > 0.001) throw new Error('unsupported');
        s.appliedRate = rate; settings.rate = rate; $('rate').value = rate; $('rate-range').value = rate; save();
        status(`${rate}× 倍速${rate < 0.5 || rate > 4 ? ' · 此速度下浏览器可能静音' : ''}`);
      } catch { $('rate').value = video.playbackRate; $('rate-range').value = video.playbackRate; status('Safari 不支持此倍速，请选择较小的数值。'); }
    }
    function bounds() {
      if (video.seekable.length) return [video.seekable.start(0), video.seekable.end(video.seekable.length - 1)];
      if (Number.isFinite(video.duration) && video.duration > 0) return [0, video.duration];
      return null;
    }
    function seekTo(time) {
      const range = bounds(); if (!range) { status('此视频暂不支持跳转，请等待加载。'); return false; }
      try { video.currentTime = clamp(time, range[0], range[1]); update(); return true; } catch { status('当前视频不允许跳转到此位置。'); return false; }
    }
    const seekBy = delta => { if (seekTo(video.currentTime + delta)) status(`${delta < 0 ? '快退' : '快进'} ${Math.abs(delta)} 秒`); };
    // Sites may pause media when the viewer changes its observed visibility.
    // Recover once during entry only; never fight a user's pause or a later site pause.
    let entryRecovery = wasPlaying;
    const entryDeadline = performance.now() + 1000;
    const recoverEntryPlayback = () => {
      if (!entryRecovery || session !== s || performance.now() > entryDeadline ||
          document.hidden || video.ended || !video.paused) return;
      entryRecovery = false;
      video.play().catch(() => { if (session === s) status('网页阻止了继续播放，请点击播放。'); });
    };
    on(video, 'pause', recoverEntryPlayback);
    const toggle = () => { entryRecovery = false; if (video.paused) video.play().catch(() => status('播放被网页阻止，请直接点击视频后重试。')); else video.pause(); };
    function update() {
      $('play').textContent = video.paused ? '▶' : '❚❚'; $('play').setAttribute('aria-label', video.paused ? '播放' : '暂停');
      $('mute').textContent = video.muted ? '静音' : '声音'; $('mute').setAttribute('aria-label', video.muted ? '取消静音' : '静音');
      $('volume').value = video.muted ? 0 : video.volume;
      $('elapsed').textContent = formatTime(video.currentTime); $('duration').textContent = formatTime(video.duration);
      const range = bounds(); $('timeline').disabled = !range; $('back').disabled = !range; $('forward').disabled = !range;
      if (range) { $('timeline').min = range[0]; $('timeline').max = range[1]; $('timeline').value = video.currentTime; }
      $('back').textContent = `−${settings.seekSeconds}秒`; $('forward').textContent = `+${settings.seekSeconds}秒`;
      $('back').setAttribute('aria-label', `快退 ${settings.seekSeconds} 秒`); $('forward').setAttribute('aria-label', `快进 ${settings.seekSeconds} 秒`);
    }
    async function full() {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
        else if (video.requestFullscreen) await video.requestFullscreen();
        else status('当前浏览器不支持此视频全屏。');
      } catch { status('全屏不可用，请先播放视频。'); }
    }
    // Capture before the site's player handlers. An overlay may cover the backdrop,
    // so decide by picture bounds rather than requiring the backdrop to be the target.
    const nativePresentation = () => document.fullscreenElement || video.webkitDisplayingFullscreen ||
      document.pictureInPictureElement === video || video.webkitPresentationMode === 'picture-in-picture';
    // Safari keeps keyboard focus off the page after the extension popover closes,
    // so the first click only hands focus back instead of toggling or exiting.
    const focusHint = root.querySelector('.focus-hint');
    let awaitingFocus = !document.hasFocus();
    focusHint.hidden = !awaitingFocus;
    const focusReady = () => { awaitingFocus = false; focusHint.hidden = true; };
    on(window, 'focus', () => { focusHint.hidden = true; });
    for (const type of ['pointerdown', 'mousedown', 'touchstart']) on(window, type, event => {
      entryRecovery = false;
      if (!nativePresentation() && !event.composedPath().includes(panel)) event.stopImmediatePropagation();
    }, { capture: true });
    on(window, 'keydown', () => { entryRecovery = false; focusReady(); }, { capture: true });
    on(window, 'click', event => {
      if (nativePresentation()) return;
      const path = event.composedPath();
      const firstClick = awaitingFocus; focusReady();
      if (path.includes(panel)) return;
      if (firstClick) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      const rect = video.getBoundingClientRect();
      // X can resize the element after layout(). Its box then includes letterboxing;
      // hit-test the contained picture, not that potentially viewport-sized box.
      const ratio = video.videoWidth > 0 && video.videoHeight > 0 ? video.videoWidth / video.videoHeight : fallbackRatio;
      const pictureWidth = Math.min(rect.width, rect.height * ratio);
      const pictureHeight = pictureWidth / ratio;
      const left = rect.left + (rect.width - pictureWidth) / 2;
      const top = rect.top + (rect.height - pictureHeight) / 2;
      const inside = path.includes(video) && event.clientX >= left && event.clientX < left + pictureWidth &&
        event.clientY >= top && event.clientY < top + pictureHeight;
      event.preventDefault(); event.stopImmediatePropagation();
      if (inside) toggle(); else close();
    }, { capture: true });
    on($('play'), 'click', toggle);
    on($('back'), 'click', () => seekBy(-settings.seekSeconds)); on($('forward'), 'click', () => seekBy(settings.seekSeconds));
    on($('mute'), 'click', () => { video.muted = !video.muted; update(); });
    on($('volume'), 'input', () => { video.volume = Number($('volume').value); video.muted = video.volume === 0; });
    on($('timeline'), 'input', () => seekTo(Number($('timeline').value)));
    on($('rate-range'), 'input', () => setRate($('rate-range').value)); on($('rate'), 'change', () => setRate($('rate').value));
    on($('reset'), 'click', () => setRate(1));
    on($('seek'), 'change', () => {
      const n = Number($('seek').value);
      if (!Number.isFinite(n) || n < 0.1 || n > 600) { $('seek').value = settings.seekSeconds; status('跳转秒数需在 0.1–600 之间。'); return; }
      settings.seekSeconds = n; save(); update(); status(`方向键每次跳转 ${n} 秒`);
    });
    on($('full'), 'click', full);
    const canPiP = typeof video.webkitSetPresentationMode === 'function' || (document.pictureInPictureEnabled && typeof video.requestPictureInPicture === 'function');
    $('pip').hidden = !canPiP;
    on($('pip'), 'click', async () => {
      try {
        if (video.webkitSetPresentationMode) video.webkitSetPresentationMode(video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture');
        else if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await video.requestPictureInPicture();
      } catch { status('画中画不可用，请先播放视频。'); }
    });
    on(window, 'keydown', e => {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || document.fullscreenElement || video.webkitDisplayingFullscreen) return;
      // Page fields sit hidden behind the viewer; only the viewer's own fields keep their keys.
      if (!e.composedPath().includes(host)) host.focus({ preventScroll: true });
      const path = e.composedPath().filter(el => el instanceof Node && root.contains(el));
      if (path.some(el => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))) return;
      if (e.key === 'Tab') {
        if (panel.inert) { e.preventDefault(); return; }
        const focusable = [...root.querySelectorAll('button,input,select,summary')].filter(el => !el.disabled && !el.hidden && el.getClientRects().length);
        const first = focusable[0], last = focusable.at(-1), active = root.activeElement;
        if (e.shiftKey && (!active || active === first)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (!active || active === last)) { e.preventDefault(); first.focus(); }
        return;
      }
      if (path.some(el => el instanceof HTMLElement && /^(BUTTON|SUMMARY)$/.test(el.tagName)) && (e.key === ' ' || e.key === 'Enter')) return;
      const actions = { ArrowLeft: () => seekBy(-settings.seekSeconds), ArrowRight: () => seekBy(settings.seekSeconds),
        j: () => seekBy(-settings.seekSeconds), l: () => seekBy(settings.seekSeconds), ' ': toggle, k: toggle,
        '[': () => setRate(Math.max(.1, Math.round((video.playbackRate - .1) * 100) / 100)),
        ']': () => setRate(Math.min(16, Math.round((video.playbackRate + .1) * 100) / 100)), r: () => setRate(1),
        m: () => { video.muted = !video.muted; update(); }, f: full, Escape: close };
      const action = actions[e.key] || actions[e.key.toLowerCase()];
      if (action) { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat || ['ArrowLeft','ArrowRight','j','l','[',']'].includes(e.key)) action(); }
    }, { capture: true });
    for (const event of ['timeupdate','durationchange','progress','loadedmetadata','play','pause','volumechange','ended']) on(video, event, update);
    on(video, 'ratechange', () => {
      if (root.activeElement !== $('rate')) $('rate').value = video.playbackRate;
      $('rate-range').value = video.playbackRate;
      if (s.appliedRate !== null && Math.abs(video.playbackRate - s.appliedRate) > .001) status('网页播放器更改了倍速，可重新设置。');
    });
    on(video, 'error', () => status('网页视频加载失败，请退出观影并在原网页重试。'));
    on(window, 'resize', layout); on(video, 'loadedmetadata', layout); on(video, 'resize', layout);
    const videoResize = new ResizeObserver(updateCursorShield);
    videoResize.observe(video);
    abort.signal.addEventListener('abort', () => videoResize.disconnect(), { once: true });
    on(document, 'fullscreenchange', updateCursorShield);
    on(video, 'webkitpresentationmodechanged', updateCursorShield);
    s.observer = new MutationObserver(() => { if (!video.isConnected || !host.isConnected) close(); });
    s.observer.observe(document, { childList: true, subtree: true });
    s.timer = setInterval(() => { if (!video.isConnected) close(); }, 1000);
    video.controls = false; $('seek').value = settings.seekSeconds;
    layout(); update(); setRate(settings.rate); relay(true);
    recoverEntryPlayback();
    host.tabIndex = -1; host.focus({ preventScroll: true });
    return { ok: true };
  }
  window.addEventListener('pagehide', () => { close(); restoreFrame(); preparedToken = null; });
  globalThis.smartVideoViewer = { inventory, open, close, cleanSettings, deepQuery, metadata,
    openVideo(video) { inventory(); return open(ids.get(video)); },
    prepare(token) { if (token !== preparedToken) { close(); restoreFrame(); } preparedToken = token; },
    active: () => Boolean(session) };
})();
