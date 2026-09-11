import test from 'node:test';
import assert from 'node:assert/strict';
import {getScriptFunction} from '../src/utils/scripts.js';
import {upgrade} from '../src/storage/revisions/local/20260907010000_add_bigbigwork.js';

test('upgrade preserves existing selections and does not re-disable a chosen engine', async () => {
  let state = {engines: ['google', 'pinterest'], disabledEngines: ['google']};
  globalThis.browser = {
    storage: {
      local: {
        get: async () => structuredClone(state),
        set: async values => Object.assign(state, values)
      }
    }
  };
  try {
    await upgrade();
    assert.deepEqual(state.engines, ['google', 'pinterest', 'bigbigwork']);
    assert.deepEqual(state.disabledEngines, ['google', 'bigbigwork']);
    state.disabledEngines = ['google'];
    await upgrade();
    assert.deepEqual(state.engines, ['google', 'pinterest', 'bigbigwork']);
    assert.deepEqual(state.disabledEngines, ['google']);
  } finally {
    delete globalThis.browser;
  }
});

test('result capture leaves other links alone and restores window.open', () => {
  const opened = [];
  const originalOpen = (...args) => {
    opened.push(args);
    return 'other-window';
  };
  const timers = new Map();
  globalThis.document = new EventTarget();
  globalThis.window = {
    open: originalOpen,
    location: {href: 'https://www.bigbigwork.com/home'},
    setTimeout: fn => {
      timers.set(1, fn);
      return 1;
    },
    clearTimeout: id => timers.delete(id)
  };
  const install = getScriptFunction('bigbigworkCaptureResult');
  let result;
  document.addEventListener('result', ev => {
    result = ev.detail;
  });
  try {
    install('result');
    for (const url of [
      'https://example.com/SemblancePic/dzcollect.html?ossUrl=x',
      'https://www.bigbigwork.com/home',
      'https://www.bigbigwork.com/SemblancePic/dzcollect.html'
    ])
      assert.equal(window.open(url, '_blank'), 'other-window');
    assert.equal(opened.length, 3);
    assert.equal(result, undefined);
    const url =
      'https://www.bigbigwork.com/SemblancePic/dzcollect.html?ossUrl=test';
    const preview = 'data:image/png;base64,dGVzdA==';
    assert.equal(window.open(url, preview), null);
    assert.equal(window.name, preview);
    assert.equal(result, url);
    assert.equal(window.open, originalOpen);
    assert.equal(timers.size, 0);
    install('cancel');
    document.dispatchEvent(new Event('cancel:cleanup'));
    assert.equal(window.open, originalOpen);
    install('timeout');
    timers.get(1)();
    assert.equal(window.open, originalOpen);
    assert.equal(timers.size, 0);
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});
