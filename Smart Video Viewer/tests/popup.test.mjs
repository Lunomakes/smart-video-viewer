import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const resource = name => readFileSync(new URL(`../Smart Open in IINA Extension/Resources/${name}`, import.meta.url), 'utf8');

test('detection works when the background worker and storage never answer', async () => {
  const elements = {};
  const element = id => elements[id] ??= { disabled: false, hidden: false, value: '1', textContent: '', options: [],
    replaceChildren() { this.options = []; }, add(option) { this.options.push(option); }, addEventListener() {} };
  const never = () => new Promise(() => {});
  const browser = {
    runtime: { sendMessage: never },
    storage: { local: { get: never, set: never } },
    tabs: { query: async () => [{ id: 9 }],
      sendMessage: async (_id, message) => message.type === 'viewer-inventory' ? { videos: [{ id: 'v', score: 1, playing: true }], active: false } : null },
    webNavigation: { getAllFrames: async () => [{ frameId: 0 }] }
  };
  const ctx = vm.createContext({ browser, document: { getElementById: element }, Option: class { constructor(text, value) { Object.assign(this, { text, value }); } },
    setTimeout, clearTimeout, window: { close() {} } });
  vm.runInContext(resource('tab-actions.js') + '\n' + resource('popup.js'), ctx);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.match(elements.status.textContent, /找到 1 个视频/);
  assert.equal(elements.viewer.disabled, false);
});
