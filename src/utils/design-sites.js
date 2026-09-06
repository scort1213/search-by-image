import {findNode, getText, sleep} from 'utils/common';
import {convertProcessedImage} from 'utils/app';
import {EngineError, sendReceipt, setFileInputData} from 'utils/engines';

// Use only the search upload controls, never the sites' publish/save controls.
const designSites = {
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
  behance: {
    trigger: 'button[class*="ExploreSearchOptions-uploadFileButton"]',
    input: 'input[type="file"][name="fileUploader"]',
    result: () =>
      !!document.querySelector(
        'img[alt="Similar Image" i], img[alt="相似图像"]'
      )
  },
  zcool: {
    trigger: 'button.zcool-top-nav__search-camera',
    input: 'input[type="file"].zcool-top-nav-search__hidden-file-input',
    result: () =>
      location.pathname === '/search/image' &&
      new URL(location.href).searchParams.has('album')
  }
};

async function searchDesignSite(engine, {image, storageIds}) {
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

export {designSites, searchDesignSite};
