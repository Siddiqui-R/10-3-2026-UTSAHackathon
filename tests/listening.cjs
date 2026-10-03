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
    f.speech.onresult({ results: [{ isFinal: false, 0: { transcript: 'pay with gift cards' } }] });
    f.speech.onresult({ results: [{ isFinal: false, 0: { transcript: 'pay with birthday cards' } }] });
    await delay(1100); assert.equal(f.transcriptions, 0);
    for (let i = 0; i < 3; i++) f.speech.onresult({ results: [{ isFinal: true, 0: { transcript: 'Pay with Apple gift cards' } }] });
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
  // Transient provider failures keep protection running with a visible warning; repeated failures stop it.
  const failure = fixture({ transcribe: async () => { throw new Error('Provider unavailable.'); } });
  try {
    await failure.session.start();
    for (let i = 1; i < 3; i++) {
      await failure.session.checkNow();
      assert.equal(failure.state.status, 'listening'); assert.ok(failure.state.warning.includes(`try again (${i} of 3)`));
    }
    await failure.session.checkNow(); assert.equal(failure.state.status, 'error'); assert.match(failure.state.message, /protection stopped/);
    assert.equal(failure.verdicts.length, 0); assert.equal(failure.recorders.filter(r => r.state === 'recording').length, 0);
  } finally { failure.session.stop(); }
  // A success after a failure clears the warning.
  let flaky = 0;
  const recovering = fixture({ transcribe: async () => { if (++flaky === 1) throw new Error('Network hiccup.'); return 'Hello there.'; } });
  try { await recovering.session.start(); await recovering.session.checkNow(); assert.ok(recovering.state.warning); await recovering.session.checkNow(); assert.equal(recovering.state.warning, ''); }
  finally { recovering.session.stop(); }
  // Recognition that keeps ending without hearing anything falls back to clip checks instead of looping.
  const looping = fixture();
  try {
    await looping.session.start();
    for (let i = 0; i < 6; i++) { const current = looping.speech; current.onend(); await delay(300 + 300 * (i + 1) + 20); }
    assert.equal(looping.state.mode, 'periodic'); assert.match(looping.state.warning, /20-second clips/); assert.equal(looping.state.status, 'listening');
  } finally { looping.session.stop(); }
  // Device mute and offline states are shown but do not pretend protection stopped.
  const muted = fixture();
  try {
    await muted.session.start(); muted.track.onmute(); assert.match(muted.state.warning, /muted/); muted.track.onunmute(); assert.equal(muted.state.warning, '');
    muted.session.setOnline(false); assert.match(muted.state.warning, /No internet/); muted.session.setOnline(true); assert.equal(muted.state.warning, '');
  } finally { muted.session.stop(); }
  // A silently ended track is caught by the watchdog.
  const silentEnd = fixture();
  try { await silentEnd.session.start(); silentEnd.track.readyState = 'ended'; await delay(1100); assert.equal(silentEnd.state.status, 'error'); }
  finally { silentEnd.session.stop(); }
  // While CallCanary speaks, its own words cannot trigger a check.
  const held = fixture();
  try {
    await held.session.start(); held.session.holdTriggers(5000);
    held.speech.onresult({ results: [{ isFinal: true, 0: { transcript: 'They asked you to pay with gift cards.' } }] });
    await delay(1200); assert.equal(held.transcriptions, 0);
  } finally { held.session.stop(); }
  // Text memory stays bounded however long the call runs.
  const long = fixture();
  try {
    await long.session.start();
    long.speech.onresult({ results: Array.from({ length: 600 }, (_, i) => ({ isFinal: true, 0: { transcript: 'ordinary words number ' + i } })) });
    assert.ok(long.session.finalWords.length <= 200); assert.ok(long.state.words.length <= 2500);
  } finally { long.session.stop(); }
};
