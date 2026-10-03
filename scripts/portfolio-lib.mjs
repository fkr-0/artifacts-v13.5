import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const BASELINE_SCHEMA = 'artifacts-v13.5/baseline-v1';
export const PARITY_SCHEMA = 'artifacts-v13.5/parity-report-v1';
export const ROUTE_SCHEMA = 'artifacts-v13.5/route-manifest-v1';
export const MANIFEST_SCHEMA = 'artifacts-v13.5/asset-manifest-v1';

const EXPECTED_AVAILABILITY = new Set(['provisional', 'verified']);
const MAX_FILES_PER_ROUTE = 1000;
const MAX_BYTES_PER_ROUTE = 128 * 1024 * 1024;

async function exists(path) {
  try { await stat(path); return true; }
  catch (error) { if (error && error.code === 'ENOENT') return false; throw error; }
}

function normalizeSlashes(value) { return value.split(sep).join('/'); }

export function routePath(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  if (/^https?:\/\//iu.test(url)) return null;
  const pathname = url.split(/[?#]/u, 1)[0];
  if (!pathname.startsWith('/')) return null;
  const clean = pathname.replace(/^\/+/u, '');
  if (!clean || clean.includes('\0')) return null;
  const parts = clean.split('/');
  if (parts.some((part) => part === '..' || part === '.')) return null;
  return clean;
}

export function classifyBaselineItem(item) {
  if (item && (item.availability === 'external' || item.sourceKind === 'external')) return 'external';
  if (item && (item.availability === 'inline' || item.sourceKind === 'inline')) return 'inline';
  const path = routePath(item && item.url);
  if (!path) return 'metadata-only';
  if (EXPECTED_AVAILABILITY.has(item && item.availability)) return 'expected-local';
  return 'optional-local';
}

function cleanReference(raw, currentPath) {
  if (!raw || /^(?:[a-z]+:|\/\/|#|data:|blob:)/iu.test(raw)) return null;
  const withoutFragment = raw.split(/[?#]/u, 1)[0];
  if (!withoutFragment) return null;
  const normalized = withoutFragment.startsWith('/')
    ? posix.normalize(withoutFragment.replace(/^\/+/u, ''))
    : posix.normalize(posix.join(posix.dirname(currentPath), withoutFragment));
  if (!normalized || normalized === '..' || normalized.startsWith('../') || posix.isAbsolute(normalized)) return null;
  return normalized;
}

function localReferences(path, contents) {
  const text = contents.toString('utf8');
  const refs = new Set();
  const add = (value) => {
    const ref = cleanReference(value, path);
    if (ref) refs.add(ref);
  };

  if (/\.html?$/iu.test(path)) {
    for (const match of text.matchAll(/\b(?:src|href|poster)=["']([^"']+)["']/giu)) add(match[1]);
    for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/giu)) add(match[1]);
  }
  if (/\.css$/iu.test(path)) {
    for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/giu)) add(match[1]);
  }
  if (/\.(?:m?js)$/iu.test(path)) {
    for (const match of text.matchAll(/(?:from\s*|import\s*\(|fetch\s*\()\s*["']([^"']+)["']/gu)) add(match[1]);
    for (const match of text.matchAll(/new\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url/gu)) add(match[1]);
  }
  return [...refs].sort();
}

async function copyReachableRoute({ sourceRoot, outputRoot, entryPath }) {
  const queue = [entryPath];
  const seen = new Set();
  const files = [];
  const missingReferences = [];
  let bytes = 0;

  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    if (seen.size > MAX_FILES_PER_ROUTE) throw new Error('Route asset graph exceeds file ceiling: ' + entryPath);

    const sourcePath = join(sourceRoot, current);
    if (!(await exists(sourcePath))) {
      if (current !== entryPath) missingReferences.push(current);
      continue;
    }

    const info = await stat(sourcePath);
    if (!info.isFile()) continue;
    bytes += info.size;
    if (bytes > MAX_BYTES_PER_ROUTE) throw new Error('Route asset graph exceeds byte ceiling: ' + entryPath);

    const targetPath = join(outputRoot, current);
    await mkdir(dirname(targetPath), { recursive: true });
    const contents = await readFile(sourcePath);
    await writeFile(targetPath, contents);
    files.push(current);

    for (const ref of localReferences(current, contents)) {
      if (!seen.has(ref)) queue.push(ref);
    }
  }

  return { files: files.sort(), bytes, missingReferences: [...new Set(missingReferences)].sort() };
}

async function stageHubUi(hubRoot, outputRoot) {
  const uiRoot = join(hubRoot, 'src/ui');
  const libRoot = join(hubRoot, 'src/lib');
  let html = await readFile(join(uiRoot, 'index.html'), 'utf8');
  if (!/<link\s+[^>]*rel=["'](?:shortcut\s+)?icon["']/iu.test(html)) {
    html = html.replace('</head>', '  <link rel="icon" href="data:,">\n</head>');
  }
  await writeFile(join(outputRoot, 'index.html'), html);

  const styles = await readFile(join(uiRoot, 'styles.css'));
  await writeFile(join(outputRoot, 'styles.css'), styles);

  let app = await readFile(join(uiRoot, 'app.js'), 'utf8');
  app = app
    .replace("'../lib/discovery.mjs'", "'./lib/discovery.mjs'")
    .replace("'../lib/favorites.mjs'", "'./lib/favorites.mjs'");
  await writeFile(join(outputRoot, 'app.js'), app);

  await mkdir(join(outputRoot, 'lib'), { recursive: true });
  for (const file of ['discovery.mjs', 'favorites.mjs']) {
    const contents = await readFile(join(libRoot, file));
    await writeFile(join(outputRoot, 'lib', file), contents);
  }
}

async function listFiles(root, current = root) {
  if (!(await exists(current))) return [];
  const info = await stat(current);
  if (info.isFile()) return [normalizeSlashes(relative(root, current))];
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, path)));
    else if (entry.isFile()) files.push(normalizeSlashes(relative(root, path)));
  }
  return files.sort();
}

async function fileEvidence(path) {
  const contents = await readFile(path);
  return { bytes: contents.byteLength, sha256: createHash('sha256').update(contents).digest('hex') };
}

async function copyBoundedDirectory(sourceRoot, targetRoot, {
  maxFiles = 2000,
  maxBytes = 256 * 1024 * 1024,
} = {}) {
  const files = await listFiles(sourceRoot);
  if (files.length > maxFiles) {
    throw new Error('Compiled artifact exceeds file ceiling: ' + sourceRoot);
  }
  let bytes = 0;
  for (const file of files) {
    const contents = await readFile(join(sourceRoot, file));
    bytes += contents.byteLength;
    if (bytes > maxBytes) {
      throw new Error('Compiled artifact exceeds byte ceiling: ' + sourceRoot);
    }
    const target = join(targetRoot, file);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
  return { files, bytes };
}

async function gitHead(path) {
  const { stdout } = await execFileAsync('git', ['-C', path, 'rev-parse', 'HEAD'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

function makeHubSelfRecord() {
  return {
    id: 'app-hub-v13.5',
    version: '13.5.0',
    title: 'Artifacts Hub V13.5',
    description: 'Sanitized V12-style portfolio launcher with V13 integrity evidence and complete release parity.',
    kind: 'application',
    status: 'active',
    required: true,
    tags: ['hub', 'catalog', 'launcher', 'v13.5'],
    sourceKind: 'directory',
    gitMode: 'root',
    buildMode: 'assemble',
    releaseKind: 'directory',
    availability: 'verified',
    url: '/index.html',
    launch: { default: 'newWindow', modes: ['newWindow'], sandbox: 'none' },
    git: { revision: null, changedAt: null, basis: 'release-build', path: 'src/ui' },
    changedAt: null,
    receipt: { version: '13.5.0', files: 5, generatedAt: null },
    deployment: { state: 'staged', routePath: 'index.html', sourceKind: 'v13.5-self' },
  };
}

function standardCatalogSummary(items) {
  return {
    total: items.length,
    verified: items.filter((item) => item.availability === 'verified').length,
    provisional: items.filter((item) => item.availability === 'provisional').length,
    external: items.filter((item) => item.availability === 'external').length,
    inline: items.filter((item) => item.availability === 'inline').length,
    sourceOnly: items.filter((item) => item.availability === 'source-only').length,
    active: items.filter((item) => item.status === 'active').length,
    dated: items.filter((item) => item.changedAt).length,
  };
}

async function stageCurrentNativeAdditions({
  baselineItems,
  nativeCatalog,
  nativeManifests = {},
  sourceRoot,
  outputRoot,
  strict,
}) {
  if (!nativeCatalog || !Array.isArray(nativeCatalog.items)) {
    return { items: [], routes: [], missing: [] };
  }

  const baselineIds = new Set(baselineItems.map((item) => item.id));
  const candidates = nativeCatalog.items.filter(
    (item) => !baselineIds.has(item.id) && item.id !== 'app-hub-v13',
  );
  const items = [];
  const routes = [];
  const missing = [];

  for (const item of candidates) {
    const manifest = nativeManifests[item.id] || null;
    if (item.buildMode !== 'compile' || !manifest) {
      missing.push({ id: item.id, reason: 'current-native addition has no supported compile manifest' });
      items.push({
        ...item,
        deployment: { state: 'source-only', routePath: null, sourceKind: 'current-native' },
      });
      continue;
    }

    const sourcePath = join(sourceRoot, manifest.source?.path || item.git?.path || item.id);
    const expectedRevision = manifest.source?.git?.revision || item.git?.revision || null;
    if (expectedRevision && manifest.source?.git?.mode === 'submodule') {
      const actualRevision = await gitHead(sourcePath);
      if (actualRevision !== expectedRevision) {
        throw new Error(
          item.id + ': source revision ' + actualRevision + ' does not match pinned ' + expectedRevision,
        );
      }
    }

    const buildCwd = manifest.build?.cwd || manifest.source?.path || item.id;
    const buildOutput = manifest.build?.output;
    const releaseEntrypoint = manifest.release?.entrypoint || 'index.html';
    const version = manifest.version || item.version || '0.0.0-dev';
    if (!buildOutput) {
      missing.push({ id: item.id, reason: 'compile manifest has no build output' });
      continue;
    }
    const compiledRoot = join(sourceRoot, buildCwd, buildOutput);
    if (!(await exists(join(compiledRoot, releaseEntrypoint)))) {
      missing.push({ id: item.id, reason: 'compiled release output is missing' });
      items.push({
        ...item,
        deployment: { state: 'missing-compiled-output', routePath: null, sourceKind: 'current-native' },
      });
      continue;
    }

    const releaseRoot = join(outputRoot, 'artifacts', item.id, version);
    const staged = await copyBoundedDirectory(compiledRoot, releaseRoot);
    const route = posix.join('artifacts', item.id, version, releaseEntrypoint);
    const deployed = {
      ...item,
      availability: 'verified',
      url: '/' + route,
      receipt: {
        version,
        files: staged.files.length,
        generatedAt: null,
      },
      deployment: {
        state: 'staged',
        routePath: route,
        sourceKind: 'current-native-compiled',
        revision: expectedRevision,
      },
    };
    items.push(deployed);
    routes.push({
      id: item.id,
      url: deployed.url,
      path: route,
      state: 'staged',
      classification: 'current-native',
      sourceKind: 'current-native-compiled',
    });
  }

  if (strict && missing.length) {
    throw new Error(
      'V13.5 current-native superset failed: ' +
      missing.map((entry) => entry.id + ' (' + entry.reason + ')').join(', '),
    );
  }
  return { items, routes, missing };
}

function deploymentRecord(item, state, extra = {}) {
  return {
    id: item.id,
    title: item.title,
    baselineAvailability: item.availability || null,
    url: item.url || null,
    routePath: routePath(item.url),
    classification: classifyBaselineItem(item),
    state,
    ...extra,
  };
}

function queryAssetPath(url) {
  if (typeof url !== 'string' || !url.includes('?')) return null;
  const query = url.slice(url.indexOf('?') + 1);
  const value = new URLSearchParams(query).get('src');
  if (!value) return null;
  const normalized = new URL(value, 'https://v13-5.invalid/').pathname.replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) return null;
  return normalized;
}

async function findSourceRoot(roots, path) {
  for (const candidate of roots) {
    if (await exists(join(candidate.root, path))) return candidate;
  }
  return null;
}

export async function assemblePortfolio({ baseline, sourceRoot, fallbackRoots = [], outputRoot, hubRoot = null, nativeCatalog = null, nativeManifests = {}, strict = true } = {}) {
  if (!baseline || baseline.schemaVersion !== BASELINE_SCHEMA || !Array.isArray(baseline.items)) {
    throw new Error('Expected ' + BASELINE_SCHEMA + ' baseline.');
  }
  const source = resolve(sourceRoot);
  const fallbacks = fallbackRoots.map((entry, index) =>
    typeof entry === 'string'
      ? { root: resolve(entry), kind: 'fallback-' + (index + 1) }
      : { root: resolve(entry.root), kind: entry.kind || ('fallback-' + (index + 1)) },
  );
  const roots = [{ root: source, kind: 'canonical' }, ...fallbacks];
  const output = resolve(outputRoot);
  if (!(await exists(source))) throw new Error('Artifact source root does not exist: ' + source);

  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  const copiedRoutes = new Map();
  const entries = [];

  for (const item of baseline.items) {
    const classification = classifyBaselineItem(item);
    const path = routePath(item.url);
    if (classification === 'external' || classification === 'inline' || classification === 'metadata-only') {
      entries.push(deploymentRecord(item, classification));
      continue;
    }

    const selectedRoot = await findSourceRoot(roots, path);
    if (selectedRoot) {
      const cacheKey = selectedRoot.kind + ':' + path;
      let staged = copiedRoutes.get(cacheKey);
      if (!staged) {
        staged = await copyReachableRoute({ sourceRoot: selectedRoot.root, outputRoot: output, entryPath: path });
        copiedRoutes.set(cacheKey, staged);
      }

      const queryAsset = queryAssetPath(item.url);
      let queryAssetState = null;
      if (queryAsset) {
        const queryRoot = await findSourceRoot(roots, queryAsset);
        if (queryRoot) {
          const queryKey = queryRoot.kind + ':' + queryAsset;
          let queryStage = copiedRoutes.get(queryKey);
          if (!queryStage) {
            queryStage = await copyReachableRoute({ sourceRoot: queryRoot.root, outputRoot: output, entryPath: queryAsset });
            copiedRoutes.set(queryKey, queryStage);
          }
          queryAssetState = { path: queryAsset, sourceKind: queryRoot.kind, staged: await exists(join(output, queryAsset)) };
        } else {
          queryAssetState = { path: queryAsset, sourceKind: null, staged: false };
        }
      }

      const stagedTarget = join(output, path);
      const present = await exists(stagedTarget);
      entries.push(deploymentRecord(item, present ? 'staged' : 'missing-after-copy', {
        sourceKind: selectedRoot.kind,
        sourceTarget: normalizeSlashes(relative(selectedRoot.root, join(selectedRoot.root, path))),
        runtimeFiles: staged.files,
        runtimeBytes: staged.bytes,
        missingReferences: staged.missingReferences,
        queryAsset: queryAssetState,
      }));
      continue;
    }

    entries.push(deploymentRecord(item, classification === 'expected-local' ? 'missing' : 'source-only', {
      reason: item.buildMode === 'compile'
        ? 'compiled artifact requires a build adapter or prebuilt route'
        : 'baseline route is not present in the canonical source tree',
    }));
  }

  const expected = entries.filter((entry) => entry.classification === 'expected-local');
  const missingExpected = expected.filter((entry) => entry.state !== 'staged');
  const stagedExpected = expected.filter((entry) => entry.state === 'staged');
  const meme = entries.find((entry) => entry.id === 'meme-lab') || null;

  const parity = {
    schemaVersion: PARITY_SCHEMA,
    baseline: baseline.source,
    sourceRoot: source,
    summary: {
      catalogItems: entries.length,
      expectedLocal: expected.length,
      stagedExpected: stagedExpected.length,
      missingExpected: missingExpected.length,
      optionalLocal: entries.filter((entry) => entry.classification === 'optional-local').length,
      stagedTotal: entries.filter((entry) => entry.state === 'staged').length,
      runtimeBytes: entries.reduce((sum, entry) => sum + (entry.runtimeBytes || 0), 0),
    },
    regressions: {
      memeLab: {
        required: true,
        presentInBaseline: Boolean(meme),
        staged: Boolean(meme && meme.state === 'staged'),
        route: meme ? meme.routePath : null,
      },
    },
    entries,
  };

  if (hubRoot) await stageHubUi(resolve(hubRoot), output);

  const nativeAdditions = await stageCurrentNativeAdditions({
    baselineItems: baseline.items,
    nativeCatalog,
    nativeManifests,
    sourceRoot: source,
    outputRoot: output,
    strict,
  });

  const deployedBaselineItems = baseline.items
    .filter((item) => item.id !== 'app-hub-v12')
    .map((item) => {
      const entry = entries.find((candidate) => candidate.id === item.id);
      return {
        ...item,
        deployment: { state: entry ? entry.state : 'unknown', routePath: entry ? entry.routePath : null },
      };
    });
  const selfItem = makeHubSelfRecord();
  const deployedItems = [...deployedBaselineItems, selfItem, ...nativeAdditions.items];
  const deploymentCatalog = {
    schemaVersion: 'artifacts-v13.5/catalog-v1',
    generatedAt: new Date().toISOString(),
    baseline: baseline.source,
    summary: {
      ...standardCatalogSummary(deployedItems),
      expectedLocal: parity.summary.expectedLocal,
      stagedExpected: parity.summary.stagedExpected,
      missingExpected: parity.summary.missingExpected,
    },
    superset: {
      replaces: ['app-hub-v12', 'app-hub-v13'],
      self: selfItem.id,
      currentNativeAdded: nativeAdditions.items.map((item) => item.id),
      currentNativeMissing: nativeAdditions.missing,
    },
    items: deployedItems,
  };

  parity.superset = deploymentCatalog.superset;
  parity.summary.finalCatalogItems = deployedItems.length;

  await writeFile(join(output, 'catalog.json'), JSON.stringify(deploymentCatalog, null, 2) + '\n');
  await writeFile(join(output, 'parity-report.json'), JSON.stringify(parity, null, 2) + '\n');

  const routeManifest = {
    schemaVersion: ROUTE_SCHEMA,
    entries: [
      ...entries
        .filter((entry) => entry.id !== 'app-hub-v12')
        .map((entry) => ({
          id: entry.id, url: entry.url, path: entry.routePath, state: entry.state, classification: entry.classification,
        })),
      {
        id: selfItem.id,
        url: selfItem.url,
        path: 'index.html',
        state: 'staged',
        classification: 'current-native',
        sourceKind: 'v13.5-self',
      },
      ...nativeAdditions.routes,
    ],
  };
  await writeFile(join(output, 'route-manifest.json'), JSON.stringify(routeManifest, null, 2) + '\n');

  const files = await listFiles(output);
  const manifestFiles = {};
  for (const file of files) {
    if (file === 'asset-manifest.json') continue;
    manifestFiles[file] = await fileEvidence(join(output, file));
  }
  const assetManifest = { schemaVersion: MANIFEST_SCHEMA, files: manifestFiles };
  await writeFile(join(output, 'asset-manifest.json'), JSON.stringify(assetManifest, null, 2) + '\n');

  if (!parity.regressions.memeLab.presentInBaseline) throw new Error('V12 parity baseline no longer contains Meme Lab.');
  if (!parity.regressions.memeLab.staged) throw new Error('Meme Lab regression: /meme-lab/meme-lab.html was not staged.');
  if (strict && missingExpected.length) {
    const sample = missingExpected.slice(0, 8).map((entry) => entry.id).join(', ');
    const suffix = missingExpected.length > 8 ? ', ...' : '';
    throw new Error('V13.5 strict parity failed: ' + missingExpected.length +
      ' expected V12 local artifacts are unresolved (' + sample + suffix + '). See parity-report.json.');
  }

  return { parity, deploymentCatalog, routeManifest, assetManifest };
}
