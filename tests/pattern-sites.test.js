import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {
  upgrade,
  revision
} from '../src/storage/revisions/local/20260907030000_add_pattern_sites.js';

test('new migration is registered and preserves existing user selections', async () => {
  const config = JSON.parse(
    readFileSync(new URL('../src/storage/config.json', import.meta.url))
  );
  assert.equal(config.revisions.local.at(-1), revision);
  const state = {engines: ['googleLens', 'patternbank'], disabledEngines: []};
  globalThis.browser = {
    storage: {
      local: {
        get: async () => structuredClone(state),
        set: async x => Object.assign(state, x)
      }
    }
  };
  try {
    await upgrade();
    assert.deepEqual(state.engines, [
      'googleLens',
      'patternbank',
      'sameenergy',
      'spoonflower'
    ]);
    assert.deepEqual(state.disabledEngines, ['sameenergy', 'spoonflower']);
    state.disabledEngines = [];
    await upgrade();
    assert.deepEqual(state.disabledEngines, []);
    assert.equal(state.engines.length, 4);
  } finally {
    delete globalThis.browser;
  }
});

function load(extra = {}) {
  const source = readFileSync(
    new URL('../src/utils/design-sites.js', import.meta.url),
    'utf8'
  )
    .replace(/^import[\s\S]*?from '[^']+';\n/gm, '')
    .replace(
      /export \{[^}]+\};/,
      'globalThis.sites = designSites; globalThis.finish = finishSpoonflower;'
    );
  const context = vm.createContext({URL, ...extra});
  vm.runInContext(source, context);
  return context;
}

test('new sites reject landing pages and require their own result parameters', () => {
  const cases = {
    patternbank: [
      'https://patternbank.com/visual-search/results?vs=test',
      'https://patternbank.com/'
    ],
    sameenergy: [
      'https://same.energy/search?i=test',
      'https://same.energy/search'
    ],
    spoonflower: [
      'https://www.spoonflower.com/en/shop-by-image/123abc?on=fabric',
      'https://www.spoonflower.com/en/shop-by-image/upload?on=fabric'
    ]
  };
  for (const [id, urls] of Object.entries(cases)) {
    const context = load();
    for (const [index, url] of urls.entries()) {
      context.location = new URL(url);
      assert.equal(context.sites[id].result(), index === 0);
    }
  }
});

test('Spoonflower waits for crop and selected fabric before final submission', async () => {
  const events = [];
  const context = load({
    findNode: async selector => {
      events.push(selector);
      return {click: () => events.push('click')};
    }
  });
  await context.finish();
  assert.match(events[0], /ReactCrop/);
  assert.match(events[1], /PrimaryButton/);
  assert.equal(events[2], 'click');
  assert.match(events[3], /fabric/);
  assert.equal(events[4], 'click');
  assert.match(events[5], /Selected/);
  assert.match(events[6], /PrimaryButton/);
  assert.equal(events[7], 'click');
});

test('Spoonflower stops if fabric cannot be selected, instead of submitting wallpaper', async () => {
  let clicks = 0;
  const context = load({
    findNode: async selector => {
      if (selector.includes('fabric')) throw new Error('missing fabric');
      return {click: () => clicks++};
    }
  });
  await assert.rejects(context.finish(), /missing fabric/);
  assert.equal(clicks, 1);
});
