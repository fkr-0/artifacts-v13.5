const aliases = new Map([
  ['popup', 'newWindow'],
  ['new-window', 'newWindow'],
  ['window', 'newWindow'],
  ['tab', 'tabbed'],
  ['dock', 'inline'],
]);

export function normalizeLaunchMode(mode = 'inline') {
  const normalized = aliases.get(mode) || mode;
  return ['inline', 'floating', 'tabbed', 'fullscreen', 'newWindow'].includes(normalized) ? normalized : 'inline';
}

export function artifactHref(item) {
  return item.hubHref || item.href || item.source || '#';
}

export function launchUrlForMode(item, mode = 'inline', action = null) {
  const normalized = normalizeLaunchMode(mode);
  const href = artifactHref(item);
  if (!href || href === '#') return '#';
  if (!['inline', 'floating', 'fullscreen'].includes(normalized)) return href;
  if (/^https?:\/\//.test(href)) return href;
  const params = ['embedded=true'];
  if (action?.multiplayer) params.push('multiplayer=true');
  if (action?.targetPeerId) params.push(`targetPeerId=${encodeURIComponent(action.targetPeerId)}`);
  if (action?.spectate || action?.observe) params.push('spectate=true', 'observe=true');
  if (action?.mode) params.push(`mode=${encodeURIComponent(action.mode)}`);
  if (action?.session) params.push(`session=${encodeURIComponent(action.session)}`);
  const glue = href.includes('?') ? '&' : '?';
  return `${href}${glue}${params.join('&')}`;
}

export function launchArtifact(item, mode = 'inline', runtime = globalThis, action = null) {
  const normalized = normalizeLaunchMode(mode);
  const url = launchUrlForMode(item, normalized, action);
  if (normalized === 'newWindow' || normalized === 'tabbed') {
    runtime.open?.(url, '_blank', 'noopener,noreferrer');
    return { mode: normalized, url, handledByBrowser: true, action };
  }
  return { mode: normalized, url, handledByBrowser: false, action };
}

export function createAppRuntimeRegistry({ onChange = () => {} } = {}) {
  const instances = new Map();
  const counters = new Map();
  const boundIframes = new WeakSet();

  const emitChange = (type, descriptor = null) => {
    onChange({ type, descriptor, instances: [...instances.values()] });
    return descriptor;
  };
  const nextInstanceId = (artifactId) => {
    const next = Number(counters.get(artifactId) || 0) + 1;
    counters.set(artifactId, next);
    return `${artifactId}-${next}`;
  };
  const requireDescriptor = (instanceId) => {
    const descriptor = instances.get(instanceId);
    if (!descriptor) throw new Error(`unknown runtime instance: ${instanceId}`);
    return descriptor;
  };
  const update = (instanceId, patch = {}) => {
    const descriptor = requireDescriptor(instanceId);
    const allowedStatuses = new Set(['launching', 'loaded', 'ready', 'warning', 'error', 'closed']);
    const normalizedPatch = { ...patch };
    if (normalizedPatch.status && !allowedStatuses.has(normalizedPatch.status)) {
      normalizedPatch.status = 'warning';
      normalizedPatch.lastError ||= `unknown runtime state: ${patch.status}`;
    }
    if (normalizedPatch.capabilities && !Array.isArray(normalizedPatch.capabilities)) {
      normalizedPatch.capabilities = [];
    }
    Object.assign(descriptor, normalizedPatch, { updatedAt: new Date().toISOString() });
    if (descriptor.status === 'ready' && !descriptor.readyAt) descriptor.readyAt = descriptor.updatedAt;
    return emitChange('update', descriptor);
  };
  const bindIframeLifecycle = (descriptor) => {
    const iframe = descriptor?.iframeNode;
    if (!iframe?.addEventListener || boundIframes.has(iframe)) return;
    boundIframes.add(iframe);
    iframe.addEventListener('load', () => {
      if (!instances.has(descriptor.instanceId)) return;
      update(descriptor.instanceId, {
        status: ['ready', 'warning', 'error'].includes(descriptor.status)
          ? descriptor.status
          : 'loaded',
        loadedAt: new Date().toISOString(),
        lastError: ['warning', 'error'].includes(descriptor.status)
          ? descriptor.lastError
          : null,
      });
    });
    iframe.addEventListener('error', () => {
      if (!instances.has(descriptor.instanceId)) return;
      update(descriptor.instanceId, { status: 'error', lastError: 'iframe failed to load' });
    });
  };
  const register = ({ artifact, launch = {}, containerMode = 'inline', instanceId = null, ...nodes } = {}) => {
    if (!artifact?.id) throw new Error('createAppRuntimeRegistry.register requires artifact metadata with an id');
    const artifactId = String(artifact.id);
    const descriptor = {
      instanceId: instanceId || nextInstanceId(artifactId),
      artifactId,
      artifact,
      launch,
      containerMode: normalizeLaunchMode(containerMode),
      iframeNode: null,
      tabNode: null,
      panelNode: null,
      status: 'launching',
      loadedAt: null,
      readyAt: null,
      lastReportAt: null,
      lastError: null,
      report: null,
      capabilities: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...nodes,
    };
    if (instances.has(descriptor.instanceId)) throw new Error(`runtime instance already exists: ${descriptor.instanceId}`);
    instances.set(descriptor.instanceId, descriptor);
    bindIframeLifecycle(descriptor);
    return emitChange('register', descriptor);
  };
  const attach = (instanceId, nodes = {}) => {
    const descriptor = requireDescriptor(instanceId);
    Object.assign(descriptor, nodes, { updatedAt: new Date().toISOString() });
    bindIframeLifecycle(descriptor);
    return emitChange('attach', descriptor);
  };
  const move = (instanceId, containerMode, nodes = {}) => {
    const descriptor = requireDescriptor(instanceId);
    descriptor.containerMode = normalizeLaunchMode(containerMode);
    Object.assign(descriptor, nodes, { updatedAt: new Date().toISOString() });
    bindIframeLifecycle(descriptor);
    return emitChange('move', descriptor);
  };
  const remove = (instanceId) => {
    const descriptor = requireDescriptor(instanceId);
    descriptor.status = 'closed';
    descriptor.updatedAt = new Date().toISOString();
    instances.delete(instanceId);
    return emitChange('remove', descriptor);
  };

  return {
    register,
    attach,
    move,
    update,
    remove,
    markReady: (instanceId, report = null) => update(instanceId, {
      status: 'ready',
      readyAt: new Date().toISOString(),
      lastReportAt: new Date().toISOString(),
      lastError: null,
      report,
      capabilities: Array.isArray(report?.capabilities) ? report.capabilities : [],
    }),
    markError: (instanceId, error) => update(instanceId, {
      status: 'error',
      lastError: String(error?.message || error || 'runtime error'),
      lastReportAt: new Date().toISOString(),
    }),
    findBySource: (sourceWindow) => [...instances.values()].find((descriptor) => descriptor.iframeNode?.contentWindow === sourceWindow) || null,
    get: (instanceId) => instances.get(instanceId) || null,
    list: () => [...instances.values()],
    size: () => instances.size,
    summary: () => {
      const values = [...instances.values()];
      return {
        total: values.length,
        ready: values.filter((item) => item.status === 'ready').length,
        pending: values.filter((item) => ['launching', 'loaded'].includes(item.status)).length,
        warning: values.filter((item) => item.status === 'warning').length,
        error: values.filter((item) => item.status === 'error').length,
      };
    },
  };
}

export function createInlineTabDeck({ deck, tabs, body, runtime = globalThis, onChange = () => {} } = {}) {
  if (!deck || !tabs || !body) throw new Error('createInlineTabDeck requires deck, tabs, and body elements');
  const documentRef = runtime.document;
  const openApps = new Map();
  let activeAppId = null;
  let nextAppId = 1;

  const setActive = (appId) => {
    const appData = openApps.get(appId);
    if (!appData) return;
    activeAppId = appId;
    for (const [id, data] of openApps) {
      data.tab.classList?.toggle('active', id === appId);
      data.tab.setAttribute?.('aria-selected', String(id === appId));
      data.tab.tabIndex = id === appId ? 0 : -1;
      data.panel.classList?.toggle('active', id === appId);
      data.panel.hidden = id !== appId;
    }
    deck.classList?.add('active');
    onChange({ type: 'switch', activeAppId, openApps });
  };

  const close = (appId) => {
    const appData = openApps.get(appId);
    if (!appData) return;
    appData.tab.remove?.();
    appData.panel.remove?.();
    openApps.delete(appId);
    if (activeAppId === appId) {
      const next = openApps.keys().next().value;
      if (next) {
        setActive(next);
        onChange({ type: 'close', activeAppId, openApps, appData });
      }
      else {
        activeAppId = null;
        deck.classList?.remove('active');
        onChange({ type: 'empty', activeAppId, openApps, appData });
      }
    } else {
      onChange({ type: 'close', activeAppId, openApps, appData });
    }
  };

  const createTab = (artifact, instanceId) => {
    const tab = documentRef.createElement('button');
    tab.type = 'button';
    tab.className = 'app-deck-tab';
    tab.dataset.appId = artifact.id;
    tab.dataset.instanceId = instanceId;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('aria-label', artifact.title || artifact.name || artifact.id);
    const title = documentRef.createElement('span');
    title.textContent = artifact.title || artifact.name || artifact.id;
    const floatButton = documentRef.createElement('button');
    floatButton.type = 'button';
    floatButton.className = 'app-deck-tab-float';
    floatButton.dataset.float = artifact.id;
    floatButton.title = 'float app';
    floatButton.setAttribute('aria-label', `float ${artifact.title || artifact.id}`);
    floatButton.textContent = '▣';
    floatButton.onclick = (event) => { event?.stopPropagation?.(); float(artifact.id); };
    const closeButton = documentRef.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'app-deck-tab-close';
    closeButton.dataset.close = artifact.id;
    closeButton.textContent = '✕';
    closeButton.setAttribute('aria-label', `close ${artifact.title || artifact.id}`);
    closeButton.onclick = (event) => { event?.stopPropagation?.(); close(artifact.id); };
    tab.floatButton = floatButton;
    tab.closeButton = closeButton;
    tab.append(title, floatButton, closeButton);
    tab.onclick = () => setActive(artifact.id);
    return tab;
  };

  const createPanel = (artifact, instanceId, launch = {}, iframeNode = null) => {
    const panel = documentRef.createElement('section');
    panel.className = 'app-deck-panel';
    panel.dataset.appId = artifact.id;
    panel.dataset.instanceId = instanceId;
    panel.setAttribute('role', 'tabpanel');
    if (iframeNode) {
      panel.appendChild(iframeNode);
    } else if (launch.url === '#') {
      const empty = documentRef.createElement('div');
      empty.className = 'app-deck-empty';
      empty.textContent = `No launchable content for ${artifact.title || artifact.id}`;
      panel.appendChild(empty);
    } else {
      const iframe = documentRef.createElement('iframe');
      iframe.className = 'app-deck-inline-frame';
      iframe.src = launch.url || artifactHref(artifact);
      iframe.title = artifact.title || artifact.id;
      iframe.setAttribute?.('allow', 'autoplay; fullscreen; clipboard-read; clipboard-write; gamepad');
      iframe.setAttribute?.('allowfullscreen', '');
      iframe.setAttribute?.('loading', 'eager');
      panel.appendChild(iframe);
    }
    return panel;
  };

  const open = (artifact, launch = {}) => {
    if (openApps.has(artifact.id)) {
      setActive(artifact.id);
      return openApps.get(artifact.id);
    }
    const instanceId = `${artifact.id}-${nextAppId++}`;
    const tab = createTab(artifact, instanceId);
    const panel = createPanel(artifact, instanceId, launch);

    tabs.appendChild(tab);
    body.appendChild(panel);
    deck.classList?.add('active');
    const appData = { artifact, instanceId, tab, panel, iframeNode: panel.querySelector?.('iframe') || null, launch, containerMode: 'inline' };
    openApps.set(artifact.id, appData);
    setActive(artifact.id);
    onChange({ type: 'open', activeAppId, openApps, appData });
    return appData;
  };

  const float = (appId) => {
    const appData = openApps.get(appId);
    if (!appData) return null;
    appData.tab.remove?.();
    appData.panel.remove?.();
    openApps.delete(appId);
    appData.containerMode = 'floating';
    appData.tab = null;
    appData.panel = null;
    if (activeAppId === appId) {
      const next = openApps.keys().next().value;
      activeAppId = next || null;
      if (next) setActive(next);
      else {
        deck.classList?.remove('active');
        onChange({ type: 'empty', activeAppId, openApps });
      }
    }
    onChange({ type: 'float', activeAppId, openApps, appData });
    return appData;
  };

  const dock = (appData) => {
    if (!appData?.artifact?.id) return null;
    const artifact = appData.artifact;
    if (openApps.has(artifact.id)) {
      setActive(artifact.id);
      return openApps.get(artifact.id);
    }
    const tab = createTab(artifact, appData.instanceId || `${artifact.id}-${nextAppId++}`);
    const panel = createPanel(artifact, appData.instanceId || tab.dataset.instanceId, appData.launch || {}, appData.iframeNode || null);
    appData.tab = tab;
    appData.panel = panel;
    appData.iframeNode = appData.iframeNode || panel.querySelector?.('iframe') || null;
    appData.containerMode = 'inline';
    tabs.appendChild(tab);
    body.appendChild(panel);
    deck.classList?.add('active');
    openApps.set(artifact.id, appData);
    setActive(artifact.id);
    onChange({ type: 'dock', activeAppId, openApps, appData });
    return appData;
  };

  return { open, close, float, dock, switchTo: setActive, activeId: () => activeAppId, openApps };
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[char]);
}

