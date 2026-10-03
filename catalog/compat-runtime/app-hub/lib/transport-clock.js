// app-hub/lib/transport-clock.js
export function tickMsFromBpm(bpm, ppq = 4) {
  return Math.max(20, 60000 / Math.max(1, Number(bpm || 120)) / ppq);
}
export function makeTransportState({ docId = 'main', bpm = 120, authority = 'local', now = Date.now(), ppq = 4 } = {}) {
  return { docId, bpm, ppq, step: 0, running: false, authority, epochMs: now, tickMs: tickMsFromBpm(bpm, ppq), latencyMs: 0, driftMs: 0 };
}
export function makeTickPayload(seq, transport, now = Date.now(), random = () => 0) {
  const tickMs = tickMsFromBpm(seq.bpm || transport.bpm, transport.ppq || 4);
  const latencyMs = Number(transport.latencyMs || 0);
  const driftMs = Number(transport.driftMs || 0);
  const swingMs = seq.step % 2 === 1 ? Math.max(0, Number(seq.swing || 0)) * tickMs : 0;
  const active = (seq.tracks || [])
    .filter(t => t.steps?.[seq.step] && random() <= (t.probability ?? 1))
    .map(t => ({ id: t.id, note: t.note, name: t.name, velocity: t.velocity ?? 0.85, gate: t.gate ?? 0.35, probability: t.probability ?? 1, slice: t.slice ?? null }));
  return { docId: seq.docId, step: seq.step, bpm: seq.bpm, ppq: transport.ppq || 4, tickMs, swingMs, authority: transport.authority, startedAt: transport.epochMs, sentAt: now, dueAt: now + Math.min(tickMs * 0.5, 140) + latencyMs - driftMs + swingMs, active };
}
export function latencyFromPing({ sentAt, receivedAt = Date.now(), remoteNow = receivedAt } = {}) {
  const rttMs = Math.max(0, receivedAt - sentAt);
  return { rttMs, oneWayMs: rttMs / 2, clockOffsetMs: remoteNow - (sentAt + rttMs / 2) };
}
export function smoothCorrection(previous = 0, measured = 0, factor = 0.12) {
  return previous + (measured - previous) * factor;
}
export function nextStep(step, length = 16) { return (Number(step || 0) + 1) % Math.max(1, length); }
