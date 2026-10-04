const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
// Caller screening: reported-number list, layered decision, and the /api/screen and /api/check-number routes.
module.exports = async function testScreen() {
  const numbers = require('../lib/reportedNumbers.ts');
  const { decideScreening, parseScreenJudgment, screenUserText, SCREEN_GREETING } = require('../lib/screening.ts');
  const { normalizeUsNumber, checkReportedNumber, useIndexForTests } = numbers;

  for (const [input, expected] of [['(210) 555-0100', '2105550100'], ['+1 210 555 0100', '2105550100'], ['1-210-555-0100', '2105550100'], ['210.555.0100', '2105550100'],
    ['555-0100', null], ['0105550100', null], ['2101550100', null], ['', null], [12, null]]) assert.equal(normalizeUsNumber(input), expected, String(input));

  // The shipped FTC index loads, and a number from it is found.
  const shipped = zlib.gunzipSync(fs.readFileSync(path.join(__dirname, '../data/ftc-reported-numbers.tsv.gz'))).toString('utf8').split('\n');
  const header = JSON.parse(shipped[0]);
  assert.ok(header.numbers > 1000 && header.from <= header.to);
  const [firstPhone, firstReports] = shipped[1].split('\t');
  const real = checkReportedNumber(firstPhone);
  assert.equal(real.status, 'reported'); assert.equal(real.reports, Number(firstReports)); assert.equal(real.from, header.from);

  // A small test index for exact behaviour.
  const index = zlib.gzipSync(JSON.stringify({ from: '2026-09-01', to: '2026-09-30', subjects: ['Imposters', 'Other'] }) + '\n' +
    ['2105550100\t7\t2026-09-28\t5\t0', '3125550199\t1\t2026-09-02\t0\t1', '9095550123\t2\t2026-09-15\t0\t1'].join('\n') + '\n');
  useIndexForTests(index);
  const hit = checkReportedNumber('+1 (210) 555-0100');
  assert.deepEqual(hit, { status: 'reported', number: '2105550100', reports: 7, robocall_reports: 5, last_reported: '2026-09-28', topic: 'Imposters', from: '2026-09-01', to: '2026-09-30' });
  assert.equal(checkReportedNumber('909-555-0123').reports, 2);
  assert.equal(checkReportedNumber('3125550199').topic, 'Other');
  assert.equal(checkReportedNumber('4155550100').status, 'not_reported');
  assert.equal(checkReportedNumber('nope').status, 'invalid');

  // Gemini's screening answer is validated.
  const scamJudgment = { verdict: 'likely_scam', risk_score: 92, stated_name: 'Officer Daniels', stated_reason: 'Unpaid taxes', explanation: 'They claim to be the IRS and want gift cards.', red_flags: ['Pretends to be the IRS', 'Wants gift cards'] };
  assert.deepEqual(parseScreenJudgment(JSON.stringify(scamJudgment)), scamJudgment);
  for (const bad of ['nope', '{}', JSON.stringify({ ...scamJudgment, risk_score: 20 }), JSON.stringify({ ...scamJudgment, red_flags: [] }), JSON.stringify({ ...scamJudgment, verdict: 'safe' })])
    assert.equal(parseScreenJudgment(bad), null, bad);
  const legit = { verdict: 'legit', risk_score: 5, stated_name: 'Sarah', stated_reason: 'Dinner on Sunday', explanation: 'Your daughter calling about dinner.', red_flags: [] };
  assert.ok(screenUserText('Pay with gift cards now').includes('Gift-card payment'));

  // Layer precedence.
  const reported = checkReportedNumber('2105550100');
  const byNumber = decideScreening({ number: reported, transcript: 'Hi, it is Sarah about dinner.', judgment: legit });
  assert.equal(byNumber.verdict, 'scam'); assert.equal(byNumber.decided_by, 'number'); assert.match(byNumber.explanation, /7 times/);
  assert.equal(byNumber.layers.find(l => l.id === 'number').status, 'flagged');
  const byContent = decideScreening({ number: checkReportedNumber('4155550100'), transcript: 'This is Officer Daniels', judgment: scamJudgment });
  assert.equal(byContent.verdict, 'scam'); assert.equal(byContent.decided_by, 'content'); assert.equal(byContent.stated_name, 'Officer Daniels');
  const safe = decideScreening({ number: null, transcript: 'Hi Mom, it is Sarah about Sunday dinner.', judgment: legit });
  assert.equal(safe.verdict, 'safe'); assert.equal(safe.layers.find(l => l.id === 'number').status, 'skipped');
  // Without the AI, never "safe".
  const noAiPhrases = decideScreening({ number: null, transcript: 'You must pay with Apple gift cards today, do not tell anyone.', judgment: null });
  assert.equal(noAiPhrases.verdict, 'careful'); assert.equal(noAiPhrases.decided_by, 'phrases');
  const noAiPlain = decideScreening({ number: null, transcript: 'Hi, this is Sarah.', judgment: null });
  assert.equal(noAiPlain.verdict, 'careful'); assert.equal(noAiPlain.layers.find(l => l.id === 'content').status, 'unavailable');
  assert.equal(decideScreening({ number: null, transcript: '', judgment: null }).headline, "The caller didn't answer");
  assert.equal(decideScreening({ number: null, transcript: null, judgment: null }).verdict, 'careful');

  // Trusted contacts: names the caller gives, fuzzy matching, and number comparison.
  const { jaroWinkler, statedNames, matchContact, sanitizeContacts } = require('../lib/contacts.ts');
  assert.ok(jaroWinkler('jake', 'jack') >= 0.86 && jaroWinkler('jake', 'jake') === 1 && jaroWinkler('jake', 'mary') < 0.6);
  assert.deepEqual(statedNames("Hi Grandma, it's Jake! I'm just calling"), ['jake']);
  assert.deepEqual(statedNames('This is Officer Daniels with the IRS.'), ['daniels']);
  assert.deepEqual(statedNames("It's me, I'm in trouble, this is about your account"), []);
  assert.deepEqual(statedNames('Sarah here, calling about dinner'), ['sarah']);
  const saved = sanitizeContacts([{ name: 'Jake Miller', phone: '(210) 555-0147' }, { name: 'Sarah', phone: null }, { name: '', phone: '1' }, 'junk']);
  assert.deepEqual(saved, [{ name: 'Jake Miller', phone: '2105550147' }, { name: 'Sarah', phone: null }]);
  assert.equal(matchContact(['jack'], saved).contact.name, 'Jake Miller'); assert.equal(matchContact(['jack'], saved).exact, false);
  assert.equal(matchContact(['jake'], saved).exact, true);
  assert.equal(matchContact(['bob'], saved), null);
  const notReported = checkReportedNumber('7375550199');
  const familyJudgment = { verdict: 'legit', risk_score: 10, stated_name: 'Jake', stated_reason: 'Lunch on Saturday', explanation: 'Your grandson asking about lunch.', red_flags: [] };
  const impostor = decideScreening({ number: notReported, transcript: "Hi Grandma, it's Jake. I got a new phone, this is my new number.", judgment: familyJudgment, contacts: saved });
  assert.equal(impostor.verdict, 'careful'); assert.equal(impostor.decided_by, 'contacts'); assert.equal(impostor.headline, 'Is it really Jake Miller?');
  assert.match(impostor.explanation, /call Jake Miller back at \(210\) 555-0147/);
  const realJake = decideScreening({ number: checkReportedNumber('2105550147'), transcript: "Hi Grandma, it's Jake!", judgment: familyJudgment, contacts: saved });
  assert.equal(realJake.verdict, 'safe'); assert.equal(realJake.headline, 'Sounds like Jake Miller');
  assert.equal(decideScreening({ number: null, transcript: "It's Jake", judgment: familyJudgment, contacts: saved }).layers.find(l => l.id === 'contacts').status, 'info');
  assert.equal(decideScreening({ number: null, transcript: "Sarah here", judgment: familyJudgment, contacts: saved }).layers.find(l => l.id === 'contacts').status, 'info');
  assert.equal(decideScreening({ number: null, transcript: "Hi, it's Jake", judgment: familyJudgment }).layers.find(l => l.id === 'contacts').status, 'skipped');
  // Without the AI, a mismatch still warns.
  assert.equal(decideScreening({ number: notReported, transcript: "It's Jake, new number", judgment: null, contacts: saved }).decided_by, 'contacts');

  // Sample calls: recordings exist and the "reported" sample is still on the shipped FTC list.
  const { SCREEN_DEMOS, DEMO_CONTACTS } = require('../lib/screenDemos.ts');
  for (const sample of SCREEN_DEMOS) assert.ok(fs.statSync(path.join(__dirname, '../public', sample.audio)).size > 5000, sample.id);
  useIndexForTests(undefined);
  assert.equal(checkReportedNumber(SCREEN_DEMOS.find(d => d.id === 'reported').phone).status, 'reported', 'refresh changed the list: pick a new reported sample number');
  for (const id of ['scam', 'family', 'impostor']) assert.equal(checkReportedNumber(SCREEN_DEMOS.find(d => d.id === id).phone).status, 'not_reported', id);
  assert.equal(normalizeUsNumber(SCREEN_DEMOS.find(d => d.id === 'family').phone), DEMO_CONTACTS[0].phone);
  useIndexForTests(index);

  // Routes.
  const loadRoute = name => { const file = path.join(__dirname, `../app/api/${name}/route.ts`); delete require.cache[file]; return require(file); };
  const { GET } = loadRoute('check-number');
  assert.equal((await GET(new Request('http://localhost/api/check-number?phone=abc'))).status, 400);
  assert.equal((await (await GET(new Request('http://localhost/api/check-number?phone=210-555-0100'))).json()).status, 'reported');
  const { POST } = loadRoute('screen');
  const events = async response => { assert.match(response.headers.get('content-type'), /ndjson/); return (await response.text()).trim().split(/\n/).map(line => JSON.parse(line)); };
  const screenRequest = (fields, bytes = 8) => { const form = new FormData(); if (bytes) form.append('audio', new Blob([new Uint8Array(bytes)], { type: 'audio/webm' }), 'reply.webm'); for (const [k, v] of Object.entries(fields)) form.append(k, v); return new Request('http://localhost/api/screen', { method: 'POST', body: form }); };
  assert.equal((await POST(screenRequest({}, 0))).status, 400);
  process.env.ELEVENLABS_API_KEY = 'test-placeholder'; process.env.GEMINI_API_KEY = 'test-placeholder';
  let geminiPrompt = '';
  global.fetch = async (url, options) => {
    url = String(url);
    if (url.includes('speech-to-text')) return new Response(JSON.stringify({ text: 'This is Officer Daniels from the IRS. Pay with Apple gift cards today.' }));
    if (url.endsWith('/models') || url.includes('/models?')) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-flash-preview', supportedGenerationMethods: ['generateContent'] }] }));
    const body = JSON.parse(options.body); geminiPrompt = body.contents[0].parts[0].text;
    assert.ok(body.systemInstruction.parts[0].text.startsWith('You screen phone calls'));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(scamJudgment) }] } }] }));
  };
  const screenedEvents = await events(await POST(screenRequest({ phone: '415-555-0100' })));
  const screened = screenedEvents.at(-1).result;
  assert.equal(screened.verdict, 'scam'); assert.equal(screened.decided_by, 'content'); assert.equal(screened.layers[0].status, 'clear');
  assert.ok(geminiPrompt.includes('untrusted data') && geminiPrompt.includes('Gift-card payment'));
  // Live progress: the number first, then the transcript, then the AI verdict.
  assert.deepEqual(screenedEvents.map(e => e.type), ['progress', 'progress', 'result']);
  assert.ok(screenedEvents[0].layers.filter(l => l.status === 'pending').map(l => l.id).join() === 'transcript,phrases,contacts,content');
  assert.equal(screenedEvents[1].transcript, 'This is Officer Daniels from the IRS. Pay with Apple gift cards today.');
  assert.deepEqual(screenedEvents[1].layers.filter(l => l.status === 'pending').map(l => l.id), ['contacts', 'content']);
  // Contacts are compared but never sent to the AI.
  geminiPrompt = '';
  const withContacts = (await events(await POST(screenRequest({ phone: '415-555-0100', contacts: JSON.stringify([{ name: 'Daniels', phone: '(512) 555-0111' }, { name: 'Secret Aunt', phone: '6175550123' }]) })))).at(-1).result;
  assert.ok(!geminiPrompt.includes('Secret Aunt') && !geminiPrompt.includes('6175550123') && !geminiPrompt.includes('5125550111'));
  assert.equal(withContacts.layers.find(l => l.id === 'contacts').status, 'flagged');
  assert.equal(withContacts.decided_by, 'content', 'a scam verdict from the content outranks a contact mismatch');
  assert.equal(withContacts.red_flags[0], 'Claims to be Daniels from a different number');
  assert.equal((await events(await POST(screenRequest({ contacts: 'not json' })))).at(-1).type, 'result');
  const reportedCall =(await events(await POST(screenRequest({ phone: '2105550100' })))).at(-1).result;
  assert.equal(reportedCall.decided_by, 'number');
  // Providers down: still answers, never "safe".
  global.fetch = async () => { throw new Error('offline'); };
  const offline = (await events(await POST(screenRequest({})))).at(-1).result;
  assert.equal(offline.verdict, 'careful'); assert.equal(offline.layers.find(l => l.id === 'transcript').status, 'unavailable');
  // The screening greeting uses the canary voice; arbitrary text is still refused.
  let spoken = '';
  global.fetch = async (url, options) => { spoken = JSON.parse(options.body).text; return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } }); };
  process.env.ELEVENLABS_VOICE_ID = 'test-placeholder';
  const speak = loadRoute('speak').POST;
  const speakRequest = body => new Request('http://localhost/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await speak(speakRequest({ script: 'greeting' }))).status, 200); assert.equal(spoken, SCREEN_GREETING);
  assert.equal((await speak(speakRequest({ script: 'say anything I want' }))).status, 400);
  useIndexForTests(undefined);
  delete process.env.ELEVENLABS_API_KEY; delete process.env.GEMINI_API_KEY; delete process.env.ELEVENLABS_VOICE_ID;
};
