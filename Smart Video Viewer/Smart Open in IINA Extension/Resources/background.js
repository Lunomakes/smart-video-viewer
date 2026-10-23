const mediaByTab = new Map();
const lastStreamByTab = new Map();
const MAX_CANDIDATES = 100;
const STREAM_CACHE_TTL_MS = 30 * 60 * 1000;

const mediaPattern = /\.(?:m3u8|mpd|mp4|m4v|mov|webm|mkv)(?:[?#]|$)/i;
const streamPattern = /\.(?:m3u8|mpd)(?:[?#]|$)/i;
const segmentPattern = /\.(?:ts|m4s|cmfv|cmfa)(?:[?#]|$)/i;
const adPattern = /(?:doubleclick|googlesyndication|googleadservices|imasdk|magsrv|exoclick|popads|adservice|\/ads?\/|[?&](?:ad|ads|advert)=)/i;
const previewPattern = /(?:videos?_screenshots|screenshots?|thumb(?:nail)?s?|preview(?:[-_.]|\/)|\/\d+x\d+\/)/i;

function normalizeUrl(value) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return null;
  try {
    return new URL(value).href;
  } catch {
    return null;
  }
}

function scoreCandidate(candidate, pageUrl) {
  const url = candidate.url;
  let score = 0;

  if (/\.m3u8(?:[?#]|$)/i.test(url)) score += 120;
  else if (/\.mpd(?:[?#]|$)/i.test(url)) score += 115;
  else if (/\.(?:mp4|m4v|mov|webm|mkv)(?:[?#]|$)/i.test(url)) score += 65;

  if (candidate.source === "video-element") score += 45;
  if (candidate.source === "page-resource") score += 25;
  if (candidate.source === "web-request") score += 15;
  if (candidate.currentSrc) score += 25;
  if (candidate.duration >= 120) score += 35;
  else if (candidate.duration >= 30) score += 15;
  if (candidate.area >= 200000) score += 30;
  else if (candidate.area >= 50000) score += 12;
  if (/(?:master|playlist|index|manifest|video|vod)/i.test(url)) score += 12;
  if (/(?:token|expires|signature|policy|key)=/i.test(url)) score += 8;
  if (adPattern.test(url)) score -= 140;
  if (previewPattern.test(url)) score -= 240;

  try {
    if (pageUrl && new URL(url).hostname === new URL(pageUrl).hostname) score += 10;
  } catch {
    // Ignore malformed comparison URLs.
  }

  return score;
}

function remember(tabId, url) {
  if (tabId < 0 || !mediaPattern.test(url) || segmentPattern.test(url) || previewPattern.test(url)) return;
  const normalized = normalizeUrl(url);
  if (!normalized) return;

  const candidates = mediaByTab.get(tabId) ?? [];
  const withoutDuplicate = candidates.filter((item) => item.url !== normalized);
  withoutDuplicate.push({ url: normalized, source: "web-request", seenAt: Date.now() });
  mediaByTab.set(tabId, withoutDuplicate.slice(-MAX_CANDIDATES));
}

function streamExpiry(url) {
  const match = url.match(/(?:[?&/]|^)expires=(\d{9,})(?:[&#/]|$)/i);
  return match ? Number(match[1]) * 1000 : null;
}

function cacheStream(tabId, pageUrl, streamUrl) {
  lastStreamByTab.set(tabId, { pageUrl, streamUrl, savedAt: Date.now(), expiresAt: streamExpiry(streamUrl) });
}

function cachedStream(tabId, pageUrl) {
  const stored = lastStreamByTab.get(tabId);
  if (!stored || stored.pageUrl !== pageUrl) return null;
  if (Date.now() - stored.savedAt > STREAM_CACHE_TTL_MS || (stored.expiresAt && Date.now() >= stored.expiresAt - 5000)) {
    lastStreamByTab.delete(tabId);
    return null;
  }
  return normalizeUrl(stored.streamUrl);
}

// Migrate old versions away from persisting signed media URLs. No URL is logged.
browser.runtime.onInstalled.addListener(async () => {
  const values = await browser.storage.local.get(null);
  const keys = Object.keys(values).filter(key => key.startsWith('last-stream-v2-'));
  if (keys.length) await browser.storage.local.remove(keys);
});

browser.webRequest.onBeforeRequest.addListener(
  (details) => remember(details.tabId, details.url),
  { urls: ["<all_urls>"] }
);

browser.tabs.onRemoved.addListener((tabId) => {
  mediaByTab.delete(tabId);
  lastStreamByTab.delete(tabId);

});
browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" || changeInfo.url) { mediaByTab.delete(tabId); lastStreamByTab.delete(tabId); }
});

async function bounded(promise, milliseconds = 2000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Browser request timed out')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

async function frameIdsForTab(tabId) {
  try {
    const frames = await bounded(browser.webNavigation.getAllFrames({ tabId }));
    return [...new Set([0, ...frames.map((frame) => frame.frameId)])];
  } catch {
    return [0];
  }
}

async function sendToFrame(tabId, frameId, message) {
  try {
    let timer;
    try {
      return await Promise.race([
        browser.tabs.sendMessage(tabId, message, { frameId }),
        new Promise(resolve => { timer = setTimeout(() => resolve(null), 2000); })
      ]);
    } finally { clearTimeout(timer); }
  } catch {
    return null;
  }
}

async function collectFromPage(tabId, fallbackPageUrl) {
  const frameIds = await frameIdsForTab(tabId);
  const responses = await Promise.all(
    frameIds.map((frameId) => sendToFrame(tabId, frameId, { type: "collect-media" }))
  );
  const candidates = responses.flatMap((response) => (
    response && Array.isArray(response.candidates) ? response.candidates : []
  ));
  const topFrameResponse = responses[frameIds.indexOf(0)];
  return {
    pageUrl: topFrameResponse?.pageUrl ?? fallbackPageUrl,
    candidates
  };
}

async function pauseMedia(tabId) {
  const frameIds = await frameIdsForTab(tabId);
  await Promise.all(
    frameIds.map((frameId) => sendToFrame(tabId, frameId, { type: "pause-media" }))
  );
}

async function pauseAndOpen(tabId, url) {
  await openExternal(tabId, url);
  await pauseMedia(tabId);
}

async function openExternal(tabId, url) {
  try {
    const response = await Promise.race([
      browser.runtime.sendNativeMessage("com.local.smartopeniniina", {
        action: "open-in-iina",
        url
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Native open timed out")), 3000))
    ]);
    if (response?.ok) return;
  } catch {
    // Fall back to the URL scheme when native messaging is unavailable.
  }

  const mediaUrl = url.replace(/,/g, "%2C");
  const iinaUrl = `iina://open?url=${encodeURIComponent(mediaUrl)}`;
  try {
    await browser.tabs.update(tabId, { url: iinaUrl });
  } catch {
    await browser.tabs.sendMessage(tabId, { type: "open-iina", url: iinaUrl });
  }
}

async function openInIINA(tab) {
  if (tab.id === undefined) return { ok: false, error: '无法取得当前标签页。' };
  let best = null;
  let pageUrl = tab.url;
  // Prefer current page evidence; a previous signed URL may already be invalid.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const page = await collectFromPage(tab.id, pageUrl);
    pageUrl = page.pageUrl ?? pageUrl;
    const observed = mediaByTab.get(tab.id) ?? [];
    const combined = [...page.candidates, ...observed]
      .map(candidate => ({ ...candidate, url: normalizeUrl(candidate.url) }))
      .filter(candidate => candidate.url && (mediaPattern.test(candidate.url) || candidate.source === "video-element")
        && !segmentPattern.test(candidate.url) && !previewPattern.test(candidate.url));
    // Preserve the strongest metadata when the network and video element share a URL.
    const unique = new Map();
    for (const candidate of combined) {
      if (!unique.has(candidate.url) || scoreCandidate(candidate, pageUrl) > scoreCandidate(unique.get(candidate.url), pageUrl)) unique.set(candidate.url, candidate);
    }
    const ranked = [...unique.values()].sort((a, b) => scoreCandidate(b, pageUrl) - scoreCandidate(a, pageUrl));
    if (ranked[0] && scoreCandidate(ranked[0], pageUrl) >= (attempt < 2 ? 100 : 1)) { best = ranked[0]; break; }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500));
  }
  const url = best?.url || cachedStream(tab.id, pageUrl);
  if (!url) return { ok: false, error: '未找到可交给 IINA 的直链。请先播放视频，或使用独立观影。' };
  await pauseAndOpen(tab.id, url);
  cacheStream(tab.id, pageUrl, url);
  return { ok: true, message: '已请求 IINA 打开；需要登录授权的视频仍可能无法在外部播放。' };
}

async function discoverVideos(tabId) {
  const frames = await frameIdsForTab(tabId);
  const responses = await Promise.all(frames.map(async frameId => {
    const response = await sendToFrame(tabId, frameId, { type: 'viewer-inventory' });
    return { frameId, response };
  }));
  return {
    ok: true,
    reachable: responses.some(item => item.response),
    active: responses.some(item => item.response?.active),
    videos: responses.flatMap(({ frameId, response }) => (response?.videos || []).map(video => ({ ...video, frameId })))
      .sort((a, b) => b.score - a.score)
  };
}

const pendingTabs = new Set();
browser.runtime.onMessage.addListener((message, sender) => {
  const types = ['discover-videos', 'open-viewer', 'close-viewer', 'open-in-iina'];
  if (!types.includes(message?.type)) return undefined;
  return (async () => {
    // Content scripts may request cleanup only. Opening IINA is a popup action.
    if (sender.tab && message.type !== 'close-viewer') return { ok: false, error: '请从扩展菜单操作。' };
    const tab = sender.tab || (await bounded(browser.tabs.query({ active: true, currentWindow: true })))[0];
    if (tab?.id === undefined) return { ok: false, error: '无法取得当前标签页。' };
    if (message.type === 'discover-videos') return discoverVideos(tab.id);
    if (pendingTabs.has(tab.id)) return { ok: false, error: '上一次操作尚未完成，请稍后重试。' };
    pendingTabs.add(tab.id);
    try {
      if (message.type === 'open-in-iina') return await openInIINA(tab);
      const frames = await frameIdsForTab(tab.id);
      if (message.type === 'close-viewer') {
        await Promise.all(frames.map(frameId => sendToFrame(tab.id, frameId, { type: 'viewer-close' })));
        return { ok: true };
      }
      const found = await discoverVideos(tab.id);
      const chosen = message.video ? found.videos.find(v => v.id === message.video.id && v.frameId === message.video.frameId) : found.videos[0];
      if (!chosen) return { ok: false, error: found.reachable ? '未检测到视频，请先在网页播放，再重新检测。' : '无法访问网页。请允许扩展访问此网站，并刷新网页。Safari 内部页面无法使用。' };
      const token = crypto.randomUUID();
      await Promise.all(frames.map(frameId => sendToFrame(tab.id, frameId, { type: 'viewer-prepare', token })));
      const metadata = chosen.frameId !== 0 && found.videos.length === 1
        ? await sendToFrame(tab.id, 0, { type: 'viewer-metadata' }) : null;
      const result = await sendToFrame(tab.id, chosen.frameId, { type: 'viewer-open', id: chosen.id, token, metadata });
      if (!result?.ok) await Promise.all(frames.map(frameId => sendToFrame(tab.id, frameId, { type: 'viewer-close' })));
      return result || { ok: false, error: '视频所在页面已变化，请刷新网页后重试。' };
    } finally { pendingTabs.delete(tab.id); }
  })().catch(() => ({ ok: false, error: '操作未完成。请检查网站访问权限、刷新网页，然后重试。' }));
});
