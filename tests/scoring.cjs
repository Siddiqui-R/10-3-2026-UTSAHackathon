const assert = require('node:assert/strict');
// Phrase weights only decide whether to investigate. These cases guard both directions.
module.exports = function testScoring() {
  const { scoreSignals, SIGNAL_THRESHOLD } = require('../lib/scamSignals.ts');
  const { demoTranscripts } = require('../lib/demoTranscripts.ts');
  const ordinary = [
    'Hi mom, dinner at six. See you then.',
    'I got you an Amazon gift card for your birthday, grandma. Love you!',
    'Grandpa, I am in the school play next week. Can you come?',
    'My neighbor got arrested last year for drunk driving, can you believe it?',
    "I won't send money to anyone I don't know.",
    'Never tell anyone your PIN, okay? Not even me.',
    'The IRS sent me a letter about my refund, so I will call my accountant.',
    "I'm going to Walmart to buy groceries and a birthday card.",
    'Your grandson keeps talking about bitcoin. I do not understand it at all.',
    'Did you see the news? Scammers tell people to pay with gift cards and buy Google Play cards. Never do that.',
    "We talked at church about how scammers say don't tell your kids and stay on the line.",
    'The bank will never ask for your password or verification code. If someone asks you to send money, hang up.',
    "I'm not going to pay with gift cards, that is a scam.",
  ];
  for (const text of ordinary) {
    const { score, signals } = scoreSignals(text);
    assert.ok(score < SIGNAL_THRESHOLD, `false positive (${score}): ${text} -> ${JSON.stringify(signals)}`);
  }
  const scams = [
    'Go to Walmart and buy Google Play cards, then read me the numbers on the back.',
    "Grandma, it's me. I'm in jail and I need bail money. Please don't tell mom.",
    'This is Microsoft support. Your computer has been hacked. Download AnyDesk so I can fix it.',
    'Your social security number has been suspended. Stay on the line with me.',
    'Congratulations, you have won the lottery! Pay the processing fee to claim your prize.',
    'Read me the verification code we just sent to your phone.',
    'Put the cash in a box. A courier will come pick up the money this afternoon.',
    'Take your savings out and deposit it into the bitcoin ATM at the gas station.',
    "Don't worry, just pay with gift cards and this all goes away.",
    // Scammers often borrow anti-scam language. Direct demands still count.
    'This is the fraud department. Scammers accessed your account. Read me the code we just texted you.',
    'Hey sweetie, you need to wire me the money today, keep this between us.',
    ...Object.values(demoTranscripts),
  ];
  for (const text of scams) {
    const { score, signals } = scoreSignals(text);
    assert.ok(score >= SIGNAL_THRESHOLD, `missed scam (${score}): ${text} -> ${JSON.stringify(signals)}`);
  }
  // Repetition never inflates a rule; a payment demand plus pressure earns one combination bonus.
  const once = scoreSignals('You must pay with Apple gift cards.').score;
  assert.equal(scoreSignals('You must pay with Apple gift cards. Pay with gift cards. Pay with gift cards!').score, once);
  assert.equal(scoreSignals('gift cards gift cards gift cards').score, 15);
  assert.ok(scoreSignals('Pay with gift cards immediately, there is a warrant for your arrest.').signals.some(s => s.id === 'combo'));
  // Negated and discussion matches stay visible but are labelled and down-weighted.
  const negated = scoreSignals("I will not send money to strangers.").signals.find(s => s.id === 'wire');
  assert.equal(negated.note, 'negated'); assert.ok(negated.weight < 10);
  const discussion = scoreSignals('The news said scammers ask for Western Union transfers.').signals.find(s => s.id === 'wire');
  assert.equal(discussion.note, 'discussion');
  assert.equal(scoreSignals('gift cardholder postcard').score, 0);
  assert.equal(scoreSignals('').score, 0);
};
