// app-hub/lib/sequencer-core.js
export function makeDefaultSequencer(docId = 'main') {
  return { docId, bpm: 120, swing: 0, step: 0, version: 0, tracks: [
    { id:'kick', name:'Kick', note:'C2', velocity:.95, probability:1, gate:.45, steps:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0] },
    { id:'snare', name:'Snare', note:'D2', velocity:.9, probability:1, gate:.45, steps:[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0] },
    { id:'hat', name:'Hat', note:'F#2', velocity:.55, probability:.85, gate:.2, steps:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0] }
  ]};
}
export function applySeqOp(seq, op) {
  if (!op || !op.kind) return seq;
  const track = op.payload?.trackId ? seq.tracks.find(x => x.id === op.payload.trackId) : null;
  if (op.kind === 'toggle' && track) track.steps[op.payload.step] = track.steps[op.payload.step] ? 0 : 1;
  if (op.kind === 'bpm') seq.bpm = clamp(Number(op.payload.bpm || seq.bpm || 120), 40, 240);
  if (op.kind === 'swing') seq.swing = clamp(Number(op.payload.swing ?? seq.swing ?? 0), 0, 0.75);
  if (op.kind === 'velocity' && track) track.velocity = clamp(Number(op.payload.velocity ?? track.velocity ?? .8), 0, 1);
  if (op.kind === 'probability' && track) track.probability = clamp(Number(op.payload.probability ?? track.probability ?? 1), 0, 1);
  if (op.kind === 'gate' && track) track.gate = clamp(Number(op.payload.gate ?? track.gate ?? .4), 0.02, 1);
  if (op.kind === 'note' && track) track.note = op.payload.note || track.note;
  seq.version = Math.max(seq.version || 0, op.version || 0);
  return seq;
}
export function makeSeqOp(seq, kind, payload, site = 'local') { return { kind, payload, site, version: (seq.version || 0) + 1, opId: `${site}:${Date.now()}:${Math.random().toString(36).slice(2)}` }; }
export function activeEventsForStep(seq, step = seq.step, random = Math.random) {
  return (seq.tracks || []).filter(t => t.steps?.[step] && random() <= (t.probability ?? 1)).map(t => ({ id:t.id, note:t.note, name:t.name, velocity:t.velocity ?? .8, gate:t.gate ?? .35, probability:t.probability ?? 1, slice:t.slice ?? null }));
}
export function swingOffsetMs(seq, step, tickMs) { return step % 2 === 1 ? Math.max(0, Number(seq.swing || 0)) * tickMs : 0; }
function clamp(v,a,b){ return Math.max(a, Math.min(b, Number.isFinite(v) ? v : a)); }
