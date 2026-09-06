import {runOnce} from 'utils/common';
import {initSearch} from 'utils/engines';
import {searchDesignSite} from 'utils/design-sites';

const engine = 'behance';
if (runOnce('search')) {
  initSearch(task => searchDesignSite(engine, task), engine, taskId);
}
