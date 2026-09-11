const message = 'Add Amazon US native image search';
const revision = '20260907060000_add_amazon';

async function upgrade() {
  const {engines = []} = await browser.storage.local.get('engines');
  await browser.storage.local.set({
    engines: engines.includes('amazon') ? engines : [...engines, 'amazon'],
    storageVersion: revision
  });
}

export {message, revision, upgrade};
