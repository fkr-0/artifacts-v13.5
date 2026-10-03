import {
  filterArtifacts,
  normalizeArtifact,
  resolveCatalogFetchUrl,
  summarizeCatalog,
  uniqueFacetValues,
  validateCatalogDocument,
  validateCatalogResponseUrl,
} from './lib/catalog.js';
import {
  collectionRecordKeys,
  createCollectionStore,
  parseLocalArtifactDocument,
  reconcileCollection,
} from './lib/collection.js';
import { buildEvidenceLadder, collectTopicFacets } from './lib/discovery.js';
import { restoreInspectorOriginFocus } from './lib/navigation.js';
import {
  createPeerSessionRuntime,
  normalizePeerRuntime,
  peerCollectionReadiness,
} from './lib/peer.js';
import { interactionPolicy } from './lib/policy.js';
import { resolveCatalogUrl } from './lib/routes.js';
import { initialHubState, reduceHubState } from './lib/state.js';

const startedAt = performance.now();
const baseOrigin =
  window.location.origin === 'null' ? 'https://v13hub.invalid' : window.location.origin;
let storage = null;
try {
  storage = window.localStorage;
} catch {
  storage = null;
}
const collectionStore = createCollectionStore({ storage });
// The peer stack is lazy: no module load, signalling, or connection begins until create/join is clicked.
const peerSession = createPeerSessionRuntime();
let peerRuntime = normalizePeerRuntime(peerSession);

let state = { ...initialHubState };
let catalogDocument = { items: [], build: {}, summary: {}, generatedAt: null };
let catalogItems = [];
let allItems = [];
let collection = collectionStore.snapshot();
let toastTimer = null;
let inspectorWasOpen = false;

const nodes = Object.fromEntries(
  [
    'catalog',
    'empty',
    'search',
    'kind-filter',
    'availability-filter',
    'evidence-filter',
    'origin-filter',
    'capability-filter',
    'sort-filter',
    'reset-filters',
    'result-summary',
    'inspector',
    'inspector-backdrop',
    'inspector-title',
    'inspector-content',
    'close-inspector',
    'nav-collection-count',
    'nav-peer-count',
    'peer-runtime',
    'peer-proof',
    'peer-proof-detail',
    'peer-recovery',
    'peer-recovery-detail',
    'peer-create',
    'peer-join-code',
    'peer-join',
    'peer-leave',
    'peer-session-state',
    'peer-session-id',
    'peer-created-invite',
    'peer-copy-invite',
    'peer-target',
    'peer-presence',
    'peer-offers',
    'peer-game-select',
    'peer-game-max',
    'peer-host-game',
    'peer-game-count',
    'peer-game-sessions',
    'peer-chat-log',
    'peer-chat-form',
    'peer-chat-input',
    'peer-chat-send',
    'evidence-ladder',
    'topic-filters',
    'tag-mode-any',
    'tag-mode-all',
    'clear-topics',
    'catalog-trust',
    'catalog-built',
    'stat-total',
    'stat-revision',
    'stat-peer',
    'stat-receipt',
    'collection-copy',
    'collection-access',
    'import-trigger',
    'local-import',
    'export-collection',
    'clear-collection',
    'import-review',
    'import-review-copy',
    'import-review-items',
    'confirm-import',
    'cancel-import',
    'runtime-footer',
    'toast',
  ].map((id) => [id, document.getElementById(id)]),
);

function dispatch(action) {
  state = reduceHubState(state, action);
  syncControls();
  render();
}

function closeInspectorAndRestoreFocus() {
  const selectedKey = state.selectedKey;
  dispatch({ type: 'close-inspector' });
  restoreInspectorOriginFocus(nodes.catalog, selectedKey);
}

function textNode(tag, text, className = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text;
  return node;
}

function formatDate(value, { withTime = false } = {}) {
  if (!value || Number.isNaN(Date.parse(value))) return 'unknown';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value));
}

function shortRevision(value) {
  return value ? String(value).slice(0, 12) : 'none recorded';
}

function policyFor(item) {
  const resolved = item.url ? resolveCatalogUrl(item.url, window.location.href) : null;
  return interactionPolicy({ ...item, url: resolved }, { baseOrigin });
}

function showToast(message) {
  const assertive = /failed|rejected|blocked|unavailable|error/i.test(message);
  nodes.toast.setAttribute('role', assertive ? 'alert' : 'status');
  nodes.toast.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  nodes.toast.textContent = message;
  nodes.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    nodes.toast.hidden = true;
  }, 3600);
}

function collectionKeys() {
  return collectionRecordKeys(collection);
}

function rebuildItems() {
  const imports = (collection.imports || []).map((entry) =>
    normalizeArtifact(entry.artifact, {
      recordKey: entry.recordKey,
      origin: 'import',
      sourceLabel: entry.sourceName,
    }),
  );
  allItems = [...catalogItems, ...imports];
}

function refreshCollection() {
  collection = collectionStore.snapshot();
  rebuildItems();
}

