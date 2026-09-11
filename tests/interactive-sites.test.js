import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function load(query) {
  let time = 0;
  const source = readFileSync(new URL('../src/utils/interactive-sites.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace(/export \{[^}]+\};/, 'globalThis.api = {openUpload, findVisible, resultsVisible};');
  const ctx = vm.createContext({
    URL, MouseEvent: class { constructor(type, init) { this.type = type; Object.assign(this, init); } }, window: {}, Date: {now: () => time}, sleep: async ms => {time += ms;},
    document: {querySelectorAll: query},
    getComputedStyle: () => ({visibility: 'visible'})
  });
  vm.runInContext(source, ctx);
  return ctx;
}
const node = extra => ({isConnected: true, getClientRects: () => [1], ...extra});

test('hidden duplicate uploads are skipped in favor of the visible label', () => {
  const hidden = node({getClientRects: () => []});
  const label = node({});
  const a = node({closest: () => hidden});
  const b = node({closest: () => label});
  const c = load(() => [a, b]);
  assert.equal(c.api.findVisible('input', {input: true}), b);
});

test('Cosmos retries an unready click, stops once open, and does not toggle it closed', async () => {
  let clicks = 0;
  const input = node({closest: () => node({})});
  const button = node({dispatchEvent: ev => { assert.equal(ev.type, 'mousedown'); assert.equal(ev.cancelable, true); clicks++; }});
  const c = load(selector => selector.includes('file-upload') ? (clicks >= 2 ? [input] : []) : [button]);
  assert.equal(await c.api.openUpload('cosmos'), input);
  assert.equal(clicks, 2);
  assert.equal(await c.api.openUpload('cosmos'), input);
  assert.equal(clicks, 2);
});

test('missing panel stops after three clicks without uploading', async () => {
  let clicks = 0;
  const c = load(selector => selector.includes('file-upload') ? [] : [node({dispatchEvent: ev => { assert.equal(ev.type, 'mousedown'); assert.equal(ev.cancelable, true); clicks++; }})]);
  await assert.rejects(c.api.openUpload('cosmos'), /上传面板未打开/);
  assert.equal(clicks, 3);
});

test('result URL without rendered cards is not success; old results are not reused', () => {
  let cards = [];
  const c = load(() => cards);
  c.location = new URL('https://www.cosmos.so/search/elements?image=new');
  assert.equal(c.api.resultsVisible('cosmos', 'https://www.cosmos.so/'), false);
  cards = [node({})];
  assert.equal(c.api.resultsVisible('cosmos', 'https://www.cosmos.so/'), true);
  assert.equal(c.api.resultsVisible('cosmos', c.location.href), false);
});
