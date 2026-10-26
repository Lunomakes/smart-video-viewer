'use strict';
const $ = id => document.getElementById(id);
let videos = [];
let busy = false;
const status = message => { $('status').textContent = message; };
function lock(value) {
  busy = value;
  for (const id of ['viewer','exit','iina','refresh','videos','rate','seek']) $(id).disabled = value;
  if (!value) { $('viewer').disabled = !videos.length; $('videos').disabled = !videos.length; }
}
async function withTimeout(promise, error) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), 12000); })]);
  } catch { return { ok: false, error }; }
  finally { clearTimeout(timer); }
}
// Page actions run here directly; only IINA needs the background (captured requests and native messaging).
async function onActiveTab(action) {
  return withTimeout((async () => {
    const tab = await activeTab();
    return tab?.id === undefined ? { ok: false, error: '无法取得当前标签页。' } : action(tab.id);
  })(), '网页未响应。请刷新网页后重新检测。');
}
const request = (type, extra = {}) => withTimeout(browser.runtime.sendMessage({ type, ...extra }), '扩展后台未响应。请在 Safari 扩展设置中关闭再启用此扩展，刷新网页后重试。');
async function refresh() {
  lock(true); status('正在检测当前网页…');
  const result = await onActiveTab(discoverVideos); videos = result?.videos || [];
  $('videos').replaceChildren();
  if (!videos.length) $('videos').add(new Option('尚未找到视频', ''));
  videos.forEach((v, i) => $('videos').add(new Option(`视频 ${i + 1}${v.playing ? ' · 正在播放' : ''}${v.duration ? ` · ${Math.round(v.duration / 60)} 分钟` : ''}${v.frameId ? ' · 嵌入播放器' : ''}`, String(i))));
  $('exit').hidden = !result?.active;
  status(!result?.ok ? result?.error || '检测失败，请重试。' : videos.length ? `找到 ${videos.length} 个视频。观影会保留网页原本的播放进度。` : result.reachable ? '请先在网页播放视频，再点“重新检测”。' : '请允许扩展访问此网站，并刷新网页。Safari 内部页面无法使用。');
  lock(false);
}
async function save() {
  const rate = Number($('rate').value), seekSeconds = Number($('seek').value);
  if (!Number.isFinite(rate) || rate < .1 || rate > 16 || !Number.isFinite(seekSeconds) || seekSeconds < .1 || seekSeconds > 600) {
    status('倍速需为 0.1–16，跳转秒数需为 0.1–600。'); return false;
  }
  try { await browser.storage.local.set({ viewerSettings: { rate, seekSeconds } }); return true; }
  catch { status('设置未能保存，请重试。'); return false; }
}
$('viewer').addEventListener('click', async () => {
  if (busy || !videos.length) return;
  lock(true);
  if (!await save()) { lock(false); return; }
  status('正在进入独立观影…');
  const result = await onActiveTab(tabId => openViewer(tabId, videos[Number($('videos').value)]));
  if (result?.ok) window.close(); else status(result?.error || '打开失败，请重新检测。');
  lock(false);
});
$('exit').addEventListener('click', async () => { lock(true); const result = await onActiveTab(closeViewer); if (result?.ok) window.close(); else status(result?.error || '退出失败。'); lock(false); });
$('iina').addEventListener('click', async () => { lock(true); status('正在查找可播放直链…'); const result = await request('open-in-iina'); status(result?.ok ? result.message : result?.error || '打开失败。'); lock(false); });
$('refresh').addEventListener('click', refresh);
for (const id of ['rate','seek']) $(id).addEventListener('change', async () => { if (await save()) status('已保存，下次进入独立观影时生效。'); });
// Detection must not wait on storage: a stalled storage.local.get left the popup stuck on “正在检测…”.
refresh();
(async () => {
  try {
    const { viewerSettings: s } = await browser.storage.local.get('viewerSettings');
    if (s) { $('rate').value = Number.isFinite(s.rate) && s.rate >= .1 && s.rate <= 16 ? s.rate : 1; $('seek').value = Number.isFinite(s.seekSeconds) && s.seekSeconds >= .1 && s.seekSeconds <= 600 ? s.seekSeconds : 5; }
  } catch { status('无法读取设置，使用默认值。'); }
})();
