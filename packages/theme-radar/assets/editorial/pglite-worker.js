import { PGlite } from './pglite/index.js';
import { worker } from './pglite/worker/index.js';

worker({
  async init(options) {
    return new PGlite(options);
  },
});
