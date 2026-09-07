import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('new engines have labels for settings, menus and search messages', () => {
  const locale = JSON.parse(readFileSync(new URL('../src/assets/locales/en/messages.json', import.meta.url), 'utf8'));
  for (const engine of ['bigbigwork', 'huaban', 'cosmos', 'savee', 'behance', 'zcool']) {
    for (const prefix of ['optionTitle_', 'menuItemTitle_', 'engineName_']) {
      assert.ok(locale[prefix + engine]?.message?.trim(), `Blank label: ${prefix}${engine}`);
    }
  }
});
