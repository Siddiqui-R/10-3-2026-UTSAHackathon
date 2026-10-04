const assert = require('node:assert/strict');
// Recent checks live only in the browser: bounded, trimmed, removable, and switchable off (which deletes them).
module.exports = function testHistory() {
  const saved = { window: global.window, localStorage: Object.getOwnPropertyDescriptor(global, 'localStorage') };
  const data = new Map(); let events = 0; let blocked = false;
  const storage = {
    getItem: key => { if (blocked) throw new Error('blocked'); return data.has(key) ? data.get(key) : null; },
    setItem: (key, value) => { if (blocked) throw new Error('blocked'); data.set(key, String(value)); },
    removeItem: key => { data.delete(key); },
  };
  Object.defineProperty(global, 'localStorage', { value: storage, configurable: true, writable: true });
  global.window = { dispatchEvent: () => { events++; }, addEventListener() {}, removeEventListener() {} };
  try {
    const history = require('../lib/history.ts');
    assert.deepEqual(history.loadHistory(), []);
    history.addHistory({ kind: 'screen', verdict: 'scam', title: 'Screened a call: This sounds like a scam', details: ['Officer Daniels — IRS', '', '(415) 555-0142', 'Decided by: CallCanary', 'extra'] });
    let entries = history.loadHistory();
    assert.equal(entries.length, 1); assert.equal(entries[0].kind, 'screen');
    assert.deepEqual(entries[0].details, ['Officer Daniels — IRS', '(415) 555-0142', 'Decided by: CallCanary', 'extra'], 'blank details dropped');
    assert.ok(entries[0].id && !Number.isNaN(Date.parse(entries[0].at)));
    assert.ok(events > 0, 'pages are told to refresh');
    // Newest first, capped, long text trimmed.
    for (let i = 0; i < 60; i++) history.addHistory({ kind: 'number', verdict: 'info', title: `Check ${i} ${'x'.repeat(200)}`, details: ['y'.repeat(500)] });
    entries = history.loadHistory();
    assert.equal(entries.length, history.MAX_HISTORY); assert.ok(entries[0].title.startsWith('Check 59'));
    assert.ok(entries[0].title.length <= 120 && entries[0].details[0].length <= 200);
    history.removeHistory(entries[0].id);
    assert.equal(history.loadHistory().length, history.MAX_HISTORY - 1); assert.ok(history.loadHistory()[0].title.startsWith('Check 58'));
    history.clearHistory(); assert.deepEqual(history.loadHistory(), []);
    // Turning history off deletes it and stops new entries.
    history.addHistory({ kind: 'email', verdict: 'safe', title: 'Checked an email: looks safe', details: [] });
    history.setHistoryEnabled(false);
    assert.equal(history.historyEnabled(), false); assert.deepEqual(history.loadHistory(), []);
    history.addHistory({ kind: 'email', verdict: 'safe', title: 'Should not be saved', details: [] });
    assert.deepEqual(history.loadHistory(), []);
    history.setHistoryEnabled(true); history.addHistory({ kind: 'call', verdict: 'careful', title: 'Back on', details: [] });
    assert.equal(history.loadHistory().length, 1);
    // Corrupt or blocked storage never throws.
    data.set('callcanary.history', '{not json'); assert.deepEqual(history.loadHistory(), []);
    data.set('callcanary.history', JSON.stringify([{ id: 'ok', title: 'Fine', details: [] }, { nope: true }, null]));
    assert.equal(history.loadHistory().length, 1);
    blocked = true;
    assert.doesNotThrow(() => history.addHistory({ kind: 'call', verdict: 'safe', title: 'x', details: [] }));
    assert.deepEqual(history.loadHistory(), []); assert.equal(history.historyEnabled(), false);
  } finally {
    global.window = saved.window;
    if (saved.localStorage) Object.defineProperty(global, 'localStorage', saved.localStorage); else delete global.localStorage;
  }
};
