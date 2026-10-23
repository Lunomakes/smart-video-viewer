import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
const source = readFileSync(new URL('../Smart Open in IINA Extension/Resources/background.js', import.meta.url), 'utf8');
function fixture() {
  const events = {}, calls = [], saved = { viewerSettings: { rate: 1.5 }, 'last-stream-v2-9': { streamUrl: 'https://example.test/legacy' }, unrelated: true };
  const event = key => ({ addListener: fn => events[key] = fn });
  const tab = { id: 9, url: 'https://example.test/watch' };
  const browser = {
    runtime: { onInstalled: event('installed'), onMessage: event('message'), sendNativeMessage: async (_host, message) => { calls.push(['native',message]); return { ok: true }; } },
    storage: { local: { get: async () => saved, set: async value => { calls.push(['storage', value]); Object.assign(saved,value); }, remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete saved[key]; } } },
    webRequest: { onBeforeRequest: event('request') },
    tabs: { onRemoved: event('removed'), onUpdated: event('updated'), query: async () => [tab], update: async () => {},
      sendMessage: async (_id, message, options) => {
        calls.push(['frame',options.frameId,message]);
        if (message.type === 'viewer-inventory') return { videos: [{id:'v',score:200,duration:180}],active:false };
        if (message.type === 'viewer-open') return { ok:true };
        if (message.type === 'collect-media') return { pageUrl:tab.url,candidates:[{url:'https://example.test/video',source:'video-element',currentSrc:true,area:900000,duration:300}] };
        return {ok:true};
      } },
    webNavigation: { getAllFrames: async () => [{ frameId:0 },{frameId:2}] }
  };
  const ctx = vm.createContext({browser,URL,Map,Set,Date,Promise,setTimeout,clearTimeout,crypto:webcrypto});
  vm.runInContext(source + '\nglobalThis.api = {cacheStream,cachedStream,scoreCandidate,normalizeUrl,frameIdsForTab,mediaByTab};', ctx);
  return {api:ctx.api,events,calls,saved,browser,tab};
}
test('cache uses memory only and respects page identity', () => {
  const f=fixture(); f.api.cacheStream(9,f.tab.url,'https://example.test/index.m3u8');
  assert.equal(f.api.cachedStream(9,f.tab.url),'https://example.test/index.m3u8');
  assert.equal(f.api.cachedStream(9,'https://example.test/other'),null);
  assert.equal(f.calls.length,0);
});
test('expired signed streams are rejected', () => {
  const f=fixture(); f.api.cacheStream(9,f.tab.url,'https://example.test/index.m3u8?expires=1000000000');
  assert.equal(f.api.cachedStream(9,f.tab.url),null);
});
test('extension update migrates only legacy stream keys', async () => {
  const f=fixture(); await f.events.installed();
  assert.deepEqual(Object.keys(f.saved).sort(),['unrelated','viewerSettings']);
});
test('navigation invalidates captured and cached streams', () => {
  const f=fixture(); f.events.request({tabId:9,url:'https://example.test/master.m3u8'});
  f.api.cacheStream(9,f.tab.url,'https://example.test/master.m3u8'); f.events.updated(9,{status:'loading'});
  assert.equal(f.api.cachedStream(9,f.tab.url),null); assert.equal(f.api.mediaByTab.has(9),false);
});
test('invalid schemes rejected and ads ranked below primary media', () => {
  const f=fixture(); assert.equal(f.api.normalizeUrl('javascript:alert(1)'),null);
  assert.ok(f.api.scoreCandidate({url:'https://example.test/main.mp4',source:'video-element',duration:300,area:500000},f.tab.url) > f.api.scoreCandidate({url:'https://example.test/ads/master.m3u8'},f.tab.url));
});
test('extensionless current media is accepted and page pauses after launch', async () => {
  const f=fixture(); const result=await f.events.message({type:'open-in-iina'},{});
  assert.equal(result.ok,true);
  const nativeIndex=f.calls.findIndex(c=>c[0]==='native');
  const pauseIndex=f.calls.findIndex(c=>c[0]==='frame'&&c[2].type==='pause-media');
  assert.ok(nativeIndex>=0&&pauseIndex>nativeIndex); assert.equal(f.calls[nativeIndex][1].url,'https://example.test/video');
});
test('viewer selection targets requested iframe after preparing all frames', async () => {
  const f=fixture(); const result=await f.events.message({type:'open-viewer',video:{id:'v',frameId:2}},{});
  assert.equal(result.ok,true);
  assert.equal(f.calls.filter(c=>c[0]==='frame'&&c[2].type==='viewer-prepare').length,2);
  assert.equal(f.calls.find(c=>c[0]==='frame'&&c[2].type==='viewer-open')[1],2);
});
test('content scripts cannot request external launch', async () => {
  const f=fixture(); const result=await f.events.message({type:'open-in-iina'},{tab:f.tab});
  assert.equal(result.ok,false); assert.equal(f.calls.length,0);
});
test('no accessible frame gives an actionable permission error', async () => {
  const f=fixture(); f.browser.tabs.sendMessage=async()=>{throw Error('no permission');};
  const result=await f.events.message({type:'open-viewer'},{});
  assert.equal(result.ok,false); assert.match(result.error,/允许扩展访问/);
});
test('frame enumeration timeout falls back to main frame instead of hanging discovery', async () => {
  const f=fixture(); f.browser.webNavigation.getAllFrames=()=>new Promise(()=>{});
  const result=await f.events.message({type:'discover-videos'},{});
  assert.equal(result.ok,true); assert.equal(result.videos.length,1);
  assert.equal(result.videos[0].frameId,0);
});
test('active tab lookup timeout returns an error instead of hanging the popup', async () => {
  const f=fixture(); f.browser.tabs.query=()=>new Promise(()=>{});
  const result=await f.events.message({type:'discover-videos'},{});
  assert.equal(result.ok,false); assert.match(result.error,/操作未完成/);
});

test('sole iframe video receives explicit top page metadata', async () => {
  const f = fixture();
  const send = f.browser.tabs.sendMessage;
  f.browser.tabs.sendMessage = async (id, message, options) => {
    if (message.type === 'viewer-inventory' && options.frameId === 0) return {videos:[]};
    if (message.type === 'viewer-metadata') return {title:'Example title', actors:['Example actor']};
    return send(id, message, options);
  };
  const result = await f.events.message({type:'open-viewer'}, {});
  assert.equal(result.ok, true);
  const opened = f.calls.find(c => c[0] === 'frame' && c[2].type === 'viewer-open');
  assert.equal(opened[2].metadata.title, 'Example title');
});
