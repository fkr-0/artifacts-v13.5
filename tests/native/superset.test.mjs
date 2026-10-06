import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assemblePortfolio } from '../../scripts/portfolio-lib.mjs';

test('final catalog replaces the V12 hub and stages current-native compiled additions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'v13-5-native-'));
  const source = join(root, 'source');
  const output = join(root, 'dist');
  const hub = join(root, 'hub');

  await mkdir(join(source, 'meme-lab'), { recursive: true });
  await writeFile(join(source, 'meme-lab', 'meme-lab.html'), '<title>Meme</title>');
  await mkdir(join(source, 'revealive', 'dist'), { recursive: true });
  await writeFile(join(source, 'revealive', 'dist', 'index.html'), '<title>Revealive</title>');
  await mkdir(join(source, 'quiz'), { recursive: true });
  await writeFile(join(source, 'quiz', 'index.html'), '<title>Quiz</title><script src="app.js"></script>');
  await writeFile(join(source, 'quiz', 'app.js'), 'console.log("quiz");');
  await writeFile(join(source, 'quiz', 'artifact.json'), '{"private":"release metadata"}');

  await mkdir(join(hub, 'src', 'ui'), { recursive: true });
  await mkdir(join(hub, 'src', 'lib'), { recursive: true });
  await writeFile(join(hub, 'src', 'ui', 'index.html'), '<!doctype html><head></head><body>Hub</body>');
  await writeFile(join(hub, 'src', 'ui', 'styles.css'), 'body{}');
  await writeFile(
    join(hub, 'src', 'ui', 'app.js'),
    "import '../lib/discovery.mjs'; import '../lib/favorites.mjs';",
  );
  await writeFile(join(hub, 'src', 'lib', 'discovery.mjs'), 'export {};');
  await writeFile(join(hub, 'src', 'lib', 'favorites.mjs'), 'export {};');

  const baseline = {
    schemaVersion: 'artifacts-v13.5/baseline-v1',
    source: { kind: 'fixture' },
    items: [
      {
        id: 'meme-lab',
        title: 'Meme Lab',
        availability: 'provisional',
        sourceKind: 'directory',
        buildMode: 'none',
        url: '/meme-lab/meme-lab.html',
      },
      {
        id: 'app-hub-v12',
        title: 'Artifacts Hub V12',
        availability: 'source-only',
        sourceKind: 'directory',
        buildMode: 'assemble',
        url: '/apps/app-hub-v12/index.html',
      },
    ],
  };
  const nativeCatalog = {
    items: [
      {
        id: 'revealive',
        version: '0.1.0',
        title: 'Revealive',
        description: 'Presentation studio',
        kind: 'application',
        status: 'experimental',
        required: true,
        tags: ['presentation'],
        sourceKind: 'project',
        gitMode: 'root',
        buildMode: 'compile',
        releaseKind: 'directory',
        availability: 'source-only',
        url: null,
        git: { revision: null, changedAt: null, basis: 'source', path: 'revealive' },
      },
      {
        id: 'quiz',
        version: '0.1.0',
        title: 'Quiz',
        description: 'Static quiz',
        kind: 'application',
        status: 'experimental',
        required: true,
        tags: ['quiz'],
        sourceKind: 'directory',
        gitMode: 'root',
        buildMode: 'none',
        releaseKind: 'directory',
        availability: 'source-only',
        url: '/quiz/index.html',
        git: { revision: null, changedAt: null, basis: 'source', path: 'quiz' },
      },
      {
        id: 'app-hub-v13',
        title: 'Old V13 hub',
        buildMode: 'assemble',
        sourceKind: 'directory',
        availability: 'source-only',
        url: '/src/v13hub/index.html',
      },
    ],
  };
  const nativeManifests = {
    quiz: {
      id: 'quiz',
      version: '0.1.0',
      source: { kind: 'directory', path: 'quiz', git: { mode: 'root' } },
      build: { mode: 'none' },
      release: { entrypoint: 'index.html', exclude: ['artifact.json'] },
      verify: { expectedFiles: ['index.html', 'app.js'] },
    },
    revealive: {
      id: 'revealive',
      version: '0.1.0',
      source: { kind: 'project', path: 'revealive', git: { mode: 'root' } },
      build: { mode: 'compile', cwd: 'revealive', output: 'dist' },
      release: { entrypoint: 'index.html' },
    },
  };

  const result = await assemblePortfolio({
    baseline,
    sourceRoot: source,
    outputRoot: output,
    hubRoot: hub,
    nativeCatalog,
    nativeManifests,
    strict: true,
  });

  const ids = result.deploymentCatalog.items.map((item) => item.id);
  assert.deepEqual(ids.sort(), ['app-hub-v13.5', 'meme-lab', 'quiz', 'revealive'].sort());
  assert.equal(ids.includes('app-hub-v12'), false);
  assert.equal(ids.includes('app-hub-v13'), false);

  const revealive = result.deploymentCatalog.items.find((item) => item.id === 'revealive');
  assert.equal(revealive.availability, 'verified');
  assert.equal(revealive.url, '/artifacts/revealive/0.1.0/index.html');
  assert.match(await readFile(join(output, 'artifacts/revealive/0.1.0/index.html'), 'utf8'), /Revealive/);

  const quiz = result.deploymentCatalog.items.find((item) => item.id === 'quiz');
  assert.equal(quiz.availability, 'verified');
  assert.equal(quiz.url, '/artifacts/quiz/0.1.0/index.html');
  assert.match(await readFile(join(output, 'artifacts/quiz/0.1.0/app.js'), 'utf8'), /quiz/);
  await assert.rejects(
    readFile(join(output, 'artifacts/quiz/0.1.0/artifact.json'), 'utf8'),
    { code: 'ENOENT' },
  );

  const self = result.deploymentCatalog.items.find((item) => item.id === 'app-hub-v13.5');
  assert.equal(self.url, '/index.html');
  assert.equal(self.availability, 'verified');
});
