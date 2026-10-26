// Shared by the popup and background. The popup talks to pages directly because
// Safari's service worker can fail to wake, which left detection unanswered.
async function bounded(promise, milliseconds = 2000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Browser request timed out')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

async function activeTab() {
  return (await bounded(browser.tabs.query({ active: true, currentWindow: true })))[0];
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

async function closeViewer(tabId) {
  const frames = await frameIdsForTab(tabId);
  await Promise.all(frames.map(frameId => sendToFrame(tabId, frameId, { type: 'viewer-close' })));
  return { ok: true };
}

async function openViewer(tabId, video) {
  const frames = await frameIdsForTab(tabId);
  const found = await discoverVideos(tabId);
  const chosen = video ? found.videos.find(v => v.id === video.id && v.frameId === video.frameId) : found.videos[0];
  if (!chosen) return { ok: false, error: found.reachable ? '未检测到视频，请先在网页播放，再重新检测。' : '无法访问网页。请允许扩展访问此网站，并刷新网页。Safari 内部页面无法使用。' };
  const token = crypto.randomUUID();
  await Promise.all(frames.map(frameId => sendToFrame(tabId, frameId, { type: 'viewer-prepare', token })));
  const metadata = chosen.frameId !== 0 && found.videos.length === 1
    ? await sendToFrame(tabId, 0, { type: 'viewer-metadata' }) : null;
  const result = await sendToFrame(tabId, chosen.frameId, { type: 'viewer-open', id: chosen.id, token, metadata });
  if (!result?.ok) await Promise.all(frames.map(frameId => sendToFrame(tabId, frameId, { type: 'viewer-close' })));
  return result || { ok: false, error: '视频所在页面已变化，请刷新网页后重试。' };
}
