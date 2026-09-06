import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {upgrade} from '../src/storage/revisions/local/20260907020000_add_design_sites.js';

test('adding sites preserves engine order and enabled choices on repeated upgrades', async () => {
  let state = {
    engines: ['pinterest', 'google', 'bigbigwork', 'huaban'],
    disabledEngines: ['google']
  };
  globalThis.browser = {
    storage: {
      local: {
        get: async () => structuredClone(state),
        set: async value => Object.assign(state, value)
      }
    }
  };
  try {
    await upgrade();
    assert.deepEqual(state.engines, [
      'pinterest',
      'google',
      'bigbigwork',
      'huaban',
      'cosmos',
      'savee',
      'behance',
      'zcool'
    ]);
    assert.deepEqual(state.disabledEngines, [
      'google',
      'cosmos',
      'savee',
      'behance',
      'zcool'
    ]);
    state.disabledEngines = ['google'];
    await upgrade();
    assert.deepEqual(state.disabledEngines, ['google']);
    assert.equal(new Set(state.engines).size, state.engines.length);
  } finally {
    delete globalThis.browser;
  }
});

function harness({
  engine = 'huaban',
  missing = false,
  success = true,
  type = 'image/png'
} = {}) {
  const source = readFileSync(
    new URL('../src/utils/design-sites.js', import.meta.url),
    'utf8'
  )
    .replace(/^import[\s\S]*?from '[^']+';\n/gm, '')
    .replace(
      /export \{[^}]+\};/,
      'globalThis.searchDesignSite = searchDesignSite; globalThis.designSites = designSites;'
    );
  let now = 0,
    opened = false,
    submitted = false;
  const events = [];
  const control = {
    closest: () => control,
    dispatchEvent: ev => {
      events.push(ev.type);
      opened = true;
    }
  };
  const input = {
    dispatchEvent: ev => {
      assert.equal(events.at(-1), 'receipt');
      events.push(ev.type);
      submitted = true;
    }
  };
  const context = {
    URL,
    Event,
    MouseEvent: Event,
    Date: {now: () => now},
    getText: () => 'upload failed',
    EngineError: class EngineError extends Error {
      name = 'EngineError';
    },
    sleep: async ms => {
      now += ms;
    },
    convertProcessedImage: async () => {
      events.push('convert');
      return {imageType: 'image/png'};
    },
    setFileInputData: async () => {
      events.push('file');
    },
    sendReceipt: async () => {
      events.push('receipt');
    },
    findNode: async selector => {
      if (missing) throw new Error('missing control');
      return selector.includes('input') || selector.startsWith('#')
        ? input
        : control;
    },
    document: {querySelector: () => (opened ? input : null)},
    location: {href: 'https://huaban.com/discovery', pathname: '/discovery'}
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.designSites[engine].result = () => submitted && success;
  return {
    context,
    events,
    run: () =>
      context.searchDesignSite(engine, {
        image: {imageType: type},
        storageIds: ['task', 'image']
      })
  };
}

test('upload hands off bytes and receipt before dispatching change', async () => {
  const h = harness();
  await h.run();
  assert.deepEqual(h.events, ['click', 'file', 'receipt', 'change']);
});
test('Cosmos sends the required mouse-down event before upload', async () => {
  const h = harness({engine: 'cosmos'});
  await h.run();
  assert.deepEqual(h.events.slice(0, 3), ['mousedown', 'mouseup', 'click']);
});
test('unsupported formats are converted before handing off the file', async () => {
  const h = harness({type: 'image/avif'});
  await h.run();
  assert.equal(h.events[0], 'convert');
});
test('missing upload UI produces a useful error without submitting', async () => {
  const h = harness({missing: true});
  await assert.rejects(h.run(), {
    name: 'EngineError',
    message: 'upload failed'
  });
  assert.deepEqual(h.events, []);
});
test('upload without a result eventually reports failure instead of succeeding', async () => {
  const h = harness({success: false});
  await assert.rejects(h.run(), {
    name: 'EngineError',
    message: 'upload failed'
  });
});
