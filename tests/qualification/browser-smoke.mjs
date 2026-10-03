#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] || 'dist');

function contentType(path) {
  return new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.md', 'text/markdown; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png'],
    ['.gif', 'image/gif'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
  ]).get(extname(path).toLowerCase()) || 'application/octet-stream';
}

function makeStaticServer() {
  return createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://local.invalid').pathname);
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const target = resolve(root, relative);
      if (target !== root && !target.startsWith(root + sep)) throw new Error('forbidden');
      const info = await stat(target);
      if (!info.isFile()) throw new Error('not-file');
      response.writeHead(200, {
        'Content-Type': contentType(target),
        'Content-Length': info.size,
        'Cache-Control': 'no-store',
      });
      createReadStream(target).pipe(response);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
    }
  });
}

function listenEphemeral(server) {
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolveListen(server.address().port));
  });
}

async function freePort() {
  const server = createNetServer();
  const port = await listenEphemeral(server);
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

function findChromium() {
  if (process.env.CHROMIUM_BIN) return process.env.CHROMIUM_BIN;
  for (const command of ['chromium', 'chromium-browser', 'google-chrome']) {
    try {
      return execFileSync('sh', ['-lc', 'command -v ' + command], { encoding: 'utf8' }).trim();
    } catch {}
  }
  throw new Error('No Chromium binary found. Set CHROMIUM_BIN.');
}

async function waitForJson(url, attempts = 80) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      last = new Error(response.status + ' ' + response.statusText);
    } catch (error) {
      last = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw last || new Error('Timed out waiting for ' + url);
}

function connectCdp(url) {
  const ws = new WebSocket(url);
  let nextId = 1;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const callbacks = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) callbacks.reject(new Error(message.error.message));
      else callbacks.resolve(message.result);
      return;
    }
    events.push(message);
  });
  return {
    ws,
    events,
    ready: new Promise((resolveReady, reject) => {
      ws.addEventListener('open', resolveReady, { once: true });
      ws.addEventListener('error', reject, { once: true });
    }),
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolveSend, reject) => {
        pending.set(id, { resolve: resolveSend, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Runtime evaluation failed');
  return result.result.value;
}

async function pollValue(cdp, expression, predicate, attempts = 80) {
  let value;
  for (let i = 0; i < attempts; i += 1) {
    value = await evaluate(cdp, expression);
    if (predicate(value)) return value;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error('Timed out waiting for browser condition; last value=' + JSON.stringify(value));
}

const server = makeStaticServer();
const port = await listenEphemeral(server);
const origin = 'http://127.0.0.1:' + port;
const debugPort = await freePort();
const profile = await mkdtemp(tmpdir() + '/v13-5-chromium-');
const chromium = spawn(findChromium(), [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--remote-debugging-address=127.0.0.1',
  '--remote-debugging-port=' + debugPort,
  '--user-data-dir=' + profile,
  origin + '/',
], { stdio: ['ignore', 'ignore', 'pipe'] });

try {
  const targets = await waitForJson('http://127.0.0.1:' + debugPort + '/json/list');
  const page = targets.find((target) => target.type === 'page');
  assert.ok(page && page.webSocketDebuggerUrl, 'Chromium page target should be available');

  const cdp = connectCdp(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Log.enable');

  const cards = await pollValue(
    cdp,
    'document.querySelectorAll(".artifact-card").length',
    (value) => Number(value) >= 44,
  );
  assert.ok(cards >= 44, 'launcher should render the restored portfolio');

  const filtered = await evaluate(
    cdp,
    "(() => { const search = document.querySelector('#search'); search.value = 'meme lab'; search.dispatchEvent(new Event('input', { bubbles: true })); return [...document.querySelectorAll('.artifact-card')].map((node) => node.dataset.artifactId); })()",
  );
  assert.deepEqual(filtered, ['meme-lab']);

  const href = await evaluate(cdp, "document.querySelector('[data-artifact-id=\"meme-lab\"] .open').href");
  assert.equal(href, origin + '/meme-lab/meme-lab.html');

  const hubErrors = cdp.events.filter((event) =>
    event.method === 'Runtime.exceptionThrown' ||
    (event.method === 'Log.entryAdded' && event.params && event.params.entry && event.params.entry.level === 'error')
  );
  assert.equal(hubErrors.length, 0, 'hub should load without browser runtime errors: ' + JSON.stringify(hubErrors.map((event) => event.params)));

  await cdp.send('Page.navigate', { url: href });
  const pathname = await pollValue(cdp, 'location.pathname', (value) => value === '/meme-lab/meme-lab.html');
  assert.equal(pathname, '/meme-lab/meme-lab.html');

  cdp.ws.close();
  console.log('browser-smoke: launcher rendered ' + cards + ' artifacts, search found Meme Lab, Open route navigated successfully');
} finally {
  chromium.kill('SIGTERM');
  await new Promise((resolveClose) => server.close(resolveClose));
}
