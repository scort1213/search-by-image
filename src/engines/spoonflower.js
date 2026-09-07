import {runOnce} from 'utils/common';
import {initSearch} from 'utils/engines';
import {searchDesignSite} from 'utils/design-sites';

const engine = 'spoonflower';
if (runOnce('search')) {
  initSearch(task => searchDesignSite(engine, task), engine, taskId);
}
