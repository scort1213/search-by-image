const message = 'Add BigBigWork';
const revision = '20260907010000_add_bigbigwork';

async function upgrade() {
  const {engines = [], disabledEngines = []} = await browser.storage.local.get([
    'engines',
    'disabledEngines'
  ]);
  const isNew = !engines.includes('bigbigwork');
  return browser.storage.local.set({
    engines: isNew ? [...engines, 'bigbigwork'] : engines,
    disabledEngines:
      isNew && !disabledEngines.includes('bigbigwork')
        ? [...disabledEngines, 'bigbigwork']
        : disabledEngines,
    storageVersion: revision
  });
}

export {message, revision, upgrade};