function fillSelect(node, values, firstLabel) {
  const current = node.value;
  const first = document.createElement('option');
  first.value = '';
  first.textContent = firstLabel;
  const options = values.map((value) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    return option;
  });
  node.replaceChildren(first, ...options);
  node.value = values.includes(current) ? current : '';
}

function refreshFacets() {
  fillSelect(nodes['kind-filter'], uniqueFacetValues(allItems, 'kind'), 'All kinds');
  fillSelect(
    nodes['availability-filter'],
    uniqueFacetValues(allItems, 'availability'),
    'All states',
  );
  fillSelect(
    nodes['evidence-filter'],
    [...new Set(allItems.map((item) => item.health?.evidenceLevel).filter(Boolean))].sort(),
    'All evidence',
  );
}

function syncControls() {
  nodes.search.value = state.query;
  nodes['kind-filter'].value = state.kind;
  nodes['availability-filter'].value = state.availability;
  nodes['evidence-filter'].value = state.evidence;
  nodes['origin-filter'].value = state.origin;
  nodes['capability-filter'].value = state.capabilitySource;
  nodes['sort-filter'].value = state.sort;
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('[data-lens]').forEach((button) => {
    const active = button.dataset.lens === state.lens;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderDiscoveryDeck() {
  const ladder = buildEvidenceLadder(allItems, peerRuntime);
  nodes['evidence-ladder'].replaceChildren(
    ...ladder.stages.map((stage) => {
      const item = document.createElement('div');
      item.className = 'evidence-stage';
      item.dataset.stage = stage.id;
      item.append(
        textNode('strong', String(stage.count)),
        textNode('span', stage.label),
        textNode('small', stage.unit),
      );
      return item;
    }),
  );

  const selected = new Set(state.selectedTags || []);
  nodes['topic-filters'].replaceChildren(
    ...collectTopicFacets(allItems).map(({ tag, count }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'topic-chip';
      button.dataset.tag = tag;
      const active = selected.has(tag);
      button.setAttribute('aria-pressed', String(active));
      button.append(textNode('span', tag), textNode('strong', String(count)));
      button.addEventListener('click', () => dispatch({ type: 'toggle-tag', value: tag }));
      return button;
    }),
  );
  nodes['tag-mode-any'].setAttribute('aria-pressed', String(state.tagMode === 'any'));
  nodes['tag-mode-all'].setAttribute('aria-pressed', String(state.tagMode === 'all'));
  nodes['clear-topics'].disabled = selected.size === 0;
}

function lobbyGameCandidates() {
  return catalogItems
    .filter((item) => item.tags.some((tag) => tag.toLowerCase() === 'game'))
    .filter((item) => policyFor(item).launch === 'user-requested-local')
    .sort((left, right) => left.title.localeCompare(right.title));
}

function gameLaunchUrl(gameSession, handoff) {
  const item = catalogItems.find((candidate) => candidate.id === gameSession.gameId);
  if (!item) return null;
  const policy = policyFor(item);
  if (policy.launch !== 'user-requested-local' || !policy.target?.url) return null;
  const target = new URL(policy.target.url);
  target.searchParams.set('v13hub-handoff', handoff.protocol);
  target.searchParams.set('v13hub-game-session', handoff.gameSessionId);
  target.searchParams.set('v13hub-peer-session', handoff.transportSessionId);
  target.searchParams.set('v13hub-peer-node', handoff.nodeId);
  target.searchParams.set('v13hub-peer-host', handoff.hostNodeId);
  return target.href;
}

async function joinAndLaunchGame(gameSession) {
  const pendingWindow = window.open('', '_blank');
  if (pendingWindow) {
    pendingWindow.opener = null;
    pendingWindow.document.title = 'Joining V13 lobby…';
    pendingWindow.document.body.textContent = 'Joining the peer game session…';
  }
  try {
    await peerSession.joinGame(gameSession.gameSessionId);
    const handoff = await peerSession.waitForGameHandoff(gameSession.gameSessionId);
    const target = gameLaunchUrl(gameSession, handoff);
    if (!target) throw new Error('No trusted local launch target is available for this game.');
    if (pendingWindow) {
      pendingWindow.location.replace(target);
      showToast(`Joined ${gameSession.title}; launching with the existing peer session.`);
    } else {
      showToast(`Joined ${gameSession.title}. Popup blocked; use Launch to open the game.`);
    }
  } catch (error) {
    if (pendingWindow) pendingWindow.close();
    showToast(`Game join failed: ${error.message}`);
  }
}

function renderPeerSession() {
  const snapshot = peerSession.snapshot();
  const busy = snapshot.state === 'connecting' || snapshot.state === 'reconnecting';
  const online = snapshot.connected === true;

  nodes['peer-session-state'].textContent = snapshot.degradedReason
    ? `${snapshot.state} · degraded`
    : snapshot.state;
  nodes['peer-session-id'].textContent = snapshot.sessionId || 'No session';
  nodes['peer-created-invite'].textContent =
    snapshot.invitation ||
    (online
      ? 'Joined by invitation; capability remains local.'
      : 'Create a session to issue an invitation.');
  nodes['peer-create'].disabled = busy || online;
  nodes['peer-join'].disabled = busy || online;
  nodes['peer-join-code'].disabled = busy || online;
  nodes['peer-leave'].disabled = !online && snapshot.state === 'idle';
  nodes['peer-copy-invite'].disabled = !snapshot.invitation;

  const currentTarget = nodes['peer-target'].value;
  const options = [new Option('No negotiated peer', '')];
  for (const nodeId of snapshot.capablePeers) {
    options.push(new Option(nodeId === currentTarget ? `${nodeId} · selected` : nodeId, nodeId));
  }
  nodes['peer-target'].replaceChildren(...options);
  nodes['peer-target'].value = snapshot.capablePeers.includes(currentTarget)
    ? currentTarget
    : snapshot.capablePeers[0] || '';

  nodes['peer-presence'].replaceChildren(
    ...(snapshot.participants.length
      ? snapshot.participants.map((participant) =>
          textNode(
            'li',
            `${participant.self ? 'you · ' : ''}${participant.nodeId} · ${participant.capabilities.length} capabilities${participant.latencyMs == null || participant.self ? '' : ` · ${participant.latencyMs} ms`}`,
          ),
        )
      : [textNode('li', 'No live presence evidence.')]),
  );
  nodes['peer-offers'].replaceChildren(
    ...(snapshot.pendingOffers.length
      ? snapshot.pendingOffers
          .slice(-4)
          .reverse()
          .map(({ from, offer }) =>
            textNode(
              'li',
              `${offer.artifactId} from ${from} · expires ${formatDate(offer.expiresAt, { withTime: true })}`,
            ),
          )
      : [textNode('li', 'No validated inbound artifact offers.')]),
  );

  const games = lobbyGameCandidates();
  const selectedGame = nodes['peer-game-select'].value;
  nodes['peer-game-select'].replaceChildren(
    ...(games.length
      ? games.map((game) => new Option(game.title, game.id))
      : [new Option('No local game target', '')]),
  );
  if (games.some((game) => game.id === selectedGame))
    nodes['peer-game-select'].value = selectedGame;
  nodes['peer-game-select'].disabled = !online || games.length === 0;
  nodes['peer-game-max'].disabled = !online;
  nodes['peer-host-game'].disabled = !online || games.length === 0;

  nodes['peer-game-count'].textContent =
    `${snapshot.gameSessions.length} advertised · ${snapshot.gameSessions.reduce((count, session) => count + session.players.length, 0)} players`;
  nodes['peer-game-sessions'].replaceChildren(
    ...(snapshot.gameSessions.length
      ? snapshot.gameSessions.map((gameSession) => {
          const card = document.createElement('article');
          card.className = 'peer-game-card';
          const copy = document.createElement('div');
          copy.className = 'peer-game-copy';
          copy.append(
            textNode('strong', gameSession.title),
            textNode(
              'span',
              `${gameSession.players.length}/${gameSession.maxPlayers} players · host ${gameSession.hostNodeId}`,
            ),
          );
          const actions = document.createElement('div');
          actions.className = 'peer-game-actions';
          const isHost = gameSession.hostNodeId === snapshot.nodeId;
          const isMember = gameSession.players.includes(snapshot.nodeId);
          if (isMember) {
            const launch = textNode('button', 'Launch', 'primary-button');
            launch.type = 'button';
            launch.addEventListener('click', () => {
              const handoff = peerSession.gameHandoffFor(gameSession.gameSessionId);
              const target = handoff ? gameLaunchUrl(gameSession, handoff) : null;
              if (!target) {
                showToast('Game launch blocked: no trusted local handoff target is available.');
                return;
              }
              window.open(target, '_blank', 'noopener,noreferrer');
            });
            actions.append(launch);
          } else {
            const join = textNode(
              'button',
              gameSession.players.length >= gameSession.maxPlayers ? 'Full' : 'Join & launch',
              'primary-button',
            );
            join.type = 'button';
            join.disabled = gameSession.players.length >= gameSession.maxPlayers;
            join.addEventListener('click', () => joinAndLaunchGame(gameSession));
            actions.append(join);
          }
          if (isHost || isMember) {
            const leave = textNode('button', isHost ? 'Close' : 'Leave', 'quiet-button');
            leave.type = 'button';
            leave.addEventListener('click', async () => {
              try {
                await peerSession.leaveGame(gameSession.gameSessionId);
                showToast(isHost ? 'Hosted game closed.' : 'Left game session.');
              } catch (error) {
                showToast(`Game leave failed: ${error.message}`);
              }
            });
            actions.append(leave);
          }
          card.append(copy, actions);
          return card;
        })
      : [
          textNode(
            'p',
            online ? 'No games advertised yet.' : 'Join a peer session to discover hosted games.',
            'peer-empty',
          ),
        ]),
  );

  nodes['peer-chat-input'].disabled = !online;
  nodes['peer-chat-send'].disabled = !online;
  nodes['peer-chat-log'].replaceChildren(
    ...(snapshot.chatMessages.length
      ? snapshot.chatMessages.map((message) => {
          const item = document.createElement('li');
          item.append(
            textNode('strong', message.self ? 'you' : message.from),
            textNode('span', message.text),
          );
          return item;
        })
      : [textNode('li', 'No lobby messages yet.')]),
  );
}

function renderHeader() {
  const summary = summarizeCatalog(catalogItems);
  nodes['stat-total'].textContent = summary.total;
  nodes['stat-revision'].textContent = summary.withRevision;
  nodes['stat-peer'].textContent = summary.peerAware;
  nodes['stat-receipt'].textContent = summary.withReceipt;
  nodes['nav-peer-count'].textContent = summary.peerAware;
  nodes['catalog-trust'].textContent = catalogDocument.schemaVersion || 'Catalog loaded';
  nodes['catalog-built'].textContent = catalogDocument.generatedAt
    ? `generated ${formatDate(catalogDocument.generatedAt, { withTime: true })}`
    : 'Generation time not recorded';
  nodes['peer-runtime'].lastChild.textContent = peerRuntime.label;
  nodes['peer-proof'].textContent = peerRuntime.proof ? peerRuntime.label : 'None';
  nodes['peer-proof-detail'].textContent = peerRuntime.reason;
  const telemetry = peerRuntime.telemetry || {};
  const recoverySignals = [
    telemetry.queuedOutbound != null ? `queue ${telemetry.queuedOutbound}` : null,
    telemetry.pendingOutbound != null ? `pending ${telemetry.pendingOutbound}` : null,
    telemetry.reconnectAttempts != null ? `reconnects ${telemetry.reconnectAttempts}` : null,
    telemetry.backpressureSignals != null ? `backpressure ${telemetry.backpressureSignals}` : null,
  ].filter(Boolean);
  nodes['peer-recovery'].textContent = recoverySignals.length
    ? recoverySignals.join(' · ')
    : 'Not reported';
  nodes['peer-recovery-detail'].textContent = recoverySignals.length
    ? 'Adapter-supplied transport diagnostics; acceptance still does not prove peer delivery.'
    : 'Queue, reconnect and backpressure telemetry require an injected peer adapter.';
}

function renderCollectionSummary() {
  const saved = collectionKeys().size;
  const reconciliation = reconcileCollection(collection, catalogItems);
  const missing = reconciliation.missingPinnedIds.length;
  const collectionStatus = collectionStore.status();
  nodes['nav-collection-count'].textContent = saved;
  nodes['collection-copy'].textContent = !collectionStatus.available
    ? 'Browser storage is unavailable; collection changes are disabled.'
    : collectionStatus.permitted
      ? saved
        ? `${saved} saved record${saved === 1 ? '' : 's'} · ${reconciliation.importCount} local import${reconciliation.importCount === 1 ? '' : 's'}${missing ? ` · ${missing} unavailable catalog reference${missing === 1 ? '' : 's'}` : ''}.`
        : 'Persistence enabled · no saved records yet.'
      : 'Persistence off · browsing does not write collection state.';
  nodes['collection-access'].textContent = collectionStatus.permitted
    ? 'Disable & clear'
    : 'Enable saving';
  nodes['collection-access'].disabled = !collectionStatus.available;
  nodes['import-trigger'].disabled = !collectionStatus.permitted;
  nodes['export-collection'].disabled = !collectionStatus.permitted || saved === 0;
  nodes['clear-collection'].disabled = !collectionStatus.permitted || saved === 0;
}

function renderImportReview() {
  const pending = state.pendingImport;
  nodes['import-review'].hidden = !pending;
  nodes['import-review-items'].replaceChildren();
  if (!pending) return;
  const count = pending.items.length;
  nodes['import-review-copy'].textContent =
    `${pending.sourceName} contains ${count} metadata record${count === 1 ? '' : 's'}. Nothing has been persisted yet.`;
  const visible = pending.items.slice(0, 8);
  nodes['import-review-items'].append(
    ...visible.map((item) => textNode('li', `${item.id} · ${item.title}`)),
  );
  if (count > visible.length) {
    nodes['import-review-items'].append(
      textNode(
        'li',
        `…and ${count - visible.length} more record${count - visible.length === 1 ? '' : 's'}.`,
      ),
    );
  }
}

function cardFor(item) {
  const card = document.createElement('article');
  card.className = 'artifact-card';
  card.dataset.health = item.health.state;
  card.dataset.origin = item.recordOrigin;

  const topline = document.createElement('div');
  topline.className = 'artifact-topline';
  topline.append(
    textNode(
      'span',
      item.recordOrigin === 'import' ? `LOCAL · ${item.sourceLabel || 'file'}` : item.health.label,
    ),
    textNode('span', item.kind || 'record'),
  );

  const title = textNode('h3', item.title);
  const description = textNode(
    'p',
    item.description || 'No description supplied.',
    'artifact-description',
  );
  const meta = document.createElement('div');
  meta.className = 'artifact-meta';
  meta.append(
    textNode(
      'span',
      item.provenance.revision ? `rev ${shortRevision(item.provenance.revision)}` : 'no revision',
    ),
    textNode('span', item.changedAt ? formatDate(item.changedAt) : 'date unknown'),
  );
  if (item.peerAware) {
    const basis =
      item.capabilityProfile.source === 'declared-peer' ? 'declared peer' : 'legacy peer tag';
    meta.append(textNode('span', `${basis} · ${item.peerSignals.join('/')}`, 'peer-signal'));
  }
  if (item.provenance.receiptPresent) meta.append(textNode('span', 'receipt present', 'receipt'));

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const inspect = textNode('button', 'Inspect');
  inspect.type = 'button';
  inspect.dataset.inspectKey = item.recordKey;
  inspect.addEventListener('click', () => dispatch({ type: 'select', value: item.recordKey }));
  const collect = textNode(
    'button',
    item.recordOrigin === 'catalog'
      ? collectionStore.isPinned(item.id)
        ? 'Saved'
        : 'Save'
      : 'Remove',
    'collect',
  );
  collect.type = 'button';
  collect.disabled = !collectionStore.status().permitted;
  if (item.recordOrigin === 'catalog') {
    const saved = collectionStore.isPinned(item.id);
    collect.setAttribute('aria-pressed', String(saved));
    collect.setAttribute(
      'aria-label',
      saved
        ? `Remove ${item.title} from local collection`
        : `Save ${item.title} to local collection`,
    );
    if (collect.disabled) collect.textContent = 'Enable to save';
    if (saved) collect.classList.add('is-saved');
  } else {
    collect.setAttribute('aria-label', `Remove ${item.title} from local collection`);
  }
  collect.addEventListener('click', () => {
    try {
      if (item.recordOrigin === 'catalog') collectionStore.togglePinned(item.id);
      else collectionStore.removeImport(item.recordKey);
      refreshCollection();
      if (!allItems.some((candidate) => candidate.recordKey === state.selectedKey))
        state = reduceHubState(state, { type: 'close-inspector' });
      render();
    } catch (error) {
      refreshCollection();
      render();
      showToast(`Collection change not persisted: ${error.message}`);
    }
  });
  actions.append(inspect, collect);

  card.append(topline, title, description, meta, actions);
  return card;
}

function evidenceRow(label, value) {
  const row = document.createElement('div');
  row.className = 'evidence-row';
  row.append(
    textNode('span', label, 'evidence-label'),
    textNode('span', value || 'not recorded', 'evidence-value'),
  );
  return row;
}

function launchControls(item, policy) {
  const wrap = document.createElement('div');
  wrap.className = 'inspector-actions';

  if (policy.launch === 'user-requested-local') {
    const link = textNode('a', 'Launch local', 'primary');
    link.href = policy.target.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    wrap.append(link);
  } else if (policy.launch === 'confirm-remote') {
    const button = textNode('button', 'Open remote…', 'primary');
    button.type = 'button';
    button.addEventListener('click', () => {
      const ok = window.confirm(
        `Open this remote target in a new window?\n\n${policy.target.url}\n\nV13Hub has not fetched or verified its current contents.`,
      );
      if (ok) window.open(policy.target.url, '_blank', 'noopener,noreferrer');
    });
    wrap.append(button);
  } else {
    const disabled = textNode('button', 'No launch target');
    disabled.type = 'button';
    disabled.disabled = true;
    wrap.append(disabled);
  }

  if (policy.preview === 'user-requested-strict-sandbox') {
    const preview = textNode(
      'button',
      state.previewKey === item.recordKey ? 'Preview loaded' : 'Strict preview',
    );
    preview.type = 'button';
    preview.disabled = state.previewKey === item.recordKey;
    preview.addEventListener('click', () => dispatch({ type: 'preview', value: item.recordKey }));
    wrap.append(preview);
  } else {
    const blocked = textNode('button', 'Preview blocked');
    blocked.type = 'button';
    blocked.disabled = true;
    wrap.append(blocked);
  }
  return wrap;
}

function renderInspector() {
  const item = allItems.find((candidate) => candidate.recordKey === state.selectedKey);
  if (!item) {
    nodes.inspector.hidden = true;
    nodes['inspector-backdrop'].hidden = true;
    document.body.classList.remove('inspector-open');
    inspectorWasOpen = false;
    nodes['inspector-content'].replaceChildren();
    return;
  }

  nodes.inspector.hidden = false;
  nodes['inspector-backdrop'].hidden = false;
  document.body.classList.add('inspector-open');
  nodes['inspector-title'].textContent = item.title;
  const content = document.createDocumentFragment();
  content.append(
    textNode('p', item.description || 'No description supplied.', 'inspector-description'),
  );

  const health = document.createElement('div');
  health.className = 'health-line';
  health.append(
    textNode('span', item.health.label, `pill ${item.health.state === 'verified' ? 'local' : ''}`),
  );
  health.append(textNode('span', item.health.evidenceLevel, 'pill'));
  if (item.peerAware) {
    const basis =
      item.capabilityProfile.source === 'declared-peer'
        ? 'declared capability'
        : 'legacy tag signal';
    health.append(textNode('span', `${basis} · ${item.peerSignals.join('/')}`, 'pill peer'));
  }
  if (item.recordOrigin === 'import') health.append(textNode('span', 'local import', 'pill local'));
  content.append(health);

  const evidence = document.createElement('div');
  evidence.className = 'evidence-block';
  evidence.append(
    evidenceRow('artifact id', item.id),
    evidenceRow(
      'origin',
      item.recordOrigin === 'import' ? `local file: ${item.sourceLabel}` : 'generated catalog',
    ),
    evidenceRow('source kind', item.provenance.sourceKind),
    evidenceRow('git basis', item.provenance.gitBasis),
    evidenceRow('revision', item.provenance.revision || 'none recorded'),
    evidenceRow('source path', item.provenance.path),
    evidenceRow(
      'changed',
      item.provenance.changedAt
        ? formatDate(item.provenance.changedAt, { withTime: true })
        : 'unknown',
    ),
    evidenceRow(
      'receipt',
      item.provenance.receiptPresent ? 'present in catalog metadata' : 'none recorded',
    ),
    evidenceRow(
      'peer basis',
      item.capabilityProfile.source === 'declared-peer'
        ? `declared capabilities: ${item.capabilityProfile.declaredPeer.join(', ')}`
        : item.capabilityProfile.source === 'legacy-peer'
          ? `legacy tags only: ${item.capabilityProfile.legacyPeerSignals.join(', ')}`
          : 'none recorded',
    ),
  );
  content.append(evidence);

  if (item.tags.length) {
    const tags = document.createElement('div');
    tags.className = 'tag-list';
    item.tags.forEach((tag) => {
      tags.append(textNode('span', `#${tag}`, 'tag'));
    });
    content.append(tags);
  }

  const readiness = peerCollectionReadiness(item, peerRuntime);
  const peerBlock = document.createElement('section');
  peerBlock.className = 'peer-readiness';
  peerBlock.append(
    textNode('p', 'PEER COLLECTION / GATES', 'panel-index'),
    textNode(
      'h3',
      readiness.eligibleForOffer ? 'Eligible to request an offer' : 'Peer collection blocked',
    ),
  );
  for (const gate of readiness.gates) {
    const row = document.createElement('div');
    row.className = `gate-row ${gate.passed ? 'is-pass' : 'is-blocked'}`;
    row.append(
      textNode('span', gate.passed ? 'PASS' : 'BLOCK', 'gate-state'),
      textNode('strong', gate.label),
      textNode('small', gate.detail),
    );
    peerBlock.append(row);
  }
  peerBlock.append(textNode('p', readiness.note, 'inspector-note'));
  if (readiness.eligibleForOffer) {
    const handoff = textNode('button', 'Offer descriptor to selected peer', 'primary-button');
    handoff.type = 'button';
    handoff.disabled = !nodes['peer-target'].value;
    handoff.addEventListener('click', async () => {
      const target = nodes['peer-target'].value;
      if (!target) return;
      handoff.disabled = true;
      try {
        const { receipt } = await peerSession.offerArtifact(item, target);
        showToast(
          `Offer accepted by lobby as sequence ${receipt.sequence}; this is not byte-delivery proof.`,
        );
      } catch (error) {
        showToast(`Peer handoff blocked: ${error.message}`);
      } finally {
        render();
      }
    });
    peerBlock.append(handoff);
  }
  content.append(peerBlock);

  const policy = policyFor(item);
  content.append(launchControls(item, policy));
  content.append(textNode('p', policy.reason, 'inspector-note'));

  if (state.previewKey === item.recordKey && policy.preview === 'user-requested-strict-sandbox') {
    const shell = document.createElement('div');
    shell.className = 'preview-shell';
    shell.append(
      textNode('header', 'STRICT LOCAL PREVIEW · scripts/forms/popups/storage disabled'),
    );
    const frame = document.createElement('iframe');
    frame.title = `Strict preview of ${item.title}`;
    frame.setAttribute('sandbox', '');
    frame.referrerPolicy = 'no-referrer';
    frame.loading = 'lazy';
    frame.src = policy.target.url;
    shell.append(frame);
    content.append(shell);
  }

  nodes['inspector-content'].replaceChildren(content);
  if (!inspectorWasOpen) {
    inspectorWasOpen = true;
    queueMicrotask(() => nodes['close-inspector'].focus());
  }
}

function render() {
  renderCollectionSummary();
  renderImportReview();
  renderPeerSession();
  renderDiscoveryDeck();
  const keys = collectionKeys();
  const visible = filterArtifacts(allItems, { ...state, collectionKeys: keys });
  nodes.catalog.classList.toggle('is-list', state.view === 'list');
  nodes.catalog.replaceChildren(...visible.map(cardFor));
  nodes.catalog.setAttribute('aria-busy', 'false');
  nodes.empty.hidden = visible.length !== 0;

  const lensLabel =
    state.lens === 'collection'
      ? 'local collection'
      : state.lens === 'peer'
        ? 'peer-aware metadata'
        : 'catalog';
  const topicSuffix = state.selectedTags?.length
    ? ` · ${state.selectedTags.length} topic${state.selectedTags.length === 1 ? '' : 's'} (${state.tagMode})`
    : '';
  nodes['result-summary'].textContent =
    `${visible.length} shown / ${allItems.length} known · ${lensLabel}${topicSuffix} · remote previews fail closed`;
  renderInspector();
  nodes['runtime-footer'].textContent =
    `${catalogItems.length} catalog records · ${collection.imports?.length || 0} local imports · ${peerRuntime.label} · UI ${Math.max(0, Math.round(performance.now() - startedAt))} ms`;
}

async function loadCatalog() {
  const candidates = ['./catalog.json'];
  let lastError = null;
  for (const url of candidates) {
    try {
      const requestUrl = resolveCatalogFetchUrl(url, { currentHref: globalThis.location.href });
      const response = await fetch(requestUrl, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      validateCatalogResponseUrl(response.url, {
        currentHref: globalThis.location.href,
        requestUrl,
      });
      const candidate = validateCatalogDocument(await response.json());
      catalogDocument = candidate;
      catalogItems = candidate.items.map((item) => normalizeArtifact(item));
      refreshCollection();
      refreshFacets();
      renderHeader();
      render();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  nodes.catalog.setAttribute('aria-busy', 'false');
  nodes['catalog-trust'].textContent = 'Catalog unavailable';
  nodes['catalog-built'].textContent = lastError?.message || 'Unknown load error';
  nodes['result-summary'].textContent =
    'Catalog could not be loaded. Local collection remains isolated.';
  nodes.empty.hidden = false;
  nodes.empty.textContent = 'No catalog metadata is available in this runtime.';
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

document.querySelectorAll('[data-lens]').forEach((button) => {
  button.addEventListener('click', () => dispatch({ type: 'lens', value: button.dataset.lens }));
});
document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => dispatch({ type: 'view', value: button.dataset.view }));
});
nodes['tag-mode-any'].addEventListener('click', () => dispatch({ type: 'tag-mode', value: 'any' }));
nodes['tag-mode-all'].addEventListener('click', () => dispatch({ type: 'tag-mode', value: 'all' }));
nodes['clear-topics'].addEventListener('click', () => dispatch({ type: 'clear-tags' }));
nodes.search.addEventListener('input', () =>
  dispatch({ type: 'query', value: nodes.search.value }),
);
nodes['kind-filter'].addEventListener('change', () =>
  dispatch({ type: 'kind', value: nodes['kind-filter'].value }),
);
nodes['availability-filter'].addEventListener('change', () =>
  dispatch({ type: 'availability', value: nodes['availability-filter'].value }),
);
nodes['evidence-filter'].addEventListener('change', () =>
  dispatch({ type: 'evidence', value: nodes['evidence-filter'].value }),
);
nodes['origin-filter'].addEventListener('change', () =>
  dispatch({ type: 'origin', value: nodes['origin-filter'].value }),
);
nodes['capability-filter'].addEventListener('change', () =>
  dispatch({ type: 'capability-source', value: nodes['capability-filter'].value }),
);
nodes['sort-filter'].addEventListener('change', () =>
  dispatch({ type: 'sort', value: nodes['sort-filter'].value }),
);
nodes['reset-filters'].addEventListener('click', () => dispatch({ type: 'reset-filters' }));
nodes['close-inspector'].addEventListener('click', closeInspectorAndRestoreFocus);
nodes['inspector-backdrop'].addEventListener('click', closeInspectorAndRestoreFocus);
nodes['import-trigger'].addEventListener('click', () => nodes['local-import'].click());
nodes['collection-access'].addEventListener('click', () => {
  const status = collectionStore.status();
  try {
    if (!status.permitted) {
      collectionStore.enable();
      showToast('Local collection persistence enabled for this browser.');
    } else {
      const ok = window.confirm(
        'Disable local collection persistence and clear all saved pins/imported metadata from this browser?',
      );
      if (!ok) return;
      collectionStore.revoke();
      state = reduceHubState(state, { type: 'close-inspector' });
      showToast('Local collection persistence disabled and saved data cleared.');
    }
  } catch (error) {
    showToast(`Collection permission change failed: ${error.message}`);
  } finally {
    refreshCollection();
    render();
  }
});

nodes['peer-create'].addEventListener('click', async () => {
  try {
    await peerSession.createSession();
    showToast('Peer session created. Share the invitation only with intended participants.');
  } catch (error) {
    showToast(`Peer session unavailable: ${error.message}`);
  }
});
nodes['peer-join'].addEventListener('click', async () => {
  try {
    await peerSession.joinSession(nodes['peer-join-code'].value);
    nodes['peer-join-code'].value = '';
    showToast('Joined peer session; capability negotiation is in progress.');
  } catch (error) {
    showToast(`Peer join rejected: ${error.message}`);
  }
});
nodes['peer-leave'].addEventListener('click', async () => {
  try {
    await peerSession.close();
    showToast('Peer session closed. Local collection state was not changed.');
  } catch (error) {
    showToast(`Peer close failed: ${error.message}`);
  }
});
nodes['peer-copy-invite'].addEventListener('click', async () => {
  const invitation = peerSession.snapshot().invitation;
  if (!invitation) return;
  try {
    await navigator.clipboard.writeText(invitation);
    showToast('Peer invitation copied.');
  } catch {
    showToast('Clipboard unavailable; copy the invitation text manually.');
  }
});
nodes['peer-host-game'].addEventListener('click', async () => {
  const gameId = nodes['peer-game-select'].value;
  const game = catalogItems.find((candidate) => candidate.id === gameId);
  if (!game) return;
  try {
    const hosted = await peerSession.hostGame({
      gameId: game.id,
      title: game.title,
      maxPlayers: Number(nodes['peer-game-max'].value),
    });
    showToast(`Hosting ${hosted.title} for up to ${hosted.maxPlayers} players.`);
  } catch (error) {
    showToast(`Game host failed: ${error.message}`);
  }
});
nodes['peer-chat-form'].addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = nodes['peer-chat-input'].value.trim();
  if (!message) return;
  nodes['peer-chat-send'].disabled = true;
  try {
    await peerSession.sendChat(message);
    nodes['peer-chat-input'].value = '';
  } catch (error) {
    showToast(`Lobby chat failed: ${error.message}`);
  } finally {
    renderPeerSession();
    if (peerSession.snapshot().connected) nodes['peer-chat-input'].focus();
  }
});
peerSession.onChange(() => {
  peerRuntime = normalizePeerRuntime(peerSession);
  renderHeader();
  render();
});

nodes['local-import'].addEventListener('change', async () => {
  const file = nodes['local-import'].files?.[0];
  nodes['local-import'].value = '';
  if (!file) return;
  try {
    const parsed = parseLocalArtifactDocument(await file.text(), { sourceName: file.name });
    dispatch({ type: 'stage-import', value: parsed });
    nodes['confirm-import'].focus();
    showToast(
      `Staged ${parsed.items.length} metadata record${parsed.items.length === 1 ? '' : 's'} for review.`,
    );
  } catch (error) {
    showToast(`Local import rejected: ${error.message}`);
  }
});

nodes['confirm-import'].addEventListener('click', () => {
  const pending = state.pendingImport;
  if (!pending) return;
  try {
    collectionStore.importLocal(pending);
    state = reduceHubState(state, { type: 'cancel-import' });
    refreshCollection();
    refreshFacets();
    syncControls();
    render();
    showToast(
      `Added ${pending.items.length} local metadata record${pending.items.length === 1 ? '' : 's'} from ${pending.sourceName}.`,
    );
  } catch (error) {
    showToast(`Local import rejected: ${error.message}`);
  }
});

nodes['cancel-import'].addEventListener('click', () => {
  if (!state.pendingImport) return;
  dispatch({ type: 'cancel-import' });
  showToast('Staged local import discarded.');
});

nodes['export-collection'].addEventListener('click', () => {
  downloadText('v13hub-collection.json', collectionStore.exportDocument());
  showToast('Collection exported locally.');
});

nodes['clear-collection'].addEventListener('click', () => {
  if (!collectionKeys().size) return;
  if (
    !window.confirm(
      'Clear all locally saved pins and imported artifact metadata from this browser?',
    )
  )
    return;
  try {
    collectionStore.clear();
    refreshCollection();
    state = reduceHubState(state, { type: 'close-inspector' });
    render();
    showToast('Local collection cleared.');
  } catch (error) {
    refreshCollection();
    render();
    showToast(`Local collection was not cleared: ${error.message}`);
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Tab' && state.selectedKey && !nodes.inspector.hidden) {
    const focusable = [
      ...nodes.inspector.querySelectorAll(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((node) => !node.hidden && node.getAttribute('aria-hidden') !== 'true');
    if (focusable.length) {
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }
  if (event.key === 'Escape' && state.pendingImport) {
    dispatch({ type: 'cancel-import' });
    return;
  }
  if (event.key === 'Escape' && state.selectedKey) closeInspectorAndRestoreFocus();
  if (event.key === '/' && !state.selectedKey && document.activeElement?.tagName !== 'INPUT') {
    event.preventDefault();
    nodes.search.focus();
  }
});

loadCatalog();
