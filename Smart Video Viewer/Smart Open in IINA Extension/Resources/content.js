const directMediaPattern = /\.(?:m3u8|mpd|mp4|m4v|mov|webm|mkv)(?:[?#]|$)/i;
const segmentPattern = /\.(?:ts|m4s|cmfv|cmfa)(?:[?#]|$)/i;

function addCandidate(target, value, metadata = {}) {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return;
  if ((!directMediaPattern.test(value) && metadata.source !== "video-element") || segmentPattern.test(value)) return;
  try {
    target.push({ url: new URL(value, location.href).href, ...metadata });
  } catch {
    // Ignore malformed media URLs.
  }
}

const queryMedia = selector => globalThis.smartVideoViewer?.deepQuery(selector) || [...document.querySelectorAll(selector)];

function collectMedia() {
  const candidates = [];

  for (const video of queryMedia("video")) {
    const rect = video.getBoundingClientRect();
    const metadata = {
      source: "video-element",
      currentSrc: Boolean(video.currentSrc),
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      area: Math.max(0, rect.width * rect.height)
    };
    addCandidate(candidates, video.currentSrc, metadata);
    addCandidate(candidates, video.src, metadata);
    for (const source of video.querySelectorAll("source")) addCandidate(candidates, source.src, metadata);
  }

  for (const entry of performance.getEntriesByType("resource")) {
    addCandidate(candidates, entry.name, { source: "page-resource" });
  }

  for (const element of queryMedia("a[href], source[src]")) {
    addCandidate(candidates, element.href || element.src, { source: "page-link" });
  }

  return {
    pageUrl: location.href,
    candidates: [...new Map(candidates.map((candidate) => [candidate.url, candidate])).values()]
  };
}

browser.runtime.onMessage.addListener((message) => {
  if (message?.type === "collect-media") return Promise.resolve(collectMedia());
  if (message?.type === "pause-media") {
    let pausedCount = 0;
    for (const media of queryMedia("video, audio")) {
      if (!media.paused) {
        media.pause();
        pausedCount += 1;
      }
    }
    return Promise.resolve({ pausedCount });
  }
  if (message?.type === "open-iina" && typeof message.url === "string") {
    location.assign(message.url);
  }
  return undefined;
});

browser.runtime.onMessage.addListener((message) => {
  const viewer = globalThis.smartVideoViewer;
  if (!viewer) return undefined;
  if (message?.type === 'viewer-inventory') return Promise.resolve({ videos: viewer.inventory(), active: viewer.active() });
  if (message?.type === 'viewer-prepare') { viewer.prepare(message.token); return Promise.resolve({ ok: true }); }
  if (message?.type === 'viewer-open') return viewer.open(message.id, message.token);
  if (message?.type === 'viewer-close') { viewer.close(); return Promise.resolve({ ok: true }); }
  return undefined;
});
