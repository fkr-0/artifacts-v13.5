export function restoreInspectorOriginFocus(container, recordKey) {
  if (!container || !recordKey) return false;

  const trigger = [...container.querySelectorAll('[data-inspect-key]')].find(
    (candidate) => candidate.dataset.inspectKey === recordKey,
  );
  if (!trigger) return false;

  trigger.focus();
  return true;
}