export function createFloatingPanel({ title, url, iframeNode = null, dockLabel = '', onDock = null, onClose = null } = {}, runtime = globalThis) {
  const documentRef = runtime.document;
  if (!documentRef) throw new Error('createFloatingPanel requires a document runtime');

  const returnFocus = typeof documentRef.activeElement?.focus === 'function' ? documentRef.activeElement : null;
  const existingPanel = documentRef.querySelector?.('.floating');
  existingPanel?.runtimeCleanup?.();
  existingPanel?.remove?.();
  const panel = documentRef.createElement('section');
  panel.className = 'floating';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', title || 'Floating app');
  panel.tabIndex = -1;
  panel.style.position = 'fixed';
  panel.style.resize = 'both';
  panel.style.overflow = 'auto';
  panel.style.left = panel.style.left || '10vw';
  panel.style.top = panel.style.top || '10vh';
  panel.style.width = panel.style.width || 'min(900px, 82vw)';
  panel.style.height = panel.style.height || 'min(680px, 76vh)';
  const header = documentRef.createElement('header');
  header.dataset.floatingDragHandle = '';
  const titleNode = documentRef.createElement('strong');
  titleNode.textContent = title || 'Floating app';
  const resizeHint = documentRef.createElement('span');
  resizeHint.dataset.floatingResizeHandle = '';
  resizeHint.setAttribute('aria-hidden', 'true');
  resizeHint.textContent = '↘';
  header.append(titleNode, resizeHint);
  if (onDock) {
    const dockControl = documentRef.createElement('button');
    dockControl.type = 'button';
    dockControl.dataset.dock = '';
    dockControl.textContent = dockLabel || 'dock inline';
    dockControl.setAttribute('aria-label', dockLabel || 'dock inline');
    dockControl.onclick = () => onDock?.(panel);
    header.appendChild(dockControl);
  }
  const closeButton = documentRef.createElement('button');
  closeButton.type = 'button';
  closeButton.dataset.closeFloating = '';
  closeButton.textContent = 'close';
  closeButton.setAttribute('aria-label', 'close floating app');
  let cleanedUp = false;
  panel.runtimeCleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    onClose?.(panel);
  };
  closeButton.onclick = () => {
    panel.runtimeCleanup();
    panel.remove();
    returnFocus?.focus?.({ preventScroll: true });
  };
  header.appendChild(closeButton);
  panel.appendChild(header);
  if (iframeNode) {
    panel.appendChild(iframeNode);
  } else {
    const iframe = documentRef.createElement('iframe');
    iframe.src = url || '#';
    iframe.title = title || 'Floating app';
    iframe.setAttribute?.('allow', 'autoplay; fullscreen; clipboard-read; clipboard-write; gamepad');
    iframe.setAttribute?.('allowfullscreen', '');
    panel.appendChild(iframe);
  }
  makeFloatingPanelMovable(panel, runtime);
  (runtime.body || documentRef.body)?.append(panel);
  panel.focus?.({ preventScroll: true });
  return panel;
}


function makeFloatingPanelMovable(panel, runtime = globalThis) {
  let drag = null;
  const onPointerMove = (event) => {
    if (!drag) return;
    const nextLeft = Math.max(0, event.clientX - drag.offsetX);
    const nextTop = Math.max(0, event.clientY - drag.offsetY);
    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
  };
  const onPointerUp = () => {
    drag = null;
    runtime.removeEventListener?.('pointermove', onPointerMove);
    runtime.removeEventListener?.('pointerup', onPointerUp);
  };
  panel.onpointerdown = (event) => {
    const target = event.target;
    if (target?.closest && !target.closest('[data-floating-drag-handle]')) return;
    if (target?.closest && target.closest('button')) return;
    const rect = panel.getBoundingClientRect?.() || { left: 0, top: 0 };
    drag = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    panel.style.position = 'fixed';
    panel.style.margin = '0';
    panel.style.inset = 'auto';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    runtime.addEventListener?.('pointermove', onPointerMove);
    runtime.addEventListener?.('pointerup', onPointerUp, { once: true });
    event.preventDefault?.();
  };
}
