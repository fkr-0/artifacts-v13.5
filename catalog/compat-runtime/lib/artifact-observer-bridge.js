export function createArtifactObserverBridge({
  artifactId,
  snapshotSelector = 'body',
  getSemanticSnapshot = null,
  runtime = globalThis,
  documentRef = runtime.document,
  intervalMs = 750,
} = {}) {
  if (!artifactId) throw new Error('createArtifactObserverBridge requires artifactId');
  const params = new URLSearchParams(runtime.location?.search || '');
  const observeMode = params.get('observe') === 'true' || params.get('spectate') === 'true';
  const targetPeerId = params.get('targetPeerId') || '';
  const channel = typeof runtime.BroadcastChannel === 'function'
    ? new BroadcastChannel(`artifact-observer:${artifactId}`)
    : null;
  let lastHash = '';
  let lastSnapshotAt = 0;
  let sequence = 0;
  let timer = null;

  function snapshotRoot() {
    return documentRef.querySelector(snapshotSelector) || documentRef.body || documentRef.documentElement;
  }

  function buildSnapshot(reason = 'tick') {
    const root = snapshotRoot();
    return {
      artifactId,
      targetPeerId,
      reason,
      html: root?.innerHTML || '',
      text: root?.innerText || root?.textContent || '',
      selector: snapshotSelector,
      title: documentRef.title || artifactId,
      semantic: getSemanticSnapshot?.(),
      sequence: ++sequence,
      snapshotAgeMs: 0,
      at: Date.now(),
    };
  }

  function publishSnapshot(reason = 'tick') {
    if (observeMode) return null;
    const snapshot = buildSnapshot(reason);
    const hash = `${snapshot.html.length}:${snapshot.text.slice(0, 160)}`;
    if (hash === lastHash && reason === 'tick') return snapshot;
    lastHash = hash;
    const message = { type: 'artifact-observer-snapshot', snapshot };
    channel?.postMessage(message);
    if (runtime.parent && runtime.parent !== runtime) {
      runtime.parent.postMessage({ type: 'artifact-observer-snapshot', snapshot }, '*');
    }
    return snapshot;
  }

  function readOnlyOverlay() {
    if (!observeMode || documentRef.getElementById('artifactObserverReadOnly')) return;
    const style = documentRef.createElement('style');
    style.textContent = `
      #artifactObserverReadOnly{position:fixed;z-index:2147483647;top:.5rem;right:.5rem;background:rgba(7,12,24,.88);color:#dbeafe;border:1px solid rgba(125,211,252,.65);border-radius:.5rem;padding:.35rem .55rem;font:12px/1.2 ui-monospace,monospace;pointer-events:none}
      [data-observer-readonly="true"] button,[data-observer-readonly="true"] input,[data-observer-readonly="true"] select,[data-observer-readonly="true"] textarea{pointer-events:none!important}
    `;
    documentRef.head?.appendChild(style);
    const badge = documentRef.createElement('div');
    badge.id = 'artifactObserverReadOnly';
    badge.dataset.observerStatus = 'true';
    badge.id = 'artifactObserverStatus';
    badge.textContent = targetPeerId ? `observing ${targetPeerId}` : 'observing read-only';
    documentRef.body?.appendChild(badge);
    documentRef.documentElement?.setAttribute('data-observer-readonly', 'true');
  }

  function applySnapshot(snapshot) {
    if (!observeMode || !snapshot || snapshot.artifactId !== artifactId) return false;
    if (targetPeerId && snapshot.targetPeerId && snapshot.targetPeerId !== targetPeerId) return false;
    const root = snapshotRoot();
    if (!root || typeof snapshot.html !== 'string') return false;
    root.innerHTML = snapshot.html;
    root.querySelectorAll?.('button,input,select,textarea,[draggable="true"]').forEach((node) => {
      node.setAttribute('disabled', 'disabled');
      node.setAttribute('aria-disabled', 'true');
      node.setAttribute('draggable', 'false');
    });
    lastSnapshotAt = snapshot.at || Date.now();
    snapshot.snapshotAgeMs = Date.now() - lastSnapshotAt;
    updateObserverStatus(snapshot);
    readOnlyOverlay();
    return true;
  }

  function updateObserverStatus(snapshot = null) {
    if (!observeMode) return;
    const badge = documentRef.getElementById('artifactObserverStatus') || documentRef.getElementById('artifactObserverReadOnly');
    if (!badge) return;
    const age = lastSnapshotAt ? Math.max(0, Date.now() - lastSnapshotAt) : 0;
    const semanticLabel = snapshot?.semantic?.kind ? ` · ${snapshot.semantic.kind}` : '';
    badge.textContent = snapshot
      ? `observing ${snapshot.artifactId} #${snapshot.sequence || '?'}${semanticLabel} · last snapshot ${Math.round(age / 1000)}s ago`
      : (targetPeerId ? `observing ${targetPeerId}` : 'observing read-only');
  }

  function handleMessage(event) {
    const data = event?.data || event;
    if (data?.type === 'artifact-observer-snapshot') applySnapshot(data.snapshot);
  }

  function start() {
    if (observeMode) {
      readOnlyOverlay();
      channel?.addEventListener?.('message', handleMessage);
      runtime.addEventListener?.('message', handleMessage);
      runtime.parent?.postMessage?.({ type: 'artifact-observer-subscribe', artifactId, targetPeerId, at: Date.now() }, '*');
      return { observeMode, artifactId, targetPeerId };
    }
    publishSnapshot('start');
    timer = runtime.setInterval?.(() => publishSnapshot('tick'), intervalMs) || null;
    runtime.addEventListener?.('beforeunload', () => stop());
    return { observeMode, artifactId, targetPeerId };
  }

  function stop() {
    if (timer) runtime.clearInterval?.(timer);
    timer = null;
    channel?.close?.();
  }

  return { artifactId, observeMode, targetPeerId, start, stop, publishSnapshot, applySnapshot, readOnlyOverlay, updateObserverStatus };
}
