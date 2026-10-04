const assert = require('node:assert/strict');
const path = require('node:path');
// Layer A (code) is ground truth for links; Layer B (Gemini) explains but can never downgrade it.
module.exports = async function testEmail() {
  const { linkReport, extractLinks, analyzeLink, lookalikeBrand, checkSender } = require('../lib/linkCheck.ts');
  const { parseEmailAnalysis, mergeEmailVerdict } = require('../lib/emailAnalysis.ts');
  const { DEMO_PHISHING_EMAIL } = require('../lib/demoTranscripts.ts');
  const verdictOf = text => linkReport(text).links.map(link => link.verdict);
  const codes = text => linkReport(text).links.flatMap(link => link.flags.map(flag => flag.code));

  // The demo: display text says paypal.com, the link goes to a .ru lookalike, and the sender is fake.
  const demo = linkReport(DEMO_PHISHING_EMAIL);
  assert.equal(demo.links.length, 1);
  assert.equal(demo.links[0].shown_domain, 'paypal.com'); assert.equal(demo.links[0].actual_domain, 'paypa1-secure.ru');
  assert.equal(demo.links[0].verdict, 'malicious');
  for (const code of ['mismatch', 'lookalike', 'abused-tld']) assert.ok(demo.links[0].flags.some(f => f.code === code), code);
  assert.equal(demo.sender.address, 'support@paypa1-secure.ru'); assert.equal(demo.sender.claimed_brand, 'PayPal'); assert.equal(demo.sender.spoofed, true);

  // HTML anchors: the visible text versus the real href.
  const html = extractLinks('<p>Hi</p><a class="btn" href="https://paypa1-secure.ru/x?a=1&amp;b=2"><b>www.paypal.com</b></a>');
  assert.deepEqual(html, [{ href: 'https://paypa1-secure.ru/x?a=1&b=2', display_text: 'www.paypal.com' }]);
  assert.ok(codes('<a href="https://evil.example">PayPal login</a>').includes('brand-text'));
  assert.deepEqual(verdictOf('[Your Chase account](https://chase-secure-login.top/a)'), ['malicious']);

  // Each technique from the brief.
  assert.ok(codes('http://xn--pypal-4ve.com/login').includes('punycode'));
  assert.ok(codes('https://www.paypal.com@evil.example/login').includes('at-trick'));
  assert.ok(codes('http://203.0.113.9/verify').includes('ip-host'));
  assert.ok(codes('https://login.secure.account.verify.evil.com').includes('subdomains'));
  for (const short of ['bit.ly/abc', 'https://tinyurl.com/x1', 'https://t.co/xyz', 'goo.gl/maps']) assert.ok(codes(short).includes('shortener'), short);
  for (const tld of ['ru', 'tk', 'ml', 'ga', 'cf', 'xyz', 'top', 'buzz']) assert.ok(codes(`https://example.${tld}/a`).includes('abused-tld'), tld);
  for (const fake of ['paypa1.com', 'usps-track-secure.ru', 'apple-support-center.com', 'rnicrosoft.com', 'arnazon.com', 'wellsfarg0.com', 'netfliix.com', 'bankofamerica-alerts.com', 'paypal.com.account-verify.co', 'fedex-delivery.info'])
    assert.ok(lookalikeBrand(new URL(`http://${fake}`).hostname), fake);
  // Real sites and unrelated look-alikes must not be flagged.
  for (const real of ['https://www.paypal.com/signin', 'https://secure.chase.com/x', 'https://tools.usps.com/go/TrackConfirmAction', 'https://www.irs.gov/refunds', 'amazon.co.uk/orders', 'https://appleid.apple.com', 'https://login.microsoftonline.com', 'applebees.com', 'ups.com', 'https://www.google.com', 'https://www.firstchoice.org'])
    assert.deepEqual(verdictOf(real), ['safe'], real);
  assert.deepEqual(extractLinks('Email me at bob@gmail.com or call 555-1234. See you at 5 p.m.'), []);
  assert.equal(analyzeLink({ href: 'javascript:alert(1)', display_text: 'Click' }).verdict, 'malicious');
  assert.equal(extractLinks('a.com '.repeat(60)).length <= 25, true);

  // Sender: display name versus real address, and a different reply-to.
  assert.equal(checkSender('From: "Amazon" <orders@amazon.com>').spoofed, false);
  assert.equal(checkSender('From: Amazon Orders <no-reply@amaz0n-billing.com>').spoofed, true);
  assert.equal(checkSender('From: Grandma <nana@gmail.com>\nReply-To: someone@strange.biz').spoofed, true);
  assert.equal(checkSender('From: Grandma <nana@gmail.com>').spoofed, false);
  assert.equal(checkSender('No headers here'), null);

  // Gemini output is validated: invented typos are dropped, levels follow the score.
  const ai = { risk_score: 20, level: 'safe', typos: [{ typo: 'activty', correction: 'activity', why_it_matters: 'Real companies proofread.' }, { typo: 'invented', correction: 'x', why_it_matters: '' }, { typo: 'Sincerly', correction: 'Sincerly', why_it_matters: '' }],
    links: [{ display_text: 'www.paypal.com/signin', actual_url: 'https://paypa1-secure.ru/verify', verdict: 'safe', explanation: 'Looks fine.' }],
    sender: { display_name: 'PayPal Support', address: 'support@paypa1-secure.ru', spoofed: false, explanation: 'Fine.' }, pressure_tactics: ['Threatens to suspend your account in 24 hours.'], recommended_action: 'Delete it.' };
  const parsed = parseEmailAnalysis(JSON.stringify(ai), DEMO_PHISHING_EMAIL);
  assert.deepEqual(parsed.typos.map(t => t.typo), ['activty']);
  for (const bad of ['not json', '{}', JSON.stringify({ ...ai, risk_score: 101 }), JSON.stringify({ ...ai, typos: 'x' })]) assert.equal(parseEmailAnalysis(bad, DEMO_PHISHING_EMAIL), null);
  // Even if the AI says "safe", code findings win.
  const merged = mergeEmailVerdict(parsed, demo);
  assert.equal(merged.level, 'phishing'); assert.ok(merged.risk_score >= 85);
  assert.equal(merged.links[0].verdict, 'malicious'); assert.equal(merged.sender.spoofed, true); assert.equal(merged.ai_checked, true);
  // The AI may raise a link's verdict.
  const raised = mergeEmailVerdict({ ...parsed, links: [{ ...parsed.links[0], actual_url: 'https://example.com/', verdict: 'suspicious' }] }, linkReport('https://example.com/'));
  assert.equal(raised.links[0].verdict, 'suspicious');
  // AI unavailable: code result stands; nothing becomes "safe" by default.
  const codeOnly = mergeEmailVerdict(null, demo);
  assert.equal(codeOnly.level, 'phishing'); assert.equal(codeOnly.ai_checked, false); assert.ok(codeOnly.recommended_action);
  assert.equal(mergeEmailVerdict(null, linkReport('Hi Grandma, see you Sunday!')).level, 'suspicious');

  // Route: Gemini mocked as calling the demo safe; the response still reports phishing.
  const route = path.join(__dirname, '../app/api/analyze-email/route.ts');
  delete require.cache[route]; const { POST } = require(route);
  const post = body => POST(new Request('http://localhost/api/analyze-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ emailText: '   ' })).status, 400);
  assert.equal((await post({ emailText: 'x'.repeat(50_001) })).status, 413);
  process.env.GEMINI_API_KEY = 'test-placeholder';
  let prompt = '';
  global.fetch = async (url, options) => {
    if (String(url).includes('/models?') || String(url).endsWith('/models')) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-flash-preview', supportedGenerationMethods: ['generateContent'] }] }));
    prompt = JSON.parse(options.body).contents[0].parts[0].text;
    assert.ok(JSON.parse(options.body).systemInstruction.parts[0].text.startsWith('You are a phishing-email expert protecting elderly users.'));
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ai) }] } }] }));
  };
  const live = await (await post({ emailText: DEMO_PHISHING_EMAIL })).json();
  assert.equal(live.level, 'phishing'); assert.equal(live.ai_checked, true); assert.deepEqual(live.typos.map(t => t.typo), ['activty']);
  assert.ok(prompt.includes('<link_report') && prompt.includes('paypa1-secure.ru') && prompt.includes('The link says paypal.com'));
  // HTML is shown to the model with both sides of each link.
  await post({ emailText: '<p>Hello</p><a href="https://evil.example/x">Click here</a>' });
  assert.ok(prompt.includes('Click here [link to https://evil.example/x]') && !prompt.includes('<p>'));
  // Hedging: a hanging model doesn't hold up the answer; the next model starts after 5 s and wins.
  let first = true; let aborted = false;
  global.fetch = async (url, options) => {
    if (first) { first = false; return new Promise((_, reject) => options.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); })); }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(ai) }] } }] }));
  };
  const started = Date.now();
  const hedged = await (await post({ emailText: DEMO_PHISHING_EMAIL })).json();
  assert.equal(hedged.ai_checked, true); assert.ok(Date.now() - started < 8000, 'hedged answer should not wait for the hanging model');
  assert.equal(aborted, true, 'the losing request is cancelled');
  global.fetch = async () => { throw new Error('offline'); };
  const offline = await (await post({ emailText: DEMO_PHISHING_EMAIL })).json();
  assert.equal(offline.level, 'phishing'); assert.equal(offline.ai_checked, false);
  delete process.env.GEMINI_API_KEY;
  const noKey = await (await post({ emailText: 'bit.ly/abc' })).json();
  assert.equal(noKey.links[0].verdict, 'suspicious'); assert.equal(noKey.ai_checked, false);
};
