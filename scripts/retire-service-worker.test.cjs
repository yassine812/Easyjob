const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

test('retires the old worker and reloads each same-origin tab at its own URL', async () => {
  const handlers = {};
  const calls = [];
  const urls = ['http://localhost:3000/register?step=2', 'http://localhost:3000/login'];
  const windows = urls.map((url) => ({ url, navigate: async (target) => calls.push(target) }));
  windows.push({ url: 'http://localhost:3000/closed', navigate: async () => { throw new Error('Closed tab'); } });
  windows.push({ url: 'https://example.com/', navigate: async () => assert.fail('Must stay on this origin') });
  const self = {
    location: { origin: 'http://localhost:3000' },
    addEventListener: (name, handler) => { handlers[name] = handler; },
    skipWaiting: async () => calls.push('skipWaiting'),
    clients: {
      claim: async () => calls.push('claim'),
      matchAll: async (options) => { assert.equal(options.type, 'window'); return windows; },
    },
    registration: { unregister: async () => calls.push('unregister') },
  };
  runInNewContext(readFileSync(join(__dirname, '../public/sw.js'), 'utf8'), { self, URL });
  assert.equal(handlers.fetch, undefined, 'Replacement must never cache navigation');
  await handlers.install();
  let completion;
  handlers.activate({ waitUntil: (promise) => { completion = promise; } });
  await completion;
  assert.deepEqual(calls, ['skipWaiting', 'claim', 'unregister', ...urls]);
});
