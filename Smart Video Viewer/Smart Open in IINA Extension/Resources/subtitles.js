/* Standard text tracks stay attached to the site's original video. */
(() => {
  'use strict';
  function toWebVTT(text) {
    const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    if (/^WEBVTT(?:[ \t\n]|$)/.test(normalized)) return normalized + '\n';
    const timing = /^(\d{2,}:\d{2}:\d{2}),(\d{3})[ \t]+-->[ \t]+(\d{2,}:\d{2}:\d{2}),(\d{3})([^\n]*)$/gm;
    if (!timing.test(normalized)) throw new Error('请选择 UTF-8 编码的 SRT 或 VTT 字幕。');
    timing.lastIndex = 0;
    return 'WEBVTT\n\n' + normalized.replace(timing, '$1.$2 --> $3.$4$5') + '\n';
  }
  function attach(video, select, notify) {
    const originals = new Map();
    const applied = new Map();
    const abort = new AbortController();
    const local = new Map();
    let tracks = [], choice = 'site', disposed = false;
    const eligible = () => [...video.textTracks].filter(t => t.kind === 'subtitles' || t.kind === 'captions');
    const remember = () => { for (const t of eligible()) if (!originals.has(t)) originals.set(t, t.mode); };
    const setMode = (t, mode) => { if (t.mode !== mode) { t.mode = mode; applied.set(t, mode); } };
    function apply() {
      remember();
      for (const t of eligible()) {
        if (choice === 'site') {
          if (applied.has(t) && t.mode === applied.get(t)) t.mode = originals.get(t);
          applied.delete(t);
        } else setMode(t, choice === t ? 'showing' : 'disabled');
      }
    }
    function refresh() {
      if (disposed) return;
      remember();
      tracks = eligible();
      if (choice !== 'site' && choice !== 'off' && !tracks.includes(choice)) { choice = 'site'; apply(); }
      select.replaceChildren();
      const option = (value, label) => {
        const el = document.createElement('option'); el.value = value; el.textContent = label; select.append(el);
      };
      option('site', tracks.length ? '跟随网页' : '未发现字幕');
      option('off', '关闭');
      tracks.forEach((t, i) => option(String(i), t.label || t.language || `字幕 ${i + 1}`));
      select.value = typeof choice === 'string' ? choice : String(tracks.indexOf(choice));
    }
    select.addEventListener('change', () => {
      choice = ['site', 'off'].includes(select.value) ? select.value : tracks[Number(select.value)] || 'site';
      apply();
      notify(choice === 'off' ? '字幕已关闭' : choice === 'site' ? '已恢复网页字幕设置' : '已选择字幕；如未显示，请等待字幕加载。');
    }, { signal: abort.signal });
    video.textTracks.addEventListener('addtrack', () => { apply(); refresh(); }, { signal: abort.signal });
    video.textTracks.addEventListener('removetrack', refresh, { signal: abort.signal });
    // Reflect changing labels without rebuilding a focused native selection menu on every cue.
    video.addEventListener('loadedmetadata', refresh, { signal: abort.signal });
    const onError = event => {
      if (event.target.tagName === 'TRACK') notify('字幕加载失败，请检查原网页字幕或导入本地 SRT / VTT。');
    };
    video.addEventListener('error', onError, { capture: true, signal: abort.signal });
    refresh();
    return {
      async importFile(file) {
        if (!file || disposed) return;
        if (file.size > 5 * 1024 * 1024) throw new Error('字幕文件不能超过 5 MB。');
        if (!/\.(srt|vtt)$/i.test(file.name)) throw new Error('请选择 SRT 或 VTT 字幕文件。');
        const text = toWebVTT(await file.text());
        if (disposed) return;
        const url = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
        const element = document.createElement('track');
        element.kind = 'subtitles'; element.srclang = 'und'; element.label = file.name; element.src = url;
        local.set(element, url);
        video.append(element);
        choice = element.track; apply(); refresh();
        element.addEventListener('load', () => {
          // Loading a new track may cause the browser to reselect an existing default.
          apply(); refresh();
          if (!element.track.cues?.length) notify('字幕文件没有可用的字幕条目。');
          else notify('本地字幕已加载，仅用于本次观影。');
        }, { once: true, signal: abort.signal });
        notify('正在加载本地字幕…');
      },
      dispose() {
        disposed = true; abort.abort();
        for (const [t, mode] of originals) if (applied.has(t) && t.mode === applied.get(t)) t.mode = mode;
        for (const [el, url] of local) { el.remove(); URL.revokeObjectURL(url); }
        local.clear();
      }
    };
  }
  globalThis.smartVideoSubtitles = { attach, toWebVTT };
})();
