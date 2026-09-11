import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {difference, includes, without} from 'lodash-es';
import {upgrade, revision} from '../src/storage/revisions/local/20260907060000_add_amazon.js';
import {selectedEngines} from '../src/storage/revisions/local/20260907050000_keep_selected_engines.js';
const read=p=>fs.readFileSync(p,'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));

test('Amazon upgrade adds exactly one enabled option and preserves existing preferences',async()=>{
 for(const initial of [{engines:[...selectedEngines],disabledEngines:['cosmos'],searchModeAction:'capture',searchModeContextMenu:'browse'}, {engines:['amazon','bing'],disabledEngines:['amazon']}]){
  const state=structuredClone(initial);
  globalThis.browser={storage:{local:{get:async()=>state,set:async x=>Object.assign(state,x)}}};
  try {await upgrade();await upgrade();assert.equal(state.engines.filter(x=>x==='amazon').length,1);assert.deepEqual(state.disabledEngines,initial.disabledEngines);assert.equal(state.searchModeAction,initial.searchModeAction);assert.equal(state.storageVersion,revision);assert.deepEqual(state.engines.filter(x=>x!=='amazon'),initial.engines.filter(x=>x!=='amazon'));}finally{delete globalThis.browser;}
 }
});

test('18-site routing includes Amazon for Capture/Browse and prepares image bytes',async()=>{
 const ids=[...selectedEngines,'amazon'];
 const c=vm.createContext({difference,includes,without,browser:{runtime:{getURL:p=>p}},storage:{get:async()=>({engines:ids,disabledEngines:[],bypassImageHostBlocking:true})}});
 vm.runInContext(read('src/utils/data.js').replace(/export \{[\s\S]*?\};/,''),c);
 vm.runInContext(read('src/utils/app.js').replace(/^import[\s\S]*?from '[^']+';\n/gm,'').replace(/export \{[\s\S]*?\};/,''),c);
 for(const mode of ['capture','browse']) for(const type of ['image/png','image/jpeg','image/webp','image/avif']){
  const tasks=await c.getSearches({imageType:type,imageDataUrl:`data:${type};base64,`},ids,mode);
  assert.deepEqual(plain(tasks.map(t=>t.engine)),ids);
  const task=tasks.find(t=>t.engine==='amazon');assert.equal(task.assetType,'image');assert.equal(task.isExec,true);assert.equal(task.sendsReceipt,true);
 }
 assert.equal(c.getMaxImageUploadSize('amazon'),Infinity);
 const locale=JSON.parse(read('src/assets/locales/en/messages.json'));
 for(const prefix of ['engineName_','optionTitle_','menuItemTitle_'])assert.ok(locale[prefix+'amazon'].message.includes('美国亚马逊'));
 assert.ok(fs.existsSync('src/assets/icons/engines/amazon.svg'));
 assert.equal(JSON.parse(read('src/storage/config.json')).revisions.local.at(-1),revision);
});

function adapter({missing=false,wrongPage=false}={}){
 const calls=[]; const input={dispatchEvent:e=>calls.push(['change',e.type,e.bubbles])};
 class EngineError extends Error{}
 const c=vm.createContext({Date,JSON,Event,EngineError,console:{info:()=>{}},location:{hostname:'www.amazon.com',pathname:wrongPage?'/review':'/shopthelook'},runOnce:()=>false,findNode:async selector=>{calls.push(['find',selector]);if(missing)throw Error('timeout');return input;},setFileInputData:async(s,i,img)=>{assert.equal(i,input);assert.equal(img.bytes,'test');calls.push(['file']);},sendReceipt:async()=>calls.push(['receipt'])});
 vm.runInContext(read('src/engines/amazon.js').replace(/^import .*;\n/gm,''),c);
 return {calls,run:()=>c.search({image:{bytes:'test'},storageIds:['task','image']})};
}
test('Amazon adapter passes image then releases receipt before native navigation, submitting once',async()=>{const a=adapter();await a.run();assert.deepEqual(a.calls,[['find','input#file[type="file"]'],['file'],['receipt'],['change','change',true]]);});
test('Amazon missing input or unexpected page never uploads to another form',async()=>{for(const options of [{missing:true},{wrongPage:true}]){const a=adapter(options);await assert.rejects(a.run(),/美国亚马逊/);assert.ok(!a.calls.some(x=>x[0]==='file'||x[0]==='change'));}});
