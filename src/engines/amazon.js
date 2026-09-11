import {findNode, runOnce} from 'utils/common';
import {EngineError, initSearch, sendReceipt, setFileInputData} from 'utils/engines';

const engine = 'amazon';

async function search({image, storageIds}) {
  // Let Amazon's native change handler obtain its upload URL and navigate.
  // Do not cache signed upload URLs or use product review image inputs.
  const selector = 'input#file[type="file"]';
  let stage = '等待图片上传入口';
  const started = Date.now();
  const log = status => console.info('[图片搜索]', JSON.stringify({
    website: engine, stage, status, elapsedMs: Date.now() - started
  }));
  try {
    if (location.hostname !== 'www.amazon.com' ||
        !/^\/shopthelook\/?$/.test(location.pathname)) {
      throw new Error('Unexpected upload page');
    }
    log('开始');
    const input = await findNode(selector, {timeout: 60000});
    stage = '传入图片';
    await setFileInputData(selector, input, image);
    // The native handler navigates away; release our copy before navigation.
    await sendReceipt(storageIds);
    input.dispatchEvent(new Event('change', {bubbles: true}));
    stage = '已交给亚马逊处理';
    log('已提交');
  } catch (error) {
    log('未完成');
    throw new EngineError(`美国亚马逊：${stage}未完成，请检查网页后重试。`);
  }
}

if (runOnce('search')) {
  initSearch(search, engine, taskId);
}
