import test from 'node:test';
import assert from 'node:assert/strict';
import {upgrade, revision} from '../src/storage/revisions/local/20260907040000_remove_behance.js';

test('upgrade removes enabled or disabled Behance without changing other choices', async () => {
  for (const disabledEngines of [['savee'], ['savee', 'behance']]) {
    const state = {engines: ['pinterest', 'behance', 'savee'], disabledEngines};
    globalThis.browser = {storage: {local: {
      get: async () => structuredClone(state),
      set: async value => Object.assign(state, value)
    }}};
    try {
      await upgrade();
      await upgrade();
      assert.deepEqual(state, {
        engines: ['pinterest', 'savee'], disabledEngines: ['savee'], storageVersion: revision
      });
    } finally {
      delete globalThis.browser;
    }
  }
});
