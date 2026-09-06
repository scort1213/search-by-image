import {v4 as uuidv4} from 'uuid';
import {
  findNode,
  executeScriptMainContext,
  getText,
  runOnce
} from 'utils/common';
import {convertProcessedImage} from 'utils/app';
import {
  setFileInputData,
  initSearch,
  sendReceipt,
  EngineError
} from 'utils/engines';

const engine = 'bigbigwork';

async function search({image, storageIds} = {}) {
  // Keep format and size within the site's upload requirements.
  if (!['image/jpeg', 'image/png'].includes(image.imageType)) {
    image = await convertProcessedImage(image, {
      newType: 'image/png',
      maxSize: 3 * 1024 * 1024,
      setBlob: true,
      throwError: true
    });
    if (!image) throw new EngineError(getText('error_bigbigworkUpload'));
  }
  const selector =
    'input.el-upload__input[type="file"][name="file"][accept*=".png"]';
  const input = await findNode(selector);
  await setFileInputData(selector, input, image);

  const eventName = uuidv4();
  let onResult, timer;
  const result = new Promise(resolve => {
    onResult = ev => {
      try {
        const url = new URL(ev.detail);
        if (
          url.origin === 'https://www.bigbigwork.com' &&
          url.pathname === '/SemblancePic/dzcollect.html' &&
          url.searchParams.has('ossUrl')
        )
          resolve(url.href);
      } catch (_) {}
    };
    document.addEventListener(eventName, onResult);
    timer = window.setTimeout(() => resolve(null), 90000);
  });
  try {
    await executeScriptMainContext({
      func: 'bigbigworkCaptureResult',
      args: [eventName]
    });
    // The website retains responsibility for login, validation and upload.
    input.dispatchEvent(new Event('change', {bubbles: true}));
    const url = await result;
    if (!url) throw new EngineError(getText('error_bigbigworkUpload'));
    await sendReceipt(storageIds);
    window.location.replace(url);
  } finally {
    window.clearTimeout(timer);
    document.removeEventListener(eventName, onResult);
    document.dispatchEvent(new Event(`${eventName}:cleanup`));
  }
}

function init() {
  initSearch(search, engine, taskId);
}
if (runOnce('search')) init();
