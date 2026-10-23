import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../Smart Open in IINA Extension/Resources/subtitles.js', import.meta.url), 'utf8');
function setup(initial = []) {
  class Tracks extends EventTarget {
    items = initial;
    [Symbol.iterator]() { return this.items[Symbol.iterator](); }
  }
  const list = new Tracks();
  const video = Object.assign(new EventTarget(), { textTracks: list });
  const select = Object.assign(new EventTarget(), { value: '', options: [], replaceChildren() { this.options = []; }, append(o) { this.options.push(o); } });
  const context = vm.createContext({ AbortController, URL, Blob, document: { createElement: () => ({}) } });
  vm.runInContext(code, context);
  const controller = context.smartVideoSubtitles.attach(video, select, () => {});
  const choose = value => { select.value = value; select.dispatchEvent(new Event('change')); };
  return { controller, choose, list, select, toWebVTT: context.smartVideoSubtitles.toWebVTT };
}
test('converts BOM / CRLF SRT without rewriting dialogue punctuation', () => {
  const { toWebVTT } = setup();
  assert.equal(toWebVTT('\uFEFF1\r\n00:00:01,500 --> 00:00:03,000\r\nHello, world\r\n'), 'WEBVTT\n\n1\n00:00:01.500 --> 00:00:03.000\nHello, world\n');
  assert.match(toWebVTT('WEBVTT\n\n00:01.000 --> 00:02.000\nHello'), /^WEBVTT/);
  assert.throws(() => toWebVTT('not a subtitle'));
});
test('keeps site modes initially; selects subtitles without touching metadata', () => {
  const a = { kind: 'subtitles', mode: 'hidden', label: '中文' };
  const b = { kind: 'captions', mode: 'showing', label: 'English' };
  const metadata = { kind: 'metadata', mode: 'hidden' };
  const { choose, controller } = setup([a,b,metadata]);
  assert.equal(a.mode, 'hidden'); assert.equal(b.mode, 'showing');
  choose('0'); assert.equal(a.mode, 'showing'); assert.equal(b.mode, 'disabled'); assert.equal(metadata.mode, 'hidden');
  choose('off'); assert.equal(a.mode, 'disabled');
  controller.dispose(); assert.equal(a.mode, 'hidden'); assert.equal(b.mode, 'showing');
});
test('late tracks respect off and disappearing selection restores site modes', () => {
  const a = { kind: 'subtitles', mode: 'showing' };
  const { choose, list, controller, select } = setup([a]);
  choose('off');
  const b = { kind: 'captions', mode: 'hidden' }; list.items.push(b); list.dispatchEvent(new Event('addtrack'));
  assert.equal(b.mode, 'disabled'); assert.equal(select.options.length, 4);
  choose('1'); list.items.pop(); list.dispatchEvent(new Event('removetrack'));
  assert.equal(select.value, 'site'); assert.equal(a.mode, 'showing'); controller.dispose();
});
test('restoration preserves a subsequent site change', () => {
  const a = { kind: 'subtitles', mode: 'showing' };
  const { choose, controller } = setup([a]);
  choose('off'); a.mode = 'hidden'; controller.dispose(); assert.equal(a.mode, 'hidden');
});
test('rejects oversized or unsupported local files before reading them', async () => {
  const { controller } = setup();
  await assert.rejects(controller.importFile({ name: 'test.vtt', size: 6 * 1024 * 1024 }));
  await assert.rejects(controller.importFile({ name: 'test.html', size: 10 }));
  controller.dispose();
});
