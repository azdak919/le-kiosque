const TABLES = {
  article: 'articles',
  author: 'authors',
  section: 'sections',
  category: 'categories',
  tag: 'tags',
  media: 'media',
};

const CAPABILITIES = Object.freeze({
  writable: true,
  preview: true,
  media: true,
  persistent: 'browser',
  authentication: false,
  collaboration: false,
  remoteBackup: false,
  remotePublishing: false,
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeName(value) {
  return String(value || 'journal').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '');
}

function now() {
  return new Date().toISOString();
}

function entityId(entity) {
  return entity.id || crypto.randomUUID();
}

function withBootstrap(seed, bootstrap) {
  if (!bootstrap || typeof bootstrap !== 'object') return seed;
  const publication = { ...seed.publication };
  const scalar = ['name', 'slug', 'tagline', 'institution', 'institutionType', 'region', 'siteUrl', 'timeZone', 'founded'];
  for (const key of scalar) if (bootstrap[key]) publication[key] = bootstrap[key];
  publication.theme = {
    ...publication.theme,
    accent: bootstrap.accent || publication.theme?.accent,
    accentDark: bootstrap.accentDark || publication.theme?.accentDark,
    typography: bootstrap.typography || publication.theme?.typography || 'modern-accessible',
  };
  publication.radio = {
    ...publication.radio,
    enabled: bootstrap.radioEnabled === undefined ? publication.radio?.enabled : Boolean(bootstrap.radioEnabled),
    station: bootstrap.station || publication.radio?.station,
    theme: bootstrap.radioTheme || publication.radio?.theme,
    position: bootstrap.radioPosition || publication.radio?.position,
  };
  publication.masthead = {
    backgrounds: {
      enabled: bootstrap.backgroundsEnabled === undefined ? publication.masthead?.backgrounds?.enabled : Boolean(bootstrap.backgroundsEnabled),
      images: publication.masthead?.backgrounds?.images || [],
    },
    weather: {
      enabled: bootstrap.weatherEnabled === undefined ? publication.masthead?.weather?.enabled : Boolean(bootstrap.weatherEnabled),
      localities: typeof bootstrap.weatherLocalities === 'string'
        ? bootstrap.weatherLocalities.split(',').map((value) => value.trim()).filter(Boolean).slice(0, 4)
        : publication.masthead?.weather?.localities || [],
    },
    tools: {
      pomodoro: bootstrap.pomodoro === undefined ? publication.masthead?.tools?.pomodoro : Boolean(bootstrap.pomodoro),
      solitaire: bootstrap.solitaire === undefined ? publication.masthead?.tools?.solitaire : Boolean(bootstrap.solitaire),
    },
  };
  if (bootstrap.logo && typeof bootstrap.logo === 'object') publication.logo = bootstrap.logo;
  const configuredSections = Array.isArray(bootstrap.sections) ? bootstrap.sections.map((section) => ({
    ...section,
    id: seed.sections?.find((item) => item.slug === section.slug)?.id || crypto.randomUUID(),
  })) : null;
  const configuredAuthors = Array.isArray(bootstrap.users) ? bootstrap.users.map((user) => {
    const id = crypto.randomUUID();
    const editorialRole = ['auteur', 'reviseur', 'editeur'].includes(user.role) ? user.role : 'auteur';
    return { id, slug: safeName(user.name), name: user.name, email: user.email || undefined, editorialRole, role: editorialRole, active: true, isDemo: false, isUserModified: true, source: { backend: 'configurateur', backendId: id, fetchedAt: now() } };
  }) : [];
  return {
    ...seed,
    publication,
    sections: configuredSections?.length ? configuredSections : seed.sections,
    configuredAuthors,
    settings: { demoVisible: bootstrap.demoContent !== false, startEmpty: Boolean(bootstrap.startEmpty) },
  };
}

export class DemoBackendPGlite {
  id = 'demo-pglite';
  capabilities = CAPABILITIES;
  db = null;
  context = null;
  channel = null;
  listeners = new Set();
  seed = null;
  worker = null;

  async init(context) {
    this.context = context;
    const assetsBase = String(context.assetsBase || '').replace(/\/$/, '');
    const { PGliteWorker } = await import(`${assetsBase}/pglite/worker/index.js`);
    this.worker = new Worker(`${assetsBase}/pglite-worker.js`, { type: 'module', name: 'kiosque-pglite' });
    const dbName = context.databaseName || `kiosque-${safeName(context.basePath)}-${safeName(context.publicationSlug)}`;
    this.db = await PGliteWorker.create(this.worker, { dataDir: `idb://${dbName}`, id: dbName });
    this.channel = new BroadcastChannel(`kiosque-editorial:${dbName}`);
    this.channel.addEventListener('message', (event) => this.#emit(event.data, false));
    await this.#migrate();
    const result = await this.db.query("SELECT value FROM kiosque_meta WHERE key = 'seeded'");
    if (!result.rows.length) {
      await this.#seed(context.bootstrap);
    } else {
      /*
       * Si le seed.json embarqué a une version plus récente que la base
       * locale, réinjecter les entités démo non modifiées (portraits,
       * photos d’articles, etc.). Sinon le HTML statique affiche les
       * images, puis front.js re-rend depuis une IDB périmée → initiales
       * et vignettes cassées.
       */
      const seed = await this.#loadSeed();
      const stored = result.rows[0]?.value;
      const storedVersion = stored && typeof stored === 'object' ? Number(stored.version) || 0 : 0;
      const seedVersion = Number(seed.version) || 0;
      if (seedVersion > storedVersion) {
        await this.#refreshUnmodifiedDemo(seed);
        await this.db.query(
          `INSERT INTO kiosque_meta(key, value) VALUES ('seeded', $1::jsonb)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
          [JSON.stringify({ at: now(), version: seedVersion })],
        );
      } else {
        const mediaCount = await this.db.query('SELECT count(*)::int AS count FROM media');
        if (!mediaCount.rows[0]?.count) {
          for (const media of seed.media || []) await this.save('media', media);
        }
      }
    }
  }

  /**
   * Met à jour (ou crée) les articles/auteurs/médias de démo non touchés
   * par l’utilisatrice — sans écraser les contenus is_user_modified.
   */
  async #refreshUnmodifiedDemo(seed) {
    await this.db.transaction(async (tx) => {
      /*
       * Publication complète depuis le seed (mât sports, météo, labels…).
       * Sans ça, une IDB antérieure n’a pas masthead.sports et front.js
       * retire la puce HTML statique à l’applyBranding.
       */
      if (seed.publication && typeof seed.publication === 'object') {
        const pub = { ...seed.publication, id: entityId(seed.publication) };
        await tx.query(
          `INSERT INTO publication(id, data) VALUES ($1, $2::jsonb)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
          [pub.id, JSON.stringify(pub)],
        );
      }
      for (const raw of seed.media || []) {
        const entity = { ...raw, id: entityId(raw) };
        await tx.query(
          `INSERT INTO media(id, data) VALUES ($1, $2::jsonb)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
          [entity.id, JSON.stringify(entity)],
        );
      }
      for (const raw of seed.authors || []) {
        const entity = { ...raw, id: entityId(raw), isDemo: true, isUserModified: false };
        const existing = await tx.query(
          'SELECT is_user_modified, data FROM authors WHERE id = $1 OR slug = $2 LIMIT 1',
          [entity.id, entity.slug],
        );
        const row = existing.rows[0];
        if (row?.is_user_modified) continue;
        if (row) {
          await tx.query(
            `UPDATE authors SET slug = $2, is_demo = true, is_user_modified = false, data = $3::jsonb
             WHERE id = $1 OR slug = $2`,
            [entity.id, entity.slug, JSON.stringify(entity)],
          );
        } else {
          await tx.query(
            'INSERT INTO authors(id, slug, is_demo, is_user_modified, data) VALUES ($1,$2,true,false,$3::jsonb)',
            [entity.id, entity.slug, JSON.stringify(entity)],
          );
        }
      }
      for (const raw of seed.articles || []) {
        const status = ['draft', 'in-review', 'published'].includes(raw.status) ? raw.status : 'draft';
        const entity = { ...raw, id: entityId(raw), isDemo: true, isUserModified: false, status };
        const existing = await tx.query(
          'SELECT is_user_modified FROM articles WHERE id = $1 OR slug = $2 LIMIT 1',
          [entity.id, entity.slug],
        );
        const row = existing.rows[0];
        if (row?.is_user_modified) continue;
        if (row) {
          await tx.query(
            `UPDATE articles SET slug = $2, status = $3, is_demo = true, is_user_modified = false,
               updated_at = $4, data = $5::jsonb
             WHERE id = $1 OR slug = $2`,
            [entity.id, entity.slug, status, entity.updatedAt || now(), JSON.stringify(entity)],
          );
        } else {
          await tx.query(
            `INSERT INTO articles(id, slug, status, is_demo, is_user_modified, updated_at, data)
             VALUES ($1,$2,$3,true,false,$4,$5::jsonb)`,
            [entity.id, entity.slug, status, entity.updatedAt || now(), JSON.stringify(entity)],
          );
        }
      }
      for (const kind of ['section', 'category', 'tag']) {
        const table = TABLES[kind];
        for (const raw of seed[table] || []) {
          const entity = { ...raw, id: entityId(raw) };
          await tx.query(
            `INSERT INTO ${table}(id, slug, data) VALUES ($1, $2, $3::jsonb)
             ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, data = excluded.data`,
            [entity.id, entity.slug, JSON.stringify(entity)],
          );
        }
      }
    });
  }

  async #migrate() {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS kiosque_meta (
        key text PRIMARY KEY,
        value jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS publication (
        id text PRIMARY KEY,
        data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS articles (
        id text PRIMARY KEY,
        slug text NOT NULL UNIQUE,
        status text NOT NULL CHECK (status IN ('draft', 'in-review', 'published')),
        is_demo boolean NOT NULL DEFAULT false,
        is_user_modified boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL,
        data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS authors (
        id text PRIMARY KEY, slug text NOT NULL UNIQUE,
        is_demo boolean NOT NULL DEFAULT false,
        is_user_modified boolean NOT NULL DEFAULT false,
        data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sections (
        id text PRIMARY KEY, slug text NOT NULL UNIQUE, data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id text PRIMARY KEY, slug text NOT NULL UNIQUE, data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tags (
        id text PRIMARY KEY, slug text NOT NULL UNIQUE, data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS media (
        id text PRIMARY KEY, data jsonb NOT NULL
      );
      INSERT INTO kiosque_meta(key, value) VALUES ('schema-version', '1'::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = excluded.value;
    `);
  }

  async #loadSeed() {
    if (this.seed) return clone(this.seed);
    const response = await fetch(this.context.seedUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Les données initiales du Quorum sont introuvables (${response.status}).`);
    this.seed = await response.json();
    return clone(this.seed);
  }

  async #seed(bootstrap, options = {}) {
    const seed = withBootstrap(await this.#loadSeed(), bootstrap);
    await this.db.transaction(async (tx) => {
      if (options.full) {
        for (const table of ['articles', 'authors', 'sections', 'categories', 'tags', 'media', 'publication']) {
          await tx.exec(`DELETE FROM ${table}`);
        }
      }
      await tx.query(
        `INSERT INTO publication(id, data) VALUES ($1, $2::jsonb)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        [seed.publication.id, JSON.stringify(seed.publication)],
      );
      for (const kind of ['section', 'category', 'tag']) {
        const table = TABLES[kind];
        const entities = (seed[table] || []).map((raw) => ({ ...raw, id: entityId(raw) }));
        if (entities.length) {
          const values = entities.map((_, index) => {
            const offset = index * 3;
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}::jsonb)`;
          }).join(',');
          await tx.query(
            `INSERT INTO ${table}(id, slug, data) VALUES ${values}
             ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, data = excluded.data`,
            entities.flatMap((entity) => [entity.id, entity.slug, JSON.stringify(entity)]),
          );
        }
      }
      const demoAuthors = (seed.settings?.startEmpty ? [] : (seed.authors || [])).map((raw) => ({
        ...raw, id: entityId(raw), isDemo: true, isUserModified: false,
      }));
      const configuredAuthors = (seed.configuredAuthors || []).map((raw) => ({
        ...raw, id: entityId(raw), isDemo: false, isUserModified: true,
      }));
      const authors = [...demoAuthors, ...configuredAuthors];
      if (authors.length) {
        const values = authors.map((_, index) => {
          const offset = index * 5;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::jsonb)`;
        }).join(',');
        await tx.query(
          `INSERT INTO authors(id, slug, is_demo, is_user_modified, data) VALUES ${values}
           ON CONFLICT(id) DO UPDATE SET slug = excluded.slug,
             is_demo = excluded.is_demo, is_user_modified = excluded.is_user_modified, data = excluded.data`,
          authors.flatMap((entity) => [entity.id, entity.slug, entity.isDemo, entity.isUserModified, JSON.stringify(entity)]),
        );
      }
      const articles = (seed.settings?.startEmpty ? [] : (seed.articles || [])).map((raw) => {
        const entity = { ...raw, id: entityId(raw), isDemo: true, isUserModified: false };
        const status = ['draft', 'in-review', 'published'].includes(entity.status) ? entity.status : 'draft';
        return { ...entity, status };
      });
      if (articles.length) {
        const values = articles.map((_, index) => {
          const offset = index * 7;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}::jsonb)`;
        }).join(',');
        await tx.query(
          `INSERT INTO articles(id, slug, status, is_demo, is_user_modified, updated_at, data)
           VALUES ${values}
           ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, status = excluded.status,
             is_demo = excluded.is_demo, is_user_modified = excluded.is_user_modified,
             updated_at = excluded.updated_at, data = excluded.data`,
          articles.flatMap((entity) => [entity.id, entity.slug, entity.status, true, false, entity.updatedAt || now(), JSON.stringify(entity)]),
        );
      }
      for (const media of seed.media || []) {
        const entity = { ...media, id: entityId(media) };
        await tx.query(
          `INSERT INTO media(id, data) VALUES ($1, $2::jsonb)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
          [entity.id, JSON.stringify(entity)],
        );
      }
      await tx.query(
        `INSERT INTO kiosque_meta(key, value) VALUES ('demo-visible', $1::jsonb)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [JSON.stringify(seed.settings?.demoVisible !== false)],
      );
      await tx.query(
        `INSERT INTO kiosque_meta(key, value) VALUES ('seeded', $1::jsonb)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [JSON.stringify({ at: now(), version: seed.version || 1 })],
      );
    });
  }

  async #rows(table) {
    const result = await this.db.query(`SELECT data FROM ${table}`);
    return result.rows.map((row) => row.data);
  }

  async getSnapshot(options = { audience: 'editorial' }) {
    const [publicationResult, demoResult, articles, authors, sections, categories, tags, media] = await Promise.all([
      this.db.query('SELECT data FROM publication LIMIT 1'),
      this.db.query("SELECT value FROM kiosque_meta WHERE key = 'demo-visible'"),
      this.#rows('articles'), this.#rows('authors'), this.#rows('sections'), this.#rows('categories'), this.#rows('tags'), this.#rows('media'),
    ]);
    const demoVisible = demoResult.rows[0]?.value !== false;
    const includeDemo = options.includeDemo ?? demoVisible;
    const visibleArticles = articles.filter((article) => {
      if (!includeDemo && article.isDemo && !article.isUserModified) return false;
      return options.audience !== 'public' || article.status === 'published';
    });
    const usedAuthors = new Set(visibleArticles.flatMap((article) => article.authors || []));
    const visibleAuthors = includeDemo
      ? authors
      : authors.filter((author) => !author.isDemo || author.isUserModified || usedAuthors.has(author.slug));
    return {
      publication: publicationResult.rows[0].data,
      articles: visibleArticles.sort((a, b) => String(b.publishedAt || b.updatedAt).localeCompare(String(a.publishedAt || a.updatedAt))),
      authors: visibleAuthors,
      taxonomies: { sections, categories, tags },
      media,
      syncedAt: now(),
      demoVisible,
    };
  }

  async save(kind, input) {
    const table = TABLES[kind];
    if (!table) throw new Error(`Type éditorial inconnu : ${kind}`);
    const entity = clone({ ...input, id: entityId(input) });
    if (kind === 'article') {
      if (!['draft', 'in-review', 'published'].includes(entity.status)) throw new Error('Statut éditorial invalide.');
      if (!entity.title?.trim() || !entity.slug?.trim()) throw new Error('Un article requiert un titre et un identifiant URL.');
      entity.updatedAt = now();
      if (entity.status === 'published' && !entity.publishedAt) entity.publishedAt = entity.updatedAt;
      if (entity.status === 'published' && (!entity.authors?.length || !entity.section || !entity.publishedAt)) {
        throw new Error('Publier exige au moins une signature, une section et une date de publication.');
      }
      if (entity.isDemo) entity.isUserModified = true;
      await this.db.query(
        `INSERT INTO articles(id, slug, status, is_demo, is_user_modified, updated_at, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
         ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, status = excluded.status,
           is_demo = excluded.is_demo, is_user_modified = excluded.is_user_modified,
           updated_at = excluded.updated_at, data = excluded.data`,
        [entity.id, entity.slug, entity.status, Boolean(entity.isDemo), Boolean(entity.isUserModified), entity.updatedAt, JSON.stringify(entity)],
      );
    } else if (kind === 'author') {
      if (!entity.name?.trim() || !entity.slug?.trim()) throw new Error('Une signature requiert un nom et un identifiant URL.');
      if (entity.isDemo) entity.isUserModified = true;
      await this.db.query(
        `INSERT INTO authors(id, slug, is_demo, is_user_modified, data) VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, is_demo = excluded.is_demo,
           is_user_modified = excluded.is_user_modified, data = excluded.data`,
        [entity.id, entity.slug, Boolean(entity.isDemo), Boolean(entity.isUserModified), JSON.stringify(entity)],
      );
    } else if (kind === 'media') {
      await this.db.query(
        'INSERT INTO media(id, data) VALUES ($1, $2::jsonb) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
        [entity.id, JSON.stringify(entity)],
      );
    } else {
      if (!entity.name?.trim() || !entity.slug?.trim()) throw new Error('Cette entrée requiert un nom et un identifiant URL.');
      await this.db.query(
        `INSERT INTO ${table}(id, slug, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, data = excluded.data`,
        [entity.id, entity.slug, JSON.stringify(entity)],
      );
    }
    this.#emit({ kind, id: entity.id });
    return entity;
  }

  async remove(kind, id) {
    const table = TABLES[kind];
    if (!table) throw new Error(`Type éditorial inconnu : ${kind}`);
    await this.db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    this.#emit({ kind, id });
  }

  async savePublication(publication) {
    const entity = clone(publication);
    await this.db.query(
      'INSERT INTO publication(id, data) VALUES ($1, $2::jsonb) ON CONFLICT(id) DO UPDATE SET data = excluded.data',
      [entity.id, JSON.stringify(entity)],
    );
    this.#emit({ kind: 'publication', id: entity.id });
    return entity;
  }

  async setDemoVisibility(visible) {
    await this.db.query(
      `INSERT INTO kiosque_meta(key, value) VALUES ('demo-visible', $1::jsonb)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [JSON.stringify(Boolean(visible))],
    );
    this.#emit({ kind: 'demo-visibility' });
  }

  async removeDemo() {
    await this.db.transaction(async (tx) => {
      await tx.exec('DELETE FROM articles WHERE is_demo = true AND is_user_modified = false');
      await tx.exec(`DELETE FROM authors AS author
        WHERE is_demo = true AND is_user_modified = false
        AND NOT EXISTS (
          SELECT 1 FROM articles AS article
          WHERE article.data->'authors' ? (author.data->>'slug')
        )`);
    });
    this.#emit({ kind: 'demo-removed' });
  }

  async resetDemo(options = {}) {
    if (options.full) {
      await this.#seed(null, { full: true });
    } else {
      await this.db.transaction(async (tx) => {
        await tx.exec('DELETE FROM articles WHERE is_demo = true');
        await tx.exec('DELETE FROM authors WHERE is_demo = true');
      });
      const publication = (await this.getSnapshot({ audience: 'editorial' })).publication;
      await this.#seed(null);
      await this.savePublication(publication);
    }
    this.#emit({ kind: 'demo-reset' });
  }

  async createBackup(options = {}) {
    const bundle = await this.getSnapshot({ audience: 'editorial', includeDemo: true });
    const filter = options.filter || 'all';
    if (filter === 'without-demo') {
      bundle.articles = bundle.articles.filter((item) => !item.isDemo);
      bundle.authors = bundle.authors.filter((item) => !item.isDemo);
    } else if (filter === 'user-content') {
      bundle.articles = bundle.articles.filter((item) => !item.isDemo || item.isUserModified);
      bundle.authors = bundle.authors.filter((item) => !item.isDemo || item.isUserModified);
    }
    return { format: 'kiosque-editorial-backup', version: 1, exportedAt: now(), filter, bundle };
  }

  async restoreBackup(backup) {
    if (backup?.format !== 'kiosque-editorial-backup' || backup.version !== 1 || !backup.bundle?.publication) {
      throw new Error('Cette sauvegarde KIOSQUE est absente, invalide ou d’une version non prise en charge.');
    }
    const data = backup.bundle;
    await this.db.transaction(async (tx) => {
      for (const table of ['articles', 'authors', 'sections', 'categories', 'tags', 'media', 'publication']) await tx.exec(`DELETE FROM ${table}`);
      await tx.query('INSERT INTO publication(id, data) VALUES ($1, $2::jsonb)', [data.publication.id, JSON.stringify(data.publication)]);
      for (const kind of ['section', 'category', 'tag']) {
        const table = TABLES[kind];
        for (const item of data.taxonomies?.[table] || []) {
          await tx.query(`INSERT INTO ${table}(id, slug, data) VALUES ($1, $2, $3::jsonb)`, [item.id, item.slug, JSON.stringify(item)]);
        }
      }
      for (const item of data.authors || []) {
        await tx.query('INSERT INTO authors(id, slug, is_demo, is_user_modified, data) VALUES ($1,$2,$3,$4,$5::jsonb)', [item.id, item.slug, Boolean(item.isDemo), Boolean(item.isUserModified), JSON.stringify(item)]);
      }
      for (const item of data.articles || []) {
        await tx.query('INSERT INTO articles(id,slug,status,is_demo,is_user_modified,updated_at,data) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)', [item.id, item.slug, item.status, Boolean(item.isDemo), Boolean(item.isUserModified), item.updatedAt || now(), JSON.stringify(item)]);
      }
      for (const item of data.media || []) {
        await tx.query('INSERT INTO media(id,data) VALUES ($1,$2::jsonb)', [item.id, JSON.stringify(item)]);
      }
    });
    this.#emit({ kind: 'backup-restored' });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  #emit(event, broadcast = true) {
    for (const listener of this.listeners) listener(event);
    if (broadcast) this.channel?.postMessage(event);
  }

  async close() {
    this.channel?.close();
    await this.db?.close();
    this.worker?.terminate();
  }
}
