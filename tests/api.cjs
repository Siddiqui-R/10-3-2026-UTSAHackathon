const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
const originalTs = Module._extensions['.ts'];
Module._load = function (name, parent, isMain) {
  return originalLoad.call(this, name.startsWith('@/') ? path.join(root, name.slice(2)) : name, parent, isMain);
};
Module._extensions['.ts'] = function (module, filename) {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};
const originalFetch = global.fetch;
const envNames = ['GEMINI_API_KEY', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'ELEVENLABS_MASCOT_VOICE_ID'];
const originalEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const request = value => new Request('http://localhost/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
const loadRoute = name => { const file = path.join(root, `app/api/${name}/route.ts`); delete require.cache[file]; return require(file).POST; };
async function run() {
  for (const name of envNames) process.env[name] = 'test-placeholder';
  const { parseAnalysis } = require('../lib/analysis.ts');
  const { demoTranscripts, WARNING_SCRIPT } = require('../lib/demoTranscripts.ts');
  const { scoreSignals, SIGNAL_THRESHOLD } = require('../lib/scamSignals.ts');
  const { warningText } = require('../lib/warningText.ts');
  for (const text of Object.values(demoTranscripts)) assert.ok(scoreSignals(text).score >= SIGNAL_THRESHOLD);
  assert.equal(scoreSignals('Hi mom, dinner at six. See you then.').score, 0);
  assert.ok(scoreSignals("don't tell your kids").score > 0);
  assert.equal(scoreSignals('gift cardholder postcard').score, 0);
  const verdict = { risk_score: 95, level: 'scam', scam_type: 'irs', reasons: ['Gift cards are a warning sign.'], red_flags: [{ phrase: 'Apple gift cards', explanation: 'Gift cards are not a tax payment.' }] };
  assert.equal(parseAnalysis(JSON.stringify(verdict), demoTranscripts.irs).level, 'scam');
  for (const bad of ['null', '{}', 'not json', JSON.stringify({ ...verdict, level: 'safe' }), JSON.stringify({ ...verdict, risk_score: 101 }), JSON.stringify({ ...verdict, scam_type: 'invented' }), JSON.stringify({ ...verdict, red_flags: [{ phrase: 'invented quote', explanation: 'Bad' }] })])
    assert.equal(parseAnalysis(bad, demoTranscripts.irs), null);
  for (const score of [0, 39, 40, 69, 70, 100]) {
    const level = score < 40 ? 'safe' : score < 70 ? 'suspicious' : 'scam';
    assert.equal(parseAnalysis(JSON.stringify({ ...verdict, risk_score: score, level }), demoTranscripts.irs).level, level);
  }
  let postCount = 0;
  global.fetch = async (url, options) => {
    if (url.endsWith('/models')) return json({ models: [
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3-flash-preview', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-4-flash-image', supportedGenerationMethods: ['generateContent'] },
    ] });
    assert.ok(url.includes('/models/gemini-3-flash-preview:generateContent'));
    const body = JSON.parse(options.body);
    assert.ok(body.generationConfig.responseSchema);
    postCount++;
    return json({ candidates: [{ content: { parts: [{ text: postCount === 1 ? 'broken' : JSON.stringify(verdict) }] } }] });
  };
  const analyze = loadRoute('analyze');
  assert.equal((await analyze(request({ transcript: '' }))).status, 400);
  assert.equal((await analyze(request(null))).status, 400);
  assert.equal((await (await analyze(request({ transcript: demoTranscripts.irs }))).json()).level, 'scam');
  assert.equal(postCount, 2);
  let fallbackCalls = 0;
  global.fetch = async url => {
    fallbackCalls++;
    return url.includes('gemini-3-flash-preview') ? new Response('', { status: 503 }) : json({ candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] } }] });
  };
  assert.equal((await (await analyze(request({ transcript: demoTranscripts.irs }))).json()).level, 'scam');
  assert.equal(fallbackCalls, 2);
  global.fetch = async () => json({ candidates: [] });
  assert.equal((await (await analyze(request({ transcript: demoTranscripts.irs }))).json()).risk_score, 50);
  global.fetch = async () => { throw new Error('Provider offline'); };
  assert.equal((await (await analyze(request({ transcript: 'Hi, family.' }))).json()).level, 'suspicious');
  delete process.env.GEMINI_API_KEY;
  assert.equal((await analyze(request({ transcript: 'Hello' }))).status, 503);
  let speechCalls = 0;
  global.fetch = async (url, options) => {
    speechCalls++; assert.ok(url.includes('/text-to-speech/test-placeholder'));
    assert.ok(JSON.parse(options.body).text === WARNING_SCRIPT || /^(?:Hold on. It's CallCanary.|It's CallCanary.)/.test(JSON.parse(options.body).text));
    assert.equal(JSON.parse(options.body).model_id, 'eleven_flash_v2_5');
    return new Response(new Uint8Array([73, 68, 51]), { headers: { 'Content-Type': 'audio/mpeg' } });
  };
  const speak = loadRoute('speak');
  assert.equal((await speak(request({ text: 'arbitrary input' }))).status, 400);
  for (let i = 0; i < 2; i++) assert.equal((await speak(request({ text: WARNING_SCRIPT }))).headers.get('Content-Type'), 'audio/mpeg');
  assert.equal(speechCalls, 1);
  const reasons = ['They demanded gift cards.', 'They threatened arrest.'];
  for (let i = 0; i < 2; i++) assert.equal((await speak(request({ reasons }))).status, 200);
  assert.equal(speechCalls, 2);
  assert.equal((await speak(request({ reasons: ['A different scam explanation.'] }))).status, 200);
  assert.equal(speechCalls, 3);
  for (const reasons of [[], [null], [''], ['x'.repeat(501)], ['a', 'b', 'c', 'd']]) assert.equal((await speak(request({ reasons }))).status, 400);
  assert.equal((await speak(request({ reasons, level: 'invented' }))).status, 400);
  // The spoken words follow the verdict level and its own reasons.
  const spoken = async body => decodeURIComponent((await speak(request(body))).headers.get('X-Spoken-Text'));
  assert.match(await spoken({ level: 'scam', reasons }), /I'm sure this call is a scam. They demanded gift cards. They threatened arrest./);
  assert.match(await spoken({ level: 'suspicious', reasons: ['They pushed you to hurry.'] }), /doesn't sit right. They pushed you to hurry./);
  assert.match(await spoken({ level: 'safe', reasons: ['Ordinary family chat.'] }), /sounded okay. Ordinary family chat./);
  assert.doesNotMatch(await spoken({ level: 'safe', reasons: ['Ordinary family chat.'] }), /scam/);
  // Explanations stay brief: one sentence per reason, long reasons clipped.
  assert.ok(warningText(['First sentence is the key point here. Second sentence adds far too much detail.'], 'scam').includes('key point here.'));
  assert.ok(!warningText(['First sentence is the key point here. Second sentence adds far too much detail.'], 'scam').includes('Second sentence'));
  assert.ok(warningText(['word '.repeat(80)], 'scam').length < 400);
  assert.ok(warningText(['They demanded gift cards.']).includes('They demanded gift cards.'));
  const health = require('../app/api/health/route.ts').GET;
  const healthData = await (await health()).json();
  assert.equal(healthData.analysis, false);
  assert.equal(JSON.stringify(healthData).includes('test-placeholder'), false);
  const recordingRequest = (bytes = 4, type = 'audio/webm') => {
    const form = new FormData(); form.append('audio', new Blob([new Uint8Array(bytes)], { type }), 'call.webm');
    return new Request('http://localhost/api', { method: 'POST', body: form });
  };
  const transcribe = loadRoute('transcribe');
  assert.equal((await transcribe(recordingRequest(0))).status, 400);
  assert.equal((await transcribe(recordingRequest(4, 'text/plain'))).status, 415);
  assert.equal((await transcribe(recordingRequest(4 * 1024 * 1024 + 1))).status, 413);
  let sttCalls = 0;
  global.fetch = async () => ++sttCalls === 1 ? new Response('', { status: 503 }) : json({ text: 'hello' });
  assert.equal((await (await transcribe(recordingRequest())).json()).transcript, 'hello');
  assert.equal(sttCalls, 2);
  sttCalls = 0;
  global.fetch = async (url, options) => {
    if (url.endsWith('/models')) return json([{ model_id: 'scribe_v2' }]);
    sttCalls++;
    if (sttCalls === 1) return new Response('invalid model_id scribe_v1', { status: 422 });
    assert.equal(options.body.get('model_id'), 'scribe_v2'); return json({ text: 'recovered' });
  };
  assert.equal((await (await transcribe(recordingRequest())).json()).transcript, 'recovered');
  global.fetch = async () => json({ text: '' });
  assert.equal((await (await transcribe(recordingRequest())).json()).transcript, '');
  require('./scoring.cjs')();
  await require('./email.cjs')();
  await require('./listening.cjs')();
  console.log('PASS: weighted signals, score boundaries, malformed verdicts, model discovery, retries/fallbacks, contextual speech cache, upload/silence handling, continuous listening lifecycle and cleanup, email link checks and phishing verdicts.');
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  global.fetch = originalFetch; Module._load = originalLoad; Module._extensions['.ts'] = originalTs;
  for (const name of envNames) { if (originalEnv[name] === undefined) delete process.env[name]; else process.env[name] = originalEnv[name]; }
});
