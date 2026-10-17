const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { probe } = require('./local-services.cjs');

test('readiness requires successful HTTP status and an explicit ready result', async () => {
  let code = 200, body = { status: 'ok' };
  const server = http.createServer((_req, res) => { res.writeHead(code); res.end(JSON.stringify(body)); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(await probe(url), true);
    code = 503;
    assert.equal(await probe(url), false);
    code = 200; body = { status: 'starting' };
    assert.equal(await probe(url), false);
    body = { detail: 'model missing' };
    assert.equal(await probe(url), false);
  } finally { await new Promise(resolve => server.close(resolve)); }
  assert.equal(await probe(url), false);
});
