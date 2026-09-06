const message = 'Add design reference search engines';
const revision = '20260907020000_add_design_sites';
async function upgrade() {
  const {engines = [], disabledEngines = []} = await browser.storage.local.get([
    'engines',
    'disabledEngines'
  ]);
  const additions = ['huaban', 'cosmos', 'savee', 'behance', 'zcool'].filter(
    engine => !engines.includes(engine)
  );
  await browser.storage.local.set({
    engines: [...engines, ...additions],
    disabledEngines: [...new Set([...disabledEngines, ...additions])],
    storageVersion: revision
  });
}
export {message, revision, upgrade};
