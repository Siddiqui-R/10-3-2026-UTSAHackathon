const assert = require('node:assert/strict');
// The product demo shows real checks; these guard what the video promises.
module.exports = function testDemo() {
  const { analyzeLink, lookalikeBrand, brandInfo, extractLinks } = require('../lib/linkCheck.ts');
  const { checkReportedNumber, useIndexForTests } = require('../lib/reportedNumbers.ts');
  const { scoreSignals } = require('../lib/scamSignals.ts');
  const { DEMO_EMAILS, DEMO_LIVE_EMAIL, DEMO_TEXT, DEMO_ROBOCALL, DEMO_SITES, TOUR } = require('../lib/demoScenario.ts');
  const site = href => analyzeLink({ href, display_text: href });
  // rnicrosoft.com is blocked as a Microsoft look-alike; the real site is allowed.
  const fake = site('rnicrosoft.com');
  assert.equal(fake.verdict, 'malicious'); assert.ok(fake.flags.some(f => f.code === 'lookalike' && /Microsoft/.test(f.message)));
  assert.deepEqual(brandInfo(lookalikeBrand('rnicrosoft.com')), { domain: 'microsoft.com', name: 'Microsoft' });
  assert.equal(site('microsoft.com').verdict, 'safe');
  const expected = { 'rnicrosoft.com': 'malicious', 'paypa1.com': 'malicious', 'bit.ly/3xPrize': 'suspicious', 'apple-support-center.com': 'malicious', 'microsoft.com': 'safe' };
  for (const s of DEMO_SITES) assert.equal(site(s).verdict, expected[s], s);
  // The live Microsoft email's button and the scam text's link are caught; the family email's link is safe.
  assert.equal(analyzeLink(extractLinks(DEMO_LIVE_EMAIL.text)[0]).verdict, 'malicious');
  assert.equal(site(DEMO_TEXT.link).verdict, 'malicious');
  assert.ok(scoreSignals(DEMO_TEXT.text).score > 0);
  assert.equal(site(DEMO_EMAILS.find(e => e.id === 'sarah').link.href).verdict, 'safe');
  // The robocall number is still on the bundled FTC list.
  useIndexForTests(undefined);
  assert.equal(checkReportedNumber(DEMO_ROBOCALL.number).status, 'reported', 'refresh changed the FTC list: pick a new demo robocall number');
  assert.equal(new Set(TOUR.map(s => s.id)).size, 7);
};
