import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {difference, includes, without} from 'lodash-es';

const siteIds = [
  'googleLens',
  'pinterest',
  'bigbigwork',
  'huaban',
  'cosmos',
  'savee',
  'behance',
  'zcool'
];
const localSites = siteIds.slice(2);
const read = path =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));

function sessionHarness() {
  const options = {
    engines: [...siteIds],
    disabledEngines: [],
    searchModeAction: 'browse',
    searchModeContextMenu: 'selectUrl',
    bypassImageHostBlocking: true
  };
  const context = vm.createContext({
    difference,
    includes,
    without,
    browser: {runtime: {getURL: path => 'https://test.invalid' + path}},
    storage: {get: async () => structuredClone(options)}
  });
  vm.runInContext(
    read('src/utils/data.js').replace(/export \{[\s\S]*?\};/, ''),
    context
  );
  vm.runInContext(
    read('src/utils/app.js')
      .replace(/^import[\s\S]*?from '[^']+';\n/gm, '')
      .replace(/export \{[\s\S]*?\};/, ''),
    context
  );
  const ui = read('src/options/App.vue');
  const methods = ui.slice(
    ui.indexOf('    engineEnabled: function'),
    ui.indexOf('    showContribute: async function')
  );
  vm.runInContext('globalThis.optionMethods = {' + methods + '}', context);
  return {context, options};
}

test('every design site can be toggled with the real option method and selected in an all-engine session', async () => {
  const {context: c, options} = sessionHarness();
  for (const engine of siteIds) {
    await c.optionMethods.setEngineState.call({options}, engine, false);
    const disabled = await c.createSession({
      engine: 'allEngines',
      sessionType: 'search',
      sessionOrigin: 'action'
    });
    assert.deepEqual(
      plain(disabled.engines),
      siteIds.filter(id => id !== engine)
    );
    await c.optionMethods.setEngineState.call({options}, engine, true);
    const enabled = await c.createSession({
      engine: 'allEngines',
      sessionType: 'search',
      sessionOrigin: 'action'
    });
    assert.deepEqual(plain(enabled.engines), siteIds);
    assert.equal(enabled.searchMode, 'browse');
  }
});

test('an empty selection creates no search tasks; individual selection targets only that site', async () => {
  const {context: c, options} = sessionHarness();
  options.disabledEngines = [...siteIds];
  const all = await c.createSession({engine: 'allEngines'});
  assert.deepEqual(
    plain(
      await c.getSearches(
        {imageType: 'image/png', imageDataUrl: 'data:image/png;base64,'},
        all.engines,
        'browse'
      )
    ),
    []
  );
  for (const engine of siteIds) {
    const single = await c.createSession({engine});
    assert.deepEqual(plain(single.engines), [engine]);
  }
});

test('local image and screenshot modes create exactly one upload task for every selected site', async () => {
  const {context: c} = sessionHarness();
  for (const mode of ['browse', 'capture', 'selectImage']) {
    const tasks = await c.getSearches(
      {imageType: 'image/png', imageDataUrl: 'data:image/png;base64,'},
      siteIds,
      mode
    );
    assert.deepEqual(plain(tasks.map(t => t.engine)), siteIds);
    for (const task of tasks) {
      assert.equal(task.assetType, 'image');
      assert.equal(task.sendsReceipt, true);
    }
  }
});

test('six added sites require file upload for URL images and conversion for WebP, GIF and AVIF', async () => {
  const {context: c} = sessionHarness();
  for (const type of [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/avif'
  ]) {
    const tasks = await c.getSearches(
      {imageType: type, imageUrl: 'https://test.invalid/picture'},
      localSites,
      'selectUrl'
    );
    for (const task of tasks) {
      assert.equal(task.assetType, 'image');
      assert.equal(task.isExec, true);
      assert.equal(
        task.isAltImage,
        !['image/png', 'image/jpeg'].includes(type)
      );
    }
  }
});

test('every site has a usable upload limit and original Lens/Pinterest limits remain available', () => {
  const {context: c} = sessionHarness();
  for (const engine of siteIds)
    assert.ok(c.getMaxImageUploadSize(engine) > 0, engine);
  assert.equal(c.getMaxImageUploadSize('bigbigwork'), 3 * 1024 * 1024);
  for (const engine of localSites.slice(1))
    assert.equal(c.getMaxImageUploadSize(engine), 10 * 1024 * 1024);
});
