import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {upgrade, revision, selectedEngines} from '../src/storage/revisions/local/20260907050000_keep_selected_engines.js';

test('screenshot selection replaces legacy engines on fresh install and upgrade without changing capture settings', async () => {
  const expected=['googleLens','bing','yandex','shutterstock','adobestock','depositphotos','pinterest','freepik','vcg','bigbigwork','huaban','cosmos','savee','zcool','patternbank','sameenergy','spoonflower'];
  assert.deepEqual(selectedEngines,expected);
  for(const initial of [{}, {engines:['baidu','googleLens','lenso'],disabledEngines:['googleLens'],searchModeAction:'capture',searchModeContextMenu:'browse'}]) {
    const state=structuredClone(initial);
    globalThis.browser={storage:{local:{set:async x=>Object.assign(state,x)}}};
    try {await upgrade();assert.deepEqual(state,{...initial,engines:expected,disabledEngines:[],storageVersion:revision});} finally {delete globalThis.browser;}
  }
  const context={browser:{runtime:{getURL:p=>p}}};vm.createContext(context);
  vm.runInContext(fs.readFileSync('src/utils/data.js','utf8').replace(/export \{[\s\S]*?\};/,'')+'\nthis.keys=Object.keys(engines);',context);
  assert.deepEqual([...context.keys].sort(),[...expected, "amazon"].sort());
  const config=JSON.parse(fs.readFileSync('src/storage/config.json'));
  assert.ok(config.revisions.local.includes(revision));
});
