const message = 'Keep the 17 engines selected by the user';
const revision = '20260907050000_keep_selected_engines';
const selectedEngines = [
  "googleLens",
  "bing",
  "yandex",
  "shutterstock",
  "adobestock",
  "depositphotos",
  "pinterest",
  "freepik",
  "vcg",
  "bigbigwork",
  "huaban",
  "cosmos",
  "savee",
  "zcool",
  "patternbank",
  "sameenergy",
  "spoonflower"
];

async function upgrade() {
  await browser.storage.local.set({engines: [...selectedEngines], disabledEngines: [], storageVersion: revision});
}

export {message, revision, selectedEngines, upgrade};
