const assert = require('node:assert/strict');
module.exports = async function testListening() {
  const { ListeningSession } = require('../lib/listeningSession.ts');
  const safe = { risk_score: 10, level: 'safe', scam_type: 'none', reasons: ['Normal conversation.'], red_flags: [] };
  const scam = { ...safe, risk_score: 95, level: 'scam', reasons: ['They asked for gift cards.'], scam_type: 'irs', red_flags: [{ phrase: 'gift cards', explanation: 'Not a tax payment.' }] };
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  function fixture(overrides = {}) {
    let state, speech, transcriptions = 0, analyses = 0, stopped = 0, verdicts = [];
    const recorders = [];
    const track = { onended: null, stop() { stopped++; } };
    const deps = {
      getMedia: async () => ({ getTracks: () => [track] }),
      makeRecorder: () => {
        const recorder = { state: 'inactive', mimeType: 'audio/webm', onstop: null, onerror: null, ondataavailable: null,
          start() { this.state = 'recording'; },
          stop() { this.state = 'inactive'; queueMicrotask(() => { this.ondataavailable?.({ data: new Blob(['valid independent clip'], { type: 'audio/webm' }) }); this.onstop?.(); }); },
        }; recorders.push(recorder); return recorder;
      },
      makeRecognition: () => (speech = { start() {}, abort() {}, onresult: null, onerror: null, onend: null }),
      transcribe: async () => { transcriptions++; return 'Pay with Apple gift cards now.'; },
      analyze: async () => { analyses++; return safe; },
      update: value => { state = value; }, verdict: value => { verdicts.push(value); }, ...overrides,
    };
    const session = new ListeningSession(deps);
    return { session, deps, track, recorders, get state() { return state; }, get speech() { return speech; }, get verdicts() { return verdicts; }, get stopped() { return stopped; }, get transcriptions() { return transcriptions; }, get analyses() { return analyses; } };
  }
  const f = fixture();
  try {
    await f.session.start(); assert.equal(f.state.status, 'listening');
    f.speech.onresult({ results: [{ isFinal: false, 0: { transcript: 'Hi mom, see you at dinner.' } }] });
    assert.equal(f.state.score, 0); assert.equal(f.transcriptions, 0);
    // Interim correction cancels a scheduled trigger; corrected new evidence can schedule again.
    f.speech.onresult({ results: [{ isFinal: false, 0: { transcript: 'gift cards' } }] });
    f.speech.onresult({ results: [{ isFinal: false, 0: { transcript: 'birthday cards' } }] });
    await delay(1100); assert.equal(f.transcriptions, 0);
    for (let i = 0; i < 3; i++) f.speech.onresult({ results: [{ isFinal: true, 0: { transcript: 'Apple gift cards' } }] });
    assert.equal(f.state.score, 35);
    await delay(1150);
    assert.equal(f.transcriptions, 1); assert.equal(f.analyses, 1); assert.equal(f.verdicts.length, 1);
    assert.equal(f.state.status, 'listening'); assert.equal(f.recorders.at(-1).state, 'recording');
    assert.equal(f.state.score, 0);
    f.session.stop(); assert.equal(f.state.status, 'off'); assert.ok(f.stopped > 0);
    assert.equal(f.recorders.at(-1).state, 'inactive');
  } finally { f.session.stop(); }
  const g = fixture({ analyze: async () => scam });
  try { await g.session.start(); await g.session.checkNow(); assert.equal(g.verdicts[0].level, 'scam'); assert.equal(g.state.status, 'off'); assert.ok(g.stopped > 0); }
  finally { g.session.stop(); }
  const silence = fixture({ makeRecognition: undefined, transcribe: async () => '' });
  try { await silence.session.start(); assert.equal(silence.state.mode, 'periodic'); await silence.session.checkNow(false); assert.equal(silence.state.status, 'listening'); assert.equal(silence.verdicts.length, 0); }
  finally { silence.session.stop(); }
  let finish;
  const race = fixture({ transcribe: () => new Promise(resolve => { finish = resolve; }) });
  try {
    await race.session.start(); const checking = race.session.checkNow(); await delay(0);
    assert.equal(race.recorders.at(-1).state, 'recording');
    race.session.stop(); finish('gift cards'); await checking;
    assert.equal(race.state.status, 'off'); assert.equal(race.verdicts.length, 0);
  } finally { race.session.stop(); }
  // A keyword arriving during a clip rotation must not create two live recorders.
  const originalInterval = global.setInterval;
  let rotate;
  global.setInterval = (callback, ms) => { if (ms === 20_000) rotate = callback; return originalInterval(callback, ms); };
  const rotation = fixture();
  try {
    await rotation.session.start(); global.setInterval = originalInterval;
    rotate(); await rotation.session.checkNow();
    assert.equal(rotation.transcriptions, 2);
    assert.equal(rotation.recorders.filter(recorder => recorder.state === 'recording').length, 1);
    rotation.session.stop(); assert.equal(rotation.recorders.filter(recorder => recorder.state === 'recording').length, 0);
  } finally { global.setInterval = originalInterval; rotation.session.stop(); }
  let releaseMic; let lateStopped = 0;
  const late = fixture({ getMedia: () => new Promise(resolve => { releaseMic = resolve; }) });
  const opening = late.session.start(); late.session.stop();
  releaseMic({ getTracks: () => [{ stop: () => lateStopped++ }] }); await opening;
  assert.equal(late.state.status, 'off'); assert.equal(lateStopped, 1); assert.equal(late.recorders.length, 0);
  const disconnected = fixture();
  try { await disconnected.session.start(); disconnected.track.onended(); assert.equal(disconnected.state.status, 'error'); assert.ok(disconnected.stopped > 0); }
  finally { disconnected.session.stop(); }
  const failure = fixture({ transcribe: async () => { throw new Error('Provider unavailable'); } });
  try { await failure.session.start(); await failure.session.checkNow(); assert.equal(failure.state.status, 'error'); assert.equal(failure.verdicts.length, 0); }
  finally { failure.session.stop(); }
};
