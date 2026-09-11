const message = 'Remove Behance from design search';
const revision = '20260907040000_remove_behance';

async function upgrade() {
  const {engines = [], disabledEngines = []} = await browser.storage.local.get([
    'engines',
    'disabledEngines'
  ]);
  await browser.storage.local.set({
    engines: engines.filter(engine => engine !== 'behance'),
    disabledEngines: disabledEngines.filter(engine => engine !== 'behance'),
    storageVersion: revision
  });
}

export {message, revision, upgrade};
