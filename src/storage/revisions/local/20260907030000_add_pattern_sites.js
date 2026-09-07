const message = 'Add pattern and art search engines';
const revision = '20260907030000_add_pattern_sites';
async function upgrade() {
  const {engines = [], disabledEngines = []} = await browser.storage.local.get([
    'engines',
    'disabledEngines'
  ]);
  const additions = ['patternbank', 'sameenergy', 'spoonflower'].filter(
    engine => !engines.includes(engine)
  );
  await browser.storage.local.set({
    engines: [...engines, ...additions],
    disabledEngines: [...new Set([...disabledEngines, ...additions])],
    storageVersion: revision
  });
}
export {message, revision, upgrade};
