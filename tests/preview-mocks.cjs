// Explicit UI test harness only. Never referenced by app code or production scripts.
// node --require ./tests/preview-mocks.cjs node_modules/next/dist/bin/next start -p 3001
console.log('UI TEST FIXTURES: mocked Gemini verdicts, unavailable ElevenLabs voice. No live provider calls.');
process.env.GEMINI_API_KEY = 'ui-test-placeholder';
process.env.ELEVENLABS_API_KEY = 'ui-test-placeholder';
process.env.ELEVENLABS_VOICE_ID = 'ui-test-placeholder';
const originalFetch = global.fetch;
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
global.fetch = async (input, options) => {
  const url = String(input);
  if (url.startsWith('https://generativelanguage.googleapis.com/')) {
    if (url.endsWith('/models')) return json({ models: [{ name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] }] });
    const words = JSON.parse(options.body).contents[0].parts[0].text;
    const type = words.includes('Officer Daniels') ? 'irs' : words.includes('sweetheart') ? 'romance' : 'phishing';
    const reasons = {
      irs: ['The caller demanded gift cards to pay taxes.', 'The caller threatened arrest to scare you.'],
      romance: ['The caller asked for money while claiming to be overseas.', 'The caller told you to keep this from your family.'],
      phishing: ['The message asks for money through a suspicious delivery link.'],
    };
    const phrases = { irs: ['Apple gift cards', 'warrant out for your arrest'], romance: ['wire two thousand dollars', "Please don't tell your kids"], phishing: ['usps-track-secure dot r u'] };
    const verdict = { level: 'scam', risk_score: 95, scam_type: type, reasons: reasons[type], red_flags: phrases[type].map((phrase, index) => ({ phrase, explanation: reasons[type][index] || reasons[type][0] })) };
    return json({ candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] } }] });
  }
  if (url.startsWith('https://api.elevenlabs.io/')) return new Response('', { status: 503 });
  return originalFetch(input, options);
};
