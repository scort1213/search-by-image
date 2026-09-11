import {sleep} from 'utils/common';
import {EngineError, sendReceipt, setFileInputData} from 'utils/engines';

const dialog = '[role="dialog"][data-state="open"]';
const config = {
  spoonflower: {
    trigger: '#shop-by-image-landing-cta, a[href="/en/shop-by-image/upload"]',
    input: `${dialog} label[class*="LabelUpload"] input[type="file"]`,
    crop: `${dialog} [class*="ReactCrop"]`,
    primary: `${dialog} button[class*="ImageSearchDialog"][class*="PrimaryButton"]`,
    fabric: `${dialog} [class*="ProductTypePicker"][class*="Card"]:has(img[src*="/fabric."])`
  },
  cosmos: {
    trigger: 'button[data-testid$="search-by-image-btn"]',
    input: '#visual-search-file-upload'
  }
};

function visible(node) {
  return !!node && node.isConnected && node.getClientRects().length > 0 &&
    getComputedStyle(node).visibility !== 'hidden';
}

function findVisible(selector, {input = false} = {}) {
  return [...document.querySelectorAll(selector)].find(node => {
    // File inputs are intentionally hidden; inspect their associated UI instead.
    const control = input ? (node.closest('label') || node.parentElement) : node;
    return !node.disabled && visible(control);
  });
}

async function waitUntil(check, timeout = 15000) {
  const end = Date.now() + timeout;
  do {
    const value = check();
    if (value) return value;
    await sleep(200);
  } while (Date.now() < end);
  return null;
}

async function openUpload(engine) {
  const site = config[engine];
  const getInput = () => findVisible(site.input, {input: true});
  for (let attempt = 0; attempt < 3; attempt++) {
    if (getInput()) return getInput();
    const trigger = await waitUntil(() => findVisible(site.trigger));
    if (!trigger) break;
    // HTMLElement.click is cancelable: React can prevent the anchor's default
    // navigation. A non-cancelable synthetic click reloads Spoonflower's page
    // and destroys the running upload task.
    if (engine === 'cosmos') {
      trigger.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true, composed: true, view: window,
        button: 0, buttons: 1
      }));
    } else {
      trigger.click();
    }
    const input = await waitUntil(getInput, 5000);
    if (input) return input;
  }
  throw new Error('上传面板未打开');
}

function resultsVisible(engine, initialUrl) {
  if (location.href === initialUrl) return false;
  const url = new URL(location.href);
  if (engine === 'cosmos') {
    return url.pathname === '/search/elements' && url.searchParams.has('image') &&
      [...document.querySelectorAll('[data-testid="element-tile-link"]')].some(visible);
  }
  return /^\/en\/shop-by-image\/[a-f0-9]+$/.test(url.pathname) &&
    url.searchParams.get('on') === 'fabric' &&
    [...document.querySelectorAll('a[href*="/en/fabric/"]')].some(visible);
}

async function searchInteractiveSite(engine, {image, storageIds}) {
  const site = config[engine];
  const initialUrl = location.href;
  let stage = '打开搜图入口';
  const started = Date.now();
  const log = status => console.info('[图片搜索]', {
    website: engine, stage, status, elapsedMs: Date.now() - started
  });
  try {
    log('开始');
    const input = await openUpload(engine);
    stage = '传入图片';
    log('开始');
    await setFileInputData(site.input, input, image);
    await sendReceipt(storageIds);
    input.dispatchEvent(new Event('change', {bubbles: true}));
    if (engine === 'spoonflower') {
      stage = '等待裁剪界面';
      if (!(await waitUntil(() => findVisible(site.crop), 30000))) throw new Error(stage);
      stage = '确认裁剪';
      const save = await waitUntil(() => findVisible(site.primary));
      if (!save) throw new Error(stage);
      save.click();
      stage = '选择面料';
      const fabric = await waitUntil(() => findVisible(site.fabric));
      if (!fabric) throw new Error(stage);
      fabric.click();
      if (!(await waitUntil(() => findVisible(`${site.fabric}[class*="Selected"]`)))) throw new Error(stage);
      stage = '提交图片搜索';
      const submit = await waitUntil(() => findVisible(site.primary));
      if (!submit) throw new Error(stage);
      submit.click();
    }
    stage = '等待图片结果';
    log('开始');
    if (!(await waitUntil(() => resultsVisible(engine, initialUrl), 90000))) throw new Error(stage);
    log('完成');
  } catch (error) {
    log('未完成');
    throw new EngineError(`${engine === 'spoonflower' ? 'Spoonflower' : 'Cosmos'}：${stage}未完成，请检查网页后重试。`);
  }
}

export {searchInteractiveSite, openUpload, findVisible, resultsVisible};
