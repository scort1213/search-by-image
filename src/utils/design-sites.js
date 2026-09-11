import {searchInteractiveSite} from 'utils/interactive-sites';
import {findNode, getText, sleep} from 'utils/common';
import {convertProcessedImage} from 'utils/app';
import {EngineError, sendReceipt, setFileInputData} from 'utils/engines';

// Use only the search upload controls, never the sites' publish/save controls.
const designSites = {
  patternbank: {
    trigger: '#visual-search-file-input',
    input: '#visual-search-file-input',
    result: () =>
      location.pathname === '/visual-search/results' &&
      new URL(location.href).searchParams.has('vs')
  },
  sameenergy: {
    trigger: 'form input[type="file"][class*="main_file_chooser"]',
    input: 'form input[type="file"][class*="main_file_chooser"]',
    result: () =>
      location.pathname === '/search' &&
      new URL(location.href).searchParams.has('i')
  },
  spoonflower: {
    trigger: '#shop-by-image-landing-cta, a[href="/en/shop-by-image/upload"]',
    input: '[role="dialog"] input[type="file"][class*="ImageDrop"]',
    afterUpload: finishSpoonflower,
    result: () =>
      /^\/en\/shop-by-image\/[a-f0-9]+$/.test(location.pathname) &&
      new URL(location.href).searchParams.get('on') === 'fabric'
  },
  huaban: {
    trigger: 'use[*|href="#camera"]',
    input:
      'input[type="file"][accept="image/jpeg,image/png,image/gif,image/webp"]',
    result: () =>
      location.pathname === '/similar' &&
      new URL(location.href).searchParams.has('key')
  },
  cosmos: {
    trigger: 'button[data-testid$="search-by-image-btn"]',
    input: '#visual-search-file-upload',
    result: () =>
      location.pathname === '/search/elements' &&
      new URL(location.href).searchParams.has('image')
  },
  savee: {
    trigger: 'button[title="Search by Image" i], button[title="按图片搜索"]',
    input: 'input[type="file"][accept*="image/heic"]',
    result: () =>
      location.pathname === '/search/' &&
      new URL(location.href).searchParams.has('image')
  },
  zcool: {
    trigger: 'button.zcool-top-nav__search-camera',
    input: 'input[type="file"].zcool-top-nav-search__hidden-file-input',
    result: () =>
      location.pathname === '/search/image' &&
      new URL(location.href).searchParams.has('album')
  }
};

// Keep selectors within the image-search dialog; never click upload-design controls.
async function finishSpoonflower() {
  const primary =
    '[role="dialog"] button[class*="ImageSearchDialog"][class*="PrimaryButton"]';
  const fabric =
    '[role="dialog"] [class*="ProductTypePicker"][class*="Card"]:has(img[src*="/fabric."])';
  await findNode('[role="dialog"] [class*="ReactCrop"]');
  (await findNode(primary)).click();
  const card = await findNode(fabric);
  card.click();
  await findNode(`${fabric}[class*="Selected"]`);
  (await findNode(primary)).click();
}

async function searchDesignSite(engine, {image, storageIds}) {
  if (['spoonflower', 'cosmos'].includes(engine)) {
    return searchInteractiveSite(engine, {image, storageIds});
  }
  const site = designSites[engine];
  const failure = () => new EngineError(getText('error_designSiteUpload'));
  try {
    // JPEG and PNG are shared by every supported upload UI.
    if (!['image/jpeg', 'image/png'].includes(image.imageType)) {
      image = await convertProcessedImage(image, {
        newType: 'image/png',
        maxSize: 10 * 1024 * 1024,
        setBlob: true
      });
      if (!image) throw failure();
    }
    const trigger = await findNode(site.trigger);
    // Allow client-side event handlers to attach after the initial HTML renders.
    await sleep(750);
    if (!document.querySelector(site.input)) {
      const control =
        trigger.closest('button') || trigger.closest('span') || trigger;
      if (engine === 'cosmos') {
        control.dispatchEvent(
          new MouseEvent('mousedown', {bubbles: true, button: 0})
        );
        control.dispatchEvent(
          new MouseEvent('mouseup', {bubbles: true, button: 0})
        );
      }
      control.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    }
    const input = await findNode(site.input);
    await setFileInputData(site.input, input, image);
    // A successful upload may navigate away and destroy this script immediately.
    await sendReceipt(storageIds);
    input.dispatchEvent(new Event('change', {bubbles: true}));
    if (site.afterUpload) await site.afterUpload();
    const deadline = Date.now() + 90000;
    while (Date.now() < deadline) {
      if (site.result()) return;
      await sleep(500);
    }
    throw failure();
  } catch (error) {
    if (error.name === 'EngineError') throw error;
    throw failure();
  }
}

export {designSites, searchDesignSite, finishSpoonflower};
